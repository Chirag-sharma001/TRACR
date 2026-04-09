const { ProcessingFailure, ProcessingLedger } = require("../models");

const LEDGER_STATUS = {
  FAILED: "FAILED",
};

class ReplayService {
  constructor({
    failureModel = ProcessingFailure,
    ledgerModel = ProcessingLedger,
    repository,
    clock = () => new Date(),
    logger = console,
  } = {}) {
    this.failureModel = failureModel;
    this.ledgerModel = ledgerModel;
    this.repository = repository;
    this.clock = clock;
    this.logger = logger;
  }

  async listFailedItems({ from, to, page = 1, limit = 20 } = {}) {
    const query = {
      failed_at: {
        $gte: new Date(from),
        $lte: new Date(to),
      },
    };

    const [items, total] = await Promise.all([
      this.failureModel
        .find(query)
        .sort({ failed_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.failureModel.countDocuments(query),
    ]);

    return {
      items: items.map((item) => ({
        failure_id: String(item._id),
        transaction_id: item.transaction_id,
        idempotency_key: item.idempotency_key,
        failure_code: item.failure_code,
        failure_message: item.failure_message,
        failed_at: new Date(item.failed_at).toISOString(),
      })),
      page,
      limit,
      total,
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
    };
  }

  async reprocessFailedItem({ failure_id, operator_id, trigger }) {
    if (trigger !== "operator") {
      throw new Error("operator_trigger_required");
    }

    const failure = await this.failureModel.findById(failure_id).lean();
    if (!failure) {
      throw new Error("failure_not_found");
    }

    const ledger = await this.ledgerModel.findOne({ idempotency_key: failure.idempotency_key }).lean();

    if (!ledger || ledger.status !== LEDGER_STATUS.FAILED) {
      const replayedAt = this.clock();
      await this.failureModel.updateOne(
        { _id: failure._id },
        {
          $set: {
            replayed_at: replayedAt,
            replayed_by_operator_id: operator_id,
            replay_outcome: "noop_terminal_state",
          },
        }
      );

      return {
        failure_id,
        transaction_id: failure.transaction_id,
        idempotency_key: failure.idempotency_key,
        status: "noop",
        duplicate_suppressed: true,
        replayed_at: replayedAt.toISOString(),
        operator_id,
      };
    }

    await this.repository.save(failure.payload);

    const replayedAt = this.clock();
    await this.failureModel.updateOne(
      { _id: failure._id },
      {
        $set: {
          replayed_at: replayedAt,
          replayed_by_operator_id: operator_id,
          replay_outcome: "replayed",
        },
      }
    );

    this.logger.info("replay_completed", {
      failure_id,
      transaction_id: failure.transaction_id,
      operator_id,
    });

    return {
      failure_id,
      transaction_id: failure.transaction_id,
      idempotency_key: failure.idempotency_key,
      status: "replayed",
      duplicate_suppressed: true,
      replayed_at: replayedAt.toISOString(),
      operator_id,
    };
  }
}

module.exports = ReplayService;
