const crypto = require("crypto");

const eventBus = require("../events/eventBus");
const {
  Transaction,
  ProcessingLedger,
  ProcessingFailure,
} = require("../models");

const LEDGER_STATUS = {
  RECEIVED: "RECEIVED",
  PROCESSING: "PROCESSING",
  PROCESSED: "PROCESSED",
  FAILED: "FAILED",
};

class TransactionRepository {
  constructor({
    model = Transaction,
    emitter = eventBus,
    logger = console,
    ledgerModel = ProcessingLedger,
    failureModel = ProcessingFailure,
  } = {}) {
    this.model = model;
    this.emitter = emitter;
    this.logger = logger;
    this.ledgerModel = ledgerModel;
    this.failureModel = failureModel;
  }

  async save(normalizedTx) {
    this.#validateIdempotencyInputs(normalizedTx);

    try {
      return await this.#saveOnce(normalizedTx);
    } catch (error) {
      if (!this.#isRetryablePersistenceError(error)) {
        throw error;
      }

      this.logger.warn("transaction_save_retry", {
        transaction_id: normalizedTx.transaction_id,
        reason: error.message,
      });

      await this.#sleep(100);
      return this.#saveOnce(normalizedTx);
    }
  }

  async #saveOnce(normalizedTx) {
    const { idempotencyKey, sourceId, externalTransactionId } = this.#deriveIdempotency(normalizedTx);
    const claim = await this.#claimProcessing({
      idempotencyKey,
      sourceId,
      externalTransactionId,
      transactionId: normalizedTx.transaction_id,
    });

    if (!claim.claimed) {
      return this.#loadDuplicatePayload(claim.ledger, normalizedTx);
    }

    try {
      const saved = await this.model.create(normalizedTx);
      const payload = saved.toObject ? saved.toObject() : saved;
      this.emitter.emit("transaction:saved", payload);

      await this.ledgerModel.updateOne(
        { idempotency_key: idempotencyKey },
        {
          $set: {
            status: LEDGER_STATUS.PROCESSED,
            processed_at: new Date(),
            transaction_id: payload.transaction_id,
            failed_at: null,
            failure_code: null,
            failure_message: null,
          },
        }
      );

      return payload;
    } catch (error) {
      await this.#recordFailure({
        idempotencyKey,
        transactionId: normalizedTx.transaction_id,
        payload: normalizedTx,
        error,
      });
      throw error;
    }
  }

  async #claimProcessing({ idempotencyKey, sourceId, externalTransactionId, transactionId }) {
    const now = new Date();

    try {
      await this.ledgerModel.create({
        idempotency_key: idempotencyKey,
        source_id: sourceId,
        external_transaction_id: externalTransactionId,
        transaction_id: transactionId,
        status: LEDGER_STATUS.RECEIVED,
        received_at: now,
      });
    } catch (error) {
      if (!this.#isDuplicateKeyError(error)) {
        throw error;
      }
    }

    const ledger = await this.ledgerModel.findOneAndUpdate(
      {
        idempotency_key: idempotencyKey,
        status: { $in: [LEDGER_STATUS.RECEIVED, LEDGER_STATUS.FAILED] },
      },
      {
        $set: {
          status: LEDGER_STATUS.PROCESSING,
          processing_started_at: now,
          transaction_id: transactionId,
          failure_code: null,
          failure_message: null,
          failed_at: null,
        },
      },
      { new: true }
    );

    if (ledger) {
      return { claimed: true, ledger };
    }

    const existing = await this.ledgerModel.findOne({ idempotency_key: idempotencyKey });
    return { claimed: false, ledger: existing };
  }

  async #loadDuplicatePayload(ledger, fallbackPayload) {
    if (ledger && ledger.transaction_id && typeof this.model.findOne === "function") {
      const existing = await this.model.findOne({ transaction_id: ledger.transaction_id });
      if (existing) {
        return existing.toObject ? existing.toObject() : existing;
      }
    }

    return fallbackPayload;
  }

  async #recordFailure({ idempotencyKey, transactionId, payload, error }) {
    const failedAt = new Date();

    await this.ledgerModel.updateOne(
      { idempotency_key: idempotencyKey },
      {
        $set: {
          status: LEDGER_STATUS.FAILED,
          failed_at: failedAt,
          failure_code: "PROCESSING_ERROR",
          failure_message: error.message,
        },
      }
    );

    await this.failureModel.create({
      transaction_id: transactionId,
      idempotency_key: idempotencyKey,
      failure_code: "PROCESSING_ERROR",
      failure_message: error.message,
      failed_at: failedAt,
      payload,
    });
  }

  #deriveIdempotency(normalizedTx) {
    const sourceId = String(normalizedTx.source_id || normalizedTx.sender_account_id || "")
      .trim()
      .toLowerCase();
    const externalTransactionId = String(
      normalizedTx.external_transaction_id || normalizedTx.transaction_id || ""
    )
      .trim()
      .toLowerCase();

    const idempotencyKey = crypto
      .createHash("sha256")
      .update(`${sourceId}::${externalTransactionId}`)
      .digest("hex");

    return { idempotencyKey, sourceId, externalTransactionId };
  }

  #validateIdempotencyInputs(normalizedTx) {
    const sourceId = String(normalizedTx.source_id || normalizedTx.sender_account_id || "").trim();
    const externalTransactionId = String(
      normalizedTx.external_transaction_id || normalizedTx.transaction_id || ""
    ).trim();

    if (!sourceId || !externalTransactionId) {
      throw new Error("missing required idempotency key components");
    }
  }

  #isRetryablePersistenceError(error) {
    if (!error) {
      return false;
    }

    if (this.#isDuplicateKeyError(error)) {
      return false;
    }

    const retryableNames = new Set([
      "MongoNetworkError",
      "MongoServerSelectionError",
      "MongoTimeoutError",
      "MongooseServerSelectionError",
    ]);
    const retryableCodes = new Set([6, 7, 89, 91, 112, 9001]);

    return retryableNames.has(error.name) || retryableCodes.has(error.code);
  }

  #isDuplicateKeyError(error) {
    return Boolean(error && error.code === 11000);
  }

  #sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = TransactionRepository;
