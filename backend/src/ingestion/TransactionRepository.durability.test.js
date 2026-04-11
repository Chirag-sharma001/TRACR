const TransactionRepository = require("./TransactionRepository");

describe("TransactionRepository durability contracts", () => {
  const tx = {
    transaction_id: "tx-1",
    sender_account_id: "acc-a",
    receiver_account_id: "acc-b",
    amount_usd: 250,
    amount_original: 250,
    currency_original: "USD",
    timestamp: new Date("2026-01-01T10:00:00.000Z"),
    transaction_type: "WIRE",
    geolocation: { sender_country: "US", receiver_country: "GB" },
    channel: "ONLINE",
    device_id: "dev-1",
  };

  function createLedgerFixture() {
    const byKey = new Map();

    return {
      byKey,
      findOne: jest.fn(async (query) => byKey.get(query.idempotency_key) || null),
      create: jest.fn(async (doc) => {
        if (byKey.has(doc.idempotency_key)) {
          const error = new Error("duplicate key");
          error.code = 11000;
          throw error;
        }

        const record = {
          ...doc,
          _id: `ledger-${byKey.size + 1}`,
          created_at: new Date(),
        };
        byKey.set(doc.idempotency_key, record);
        return record;
      }),
      findOneAndUpdate: jest.fn(async (query, update) => {
        const existing = byKey.get(query.idempotency_key);
        if (!existing) {
          return null;
        }

        if (query.status && query.status.$in && !query.status.$in.includes(existing.status)) {
          return null;
        }

        const next = {
          ...existing,
          ...update.$set,
        };
        byKey.set(query.idempotency_key, next);
        return next;
      }),
      updateOne: jest.fn(async (query, update) => {
        const existing = byKey.get(query.idempotency_key);
        if (!existing) {
          return { matchedCount: 0, modifiedCount: 0 };
        }

        const next = {
          ...existing,
          ...update.$set,
        };
        byKey.set(query.idempotency_key, next);
        return { matchedCount: 1, modifiedCount: 1 };
      }),
    };
  }

  test("duplicate submissions are suppressed and transaction:saved emits once", async () => {
    const ledger = createLedgerFixture();
    const model = {
      create: jest.fn(async (doc) => ({ ...doc, toObject: () => ({ ...doc }) })),
    };
    const failureModel = { create: jest.fn() };
    const emitter = { emit: jest.fn() };

    const repository = new TransactionRepository({
      model,
      emitter,
      logger: { warn: jest.fn(), error: jest.fn() },
      ledgerModel: ledger,
      failureModel,
    });

    const first = await repository.save(tx);
    const second = await repository.save(tx);

    expect(first.transaction_id).toBe(tx.transaction_id);
    expect(second.transaction_id).toBe(tx.transaction_id);
    expect(model.create).toHaveBeenCalledTimes(1);
    expect(emitter.emit).toHaveBeenCalledTimes(1);
    expect(failureModel.create).not.toHaveBeenCalled();
  });

  test("downstream failures are durably captured for replay", async () => {
    const ledger = createLedgerFixture();
    const model = {
      create: jest.fn(async (doc) => ({ ...doc, toObject: () => ({ ...doc }) })),
    };
    const failureModel = { create: jest.fn(async (doc) => doc) };
    const emitter = {
      emit: jest.fn(() => {
        throw new Error("event bus unavailable");
      }),
    };

    const repository = new TransactionRepository({
      model,
      emitter,
      logger: { warn: jest.fn(), error: jest.fn() },
      ledgerModel: ledger,
      failureModel,
    });

    await expect(repository.save(tx)).rejects.toThrow("event bus unavailable");

    expect(failureModel.create).toHaveBeenCalledTimes(1);
    expect(failureModel.create.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        transaction_id: tx.transaction_id,
        idempotency_key: expect.any(String),
        failure_code: "PROCESSING_ERROR",
        failed_at: expect.any(Date),
      })
    );
  });
});