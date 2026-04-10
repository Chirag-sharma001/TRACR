const { EventEmitter } = require("events");

const createTransactionRoutes = require("../routes/transactions");
const ReplayService = require("../ingestion/ReplayService");
const TransactionRepository = require("../ingestion/TransactionRepository");
const { createAppWithJson, startServer, jsonRequest } = require("../testUtils/httpHarness");

function createInMemoryLedgerModel() {
  const byKey = new Map();

  return {
    byKey,
    create: jest.fn(async (doc) => {
      if (byKey.has(doc.idempotency_key)) {
        const error = new Error("duplicate key");
        error.code = 11000;
        throw error;
      }
      const persisted = { ...doc, _id: `ledger-${byKey.size + 1}` };
      byKey.set(doc.idempotency_key, persisted);
      return persisted;
    }),
    findOneAndUpdate: jest.fn(async (query, update) => {
      const existing = byKey.get(query.idempotency_key);
      if (!existing) {
        return null;
      }
      if (query.status && query.status.$in && !query.status.$in.includes(existing.status)) {
        return null;
      }
      const next = { ...existing, ...update.$set };
      byKey.set(query.idempotency_key, next);
      return next;
    }),
    findOne: jest.fn((query) => ({
      lean: async () => byKey.get(query.idempotency_key) || null,
    })),
    updateOne: jest.fn(async (query, update) => {
      const existing = byKey.get(query.idempotency_key);
      if (!existing) {
        return { matchedCount: 0, modifiedCount: 0 };
      }
      byKey.set(query.idempotency_key, { ...existing, ...update.$set });
      return { matchedCount: 1, modifiedCount: 1 };
    }),
  };
}

function createInMemoryFailureModel() {
  const items = [];

  function filterByWindow(query) {
    const from = query?.failed_at?.$gte ? new Date(query.failed_at.$gte).getTime() : Number.NEGATIVE_INFINITY;
    const to = query?.failed_at?.$lte ? new Date(query.failed_at.$lte).getTime() : Number.POSITIVE_INFINITY;
    return items.filter((item) => {
      const at = new Date(item.failed_at).getTime();
      return at >= from && at <= to;
    });
  }

  return {
    items,
    create: jest.fn(async (doc) => {
      const stored = {
        _id: `failure-${items.length + 1}`,
        replayed_at: null,
        replayed_by_operator_id: null,
        replay_outcome: null,
        ...doc,
      };
      items.push(stored);
      return stored;
    }),
    find: jest.fn((query) => {
      const filtered = filterByWindow(query);
      const chain = {
        sort: () => chain,
        skip: (n) => {
          chain._skip = n;
          return chain;
        },
        limit: (n) => {
          chain._limit = n;
          return chain;
        },
        lean: async () => {
          const begin = chain._skip || 0;
          const end = begin + (chain._limit || filtered.length);
          return filtered.slice(begin, end);
        },
      };
      return chain;
    }),
    countDocuments: jest.fn(async (query) => filterByWindow(query).length),
    findById: jest.fn((id) => ({
      lean: async () => items.find((item) => item._id === id) || null,
    })),
    updateOne: jest.fn(async (query, update) => {
      const idx = items.findIndex((item) => item._id === query._id);
      if (idx < 0) {
        return { matchedCount: 0, modifiedCount: 0 };
      }
      items[idx] = {
        ...items[idx],
        ...update.$set,
      };
      return { matchedCount: 1, modifiedCount: 1 };
    }),
  };
}

describe("Integration: replay to alert invariants", () => {
  test("single replay emits downstream side effects once and repeated replay is idempotent", async () => {
    const ledgerModel = createInMemoryLedgerModel();
    const failureModel = createInMemoryFailureModel();

    const storedTransactions = [];
    const transactionModel = {
      create: jest.fn(async (doc) => {
        const persisted = { ...doc };
        storedTransactions.push(persisted);
        return { ...persisted, toObject: () => persisted };
      }),
      findOne: jest.fn(async (query) => {
        const existing = storedTransactions.find((tx) => tx.transaction_id === query.transaction_id);
        return existing ? { ...existing, toObject: () => existing } : null;
      }),
    };

    const internalBus = new EventEmitter();
    const alertEvents = [];
    const caseEvents = [];
    const eventEvents = [];
    const seenIdempotency = new Set();

    internalBus.on("transaction:saved", (payload) => {
      const marker = `${payload.source_id || payload.sender_account_id}::${payload.external_transaction_id || payload.transaction_id}`;
      if (seenIdempotency.has(marker)) {
        return;
      }
      seenIdempotency.add(marker);
      alertEvents.push({ transaction_id: payload.transaction_id, marker });
      caseEvents.push({ transaction_id: payload.transaction_id, marker });
      eventEvents.push({ type: "alert:new", transaction_id: payload.transaction_id, marker });
    });

    let failFirstEmit = true;
    const emitter = {
      emit: jest.fn((event, payload) => {
        if (event === "transaction:saved" && failFirstEmit) {
          failFirstEmit = false;
          throw new Error("event bus unavailable");
        }
        internalBus.emit(event, payload);
      }),
    };

    const repository = new TransactionRepository({
      model: transactionModel,
      emitter,
      logger: { warn: jest.fn(), info: jest.fn() },
      ledgerModel,
      failureModel,
    });

    const replayService = new ReplayService({
      failureModel,
      ledgerModel,
      repository,
      clock: () => new Date("2026-01-01T12:06:00.000Z"),
      logger: { info: jest.fn(), warn: jest.fn() },
    });

    const jwtMiddleware = (req, _res, next) => {
      req.user = { user_id: "operator-1", role: "ADMIN" };
      next();
    };

    const router = createTransactionRoutes({
      validator: { validate: jest.fn(() => ({ valid: true, errors: [] })) },
      normalizer: { normalize: jest.fn((body) => body) },
      repository,
      replayService,
      jwtMiddleware,
    });

    const app = createAppWithJson(router, "/api/transactions");
    const server = await startServer(app);

    try {
      const tx = {
        transaction_id: "tx-replay-1",
        source_id: "source-a",
        external_transaction_id: "ext-100",
        sender_account_id: "source-a",
        receiver_account_id: "sink-b",
        amount_usd: 100,
      };

      const failedIngest = await jsonRequest(server.baseUrl, "/api/transactions/ingest", {
        method: "POST",
        body: tx,
      });
      expect(failedIngest.status).toBe(500);
      expect(failureModel.items).toHaveLength(1);

      const now = Date.now();
      const fromIso = new Date(now - 30 * 60 * 1000).toISOString();
      const toIso = new Date(now + 30 * 60 * 1000).toISOString();

      const failedList = await jsonRequest(
        server.baseUrl,
        `/api/transactions/recovery/failed?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`
      );
      expect(failedList.status).toBe(200);
      expect(failedList.body.items).toHaveLength(1);

      const failureId = failedList.body.items[0].failure_id;

      const replayOnce = await jsonRequest(
        server.baseUrl,
        `/api/transactions/recovery/${failureId}/reprocess`,
        {
          method: "POST",
          body: { trigger: "operator" },
        }
      );
      expect(replayOnce.status).toBe(200);
      expect(replayOnce.body.status).toBe("replayed");

      const replayTwice = await jsonRequest(
        server.baseUrl,
        `/api/transactions/recovery/${failureId}/reprocess`,
        {
          method: "POST",
          body: { trigger: "operator" },
        }
      );
      expect(replayTwice.status).toBe(200);
      expect(replayTwice.body.status).toBe("noop");
      expect(replayTwice.body.duplicate_suppressed).toBe(true);

      expect(alertEvents).toHaveLength(1);
      expect(caseEvents).toHaveLength(1);
      expect(eventEvents).toHaveLength(1);
      expect(alertEvents[0].transaction_id).toBe("tx-replay-1");
    } finally {
      await server.close();
    }
  });
});
