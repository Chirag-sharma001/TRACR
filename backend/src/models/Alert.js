const mongoose = require("mongoose");
const { randomUUID } = require("crypto");

const scoreBreakdownSchema = new mongoose.Schema(
  {
    cycle_score: { type: Number, default: 0 },
    smurfing_score: { type: Number, default: 0 },
    behavioral_score: { type: Number, default: 0 },
    geographic_score: { type: Number, default: 0 },
    cycle_weight: { type: Number, default: 0.35 },
    smurfing_weight: { type: Number, default: 0.3 },
    behavioral_weight: { type: Number, default: 0.2 },
    geographic_weight: { type: Number, default: 0.15 },
  },
  { _id: false }
);

const deterministicEvidenceSchema = new mongoose.Schema(
  {
    pattern_type: {
      type: String,
      enum: ["CIRCULAR_TRADING", "SMURFING", "BEHAVIORAL_ANOMALY"],
      default: null,
    },
    transaction_ids: {
      type: [String],
      default: [],
    },
    involved_accounts: {
      type: [String],
      default: [],
    },
    transaction_sequence: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    window_metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { _id: false }
);

const rationaleMappingSchema = new mongoose.Schema(
  {
    summary: {
      type: String,
      default: null,
    },
    statements: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  { _id: false }
);

const explainabilityPacketSchema = new mongoose.Schema(
  {
    deterministic_evidence: {
      type: deterministicEvidenceSchema,
      default: () => ({}),
    },
    score_decomposition: {
      type: scoreBreakdownSchema,
      default: () => ({}),
    },
    narrative_mapping: {
      type: rationaleMappingSchema,
      default: () => ({}),
    },
    confidence_level: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      default: "LOW",
    },
  },
  { _id: false }
);

const precisionContextSchema = new mongoose.Schema(
  {
    segment: {
      type: String,
      default: "default",
    },
    pattern_type: {
      type: String,
      enum: ["CIRCULAR_TRADING", "SMURFING", "BEHAVIORAL_ANOMALY"],
      default: "BEHAVIORAL_ANOMALY",
    },
    geo_band: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      default: "LOW",
    },
    threshold_source: {
      type: String,
      default: "safe_defaults",
    },
    thresholds: {
      high: {
        type: Number,
        default: 70,
      },
      medium: {
        type: Number,
        default: 40,
      },
    },
  },
  { _id: false }
);

const alertSchema = new mongoose.Schema(
  {
    alert_id: {
      type: String,
      required: true,
      unique: true,
      default: () => randomUUID(),
      index: true,
    },
    pattern_type: {
      type: String,
      enum: ["CIRCULAR_TRADING", "SMURFING", "BEHAVIORAL_ANOMALY"],
      required: true,
      index: true,
    },
    subject_account_id: {
      type: String,
      required: true,
      index: true,
    },
    involved_accounts: {
      type: [String],
      default: [],
    },
    transaction_ids: {
      type: [String],
      default: [],
    },
    risk_score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      index: true,
    },
    risk_tier: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      required: true,
      index: true,
    },
    confidence_level: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      required: true,
      default: "LOW",
      index: true,
    },
    score_breakdown: {
      type: scoreBreakdownSchema,
      required: true,
    },
    explainability_packet: {
      type: explainabilityPacketSchema,
      required: true,
      default: () => ({}),
    },
    precision_context: {
      type: precisionContextSchema,
      required: true,
      default: () => ({}),
    },
    cycle_detail: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    smurfing_detail: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    behavioral_detail: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    xai_narrative: {
      type: String,
      default: null,
    },
    config_version_id: {
      type: String,
      default: null,
      index: true,
    },
    published_change_id: {
      type: String,
      default: null,
      index: true,
    },
    sar_draft_id: {
      type: String,
      default: null,
      index: true,
    },
    case_id: {
      type: String,
      default: null,
      index: true,
    },
  },
  {
    versionKey: false,
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

module.exports = mongoose.model("Alert", alertSchema);
