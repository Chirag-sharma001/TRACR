const mongoose = require("mongoose");

const STATUS = {
    DRAFT: "DRAFT",
    APPROVED: "APPROVED",
    ACTIVE: "ACTIVE",
    ROLLED_BACK: "ROLLED_BACK",
};

const metadataSchema = new mongoose.Schema(
    {
        reason: { type: String, required: true, trim: true },
        requester_id: { type: String, required: true, trim: true },
        change_scope: { type: [String], required: true, validate: [(v) => v.length > 0, "change_scope required"] },
        detector_scope: { type: [String], required: true, validate: [(v) => v.length > 0, "detector_scope required"] },
        risk_scope: { type: [String], required: true, validate: [(v) => v.length > 0, "risk_scope required"] },
    },
    { _id: false }
);

const transitionSchema = new mongoose.Schema(
    {
        from_status: { type: String, enum: Object.values(STATUS), required: true },
        to_status: { type: String, enum: Object.values(STATUS), required: true },
        actor_id: { type: String, required: true, trim: true },
        occurred_at: { type: Date, default: Date.now },
        note: { type: String, default: "" },
    },
    { _id: false }
);

const configChangeRequestSchema = new mongoose.Schema(
    {
        status: {
            type: String,
            enum: Object.values(STATUS),
            default: STATUS.DRAFT,
            required: true,
            index: true,
        },
        metadata: {
            type: metadataSchema,
            required: true,
        },
        requested_config: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
        },
        approved_by: {
            type: String,
            default: null,
        },
        approved_at: {
            type: Date,
            default: null,
        },
        activated_by: {
            type: String,
            default: null,
        },
        activated_at: {
            type: Date,
            default: null,
        },
        rolled_back_by: {
            type: String,
            default: null,
        },
        rolled_back_at: {
            type: Date,
            default: null,
        },
        transition_history: {
            type: [transitionSchema],
            default: [],
        },
    },
    {
        versionKey: false,
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

module.exports = mongoose.model("ConfigChangeRequest", configChangeRequestSchema);
module.exports.STATUS = STATUS;
