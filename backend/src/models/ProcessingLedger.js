const mongoose = require("mongoose");

const STATUS_VALUES = ["RECEIVED", "PROCESSING", "PROCESSED", "FAILED"];

const processingLedgerSchema = new mongoose.Schema(
  {
    idempotency_key: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    source_id: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    external_transaction_id: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    transaction_id: {
      type: String,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: STATUS_VALUES,
      required: true,
      default: "RECEIVED",
      index: true,
    },
    received_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
    processing_started_at: {
      type: Date,
      default: null,
    },
    processed_at: {
      type: Date,
      default: null,
    },
    failed_at: {
      type: Date,
      default: null,
      index: true,
    },
    failure_code: {
      type: String,
      default: null,
      trim: true,
    },
    failure_message: {
      type: String,
      default: null,
    },
  },
  {
    versionKey: false,
    timestamps: false,
  }
);

processingLedgerSchema.index({ source_id: 1, external_transaction_id: 1 }, { unique: true });

module.exports = mongoose.model("ProcessingLedger", processingLedgerSchema);