const mongoose = require("mongoose");

const processingFailureSchema = new mongoose.Schema(
  {
    transaction_id: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    idempotency_key: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    failure_code: {
      type: String,
      required: true,
      trim: true,
    },
    failure_message: {
      type: String,
      default: null,
    },
    failed_at: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    replayed_at: {
      type: Date,
      default: null,
      index: true,
    },
    replayed_by_operator_id: {
      type: String,
      default: null,
      trim: true,
    },
    replay_outcome: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    versionKey: false,
    timestamps: false,
  }
);

processingFailureSchema.index({ idempotency_key: 1, failed_at: -1 });

module.exports = mongoose.model("ProcessingFailure", processingFailureSchema);