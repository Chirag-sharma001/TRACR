const fc = require("fast-check");
const TransactionRepository = require("./TransactionRepository");

describe("TransactionRepository property tests", () => {
  function buildLedgerStub() {
    const byKey = new Map();

    return {
      findOne: jest.fn(async (query) => byKey.get(query.idempotency_key) || null),
      create: jest.fn(async (doc) => {
        if (byKey.has(doc.idempotency_key)) {
          const error = new Error("duplicate key");
          error.code = 11000;
          throw error;
        }

        byKey.set(doc.idempotency_key, { ...doc });
        return doc;
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

  test("idempotency key is stable across casing and whitespace variations", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        async (senderId, transactionId) => {
          const ledger = buildLedgerStub();
          const model = {
            create: jest.fn(async (doc) => ({ ...doc, toObject: () => ({ ...doc }) })),
            findOne: jest.fn(async () => null),
          };
          const repo = new TransactionRepository({
            model,
            emitter: { emit: jest.fn() },
            logger: { warn: jest.fn(), error: jest.fn() },
            ledgerModel: ledger,
            failureModel: { create: jest.fn() },
          });

          const base = {
            transaction_id: transactionId.trim() || "fallback-id",
            sender_account_id: senderId.trim() || "fallback-source",
            receiver_account_id: "recv-1",
            amount_usd: 50,
            amount_original: 50,
            currency_original: "USD",
            timestamp: new Date("2026-01-01T00:00:00.000Z"),
            transaction_type: "WIRE",
            geolocation: { sender_country: "US", receiver_country: "GB" },
            channel: "ONLINE",
            device_id: "dev-1",
          };

          const variant = {
            ...base,
            sender_account_id: `  ${base.sender_account_id.toUpperCase()}  `,
            transaction_id: `  ${base.transaction_id.toUpperCase()}  `,
          };

          await repo.save(base);
          await repo.save(variant);

          const firstKey = ledger.findOneAndUpdate.mock.calls[0][0].idempotency_key;
          const secondKey = ledger.findOneAndUpdate.mock.calls[1][0].idempotency_key;

          expect(firstKey).toBe(secondKey);
        }
      ),
      { numRuns: 75 }
    );
  });

  test("missing idempotency components are always rejected", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom({}, { sender_account_id: "src-only" }, { transaction_id: "tx-only" }), async (payload) => {
        const repo = new TransactionRepository({
          model: { create: jest.fn() },
          emitter: { emit: jest.fn() },
          logger: { warn: jest.fn(), error: jest.fn() },
          ledgerModel: buildLedgerStub(),
          failureModel: { create: jest.fn() },
        });

        await expect(repo.save(payload)).rejects.toThrow("missing required idempotency key components");
      }),
      { numRuns: 25 }
    );
  });
});