const ConfigChangeRequest = require("../models/ConfigChangeRequest");
const SystemConfig = require("../models/SystemConfig");

const GOVERNANCE_STATUS = ConfigChangeRequest.STATUS || {
    DRAFT: "DRAFT",
    APPROVED: "APPROVED",
    ACTIVE: "ACTIVE",
    ROLLED_BACK: "ROLLED_BACK",
};

function isNonEmptyArray(value) {
    return Array.isArray(value) && value.length > 0;
}

class ConfigGovernanceService {
    constructor({
        configChangeRequestModel = ConfigChangeRequest,
        systemConfigModel = SystemConfig,
        now = () => new Date(),
    } = {}) {
        this.configChangeRequestModel = configChangeRequestModel;
        this.systemConfigModel = systemConfigModel;
        this.now = now;
    }

    async submitChange({
        requester_id,
        reason,
        change_scope,
        detector_scope,
        risk_scope,
        requested_config,
    }) {
        if (!requester_id || !reason) {
            throw new Error("metadata_required");
        }

        if (!isNonEmptyArray(change_scope) || !isNonEmptyArray(detector_scope) || !isNonEmptyArray(risk_scope)) {
            throw new Error("metadata_scope_required");
        }

        if (!requested_config || !requested_config.config_key) {
            throw new Error("requested_config_required");
        }

        return this.configChangeRequestModel.create({
            status: GOVERNANCE_STATUS.DRAFT,
            metadata: {
                requester_id,
                reason,
                change_scope,
                detector_scope,
                risk_scope,
            },
            requested_config,
            transition_history: [],
        });
    }

    async approveChange({ change_id, approver_id, note = "" }) {
        if (!approver_id) {
            throw new Error("approver_required");
        }

        const change = await this.configChangeRequestModel.findById(change_id);
        if (!change) {
            throw new Error("change_not_found");
        }

        if (change.status !== GOVERNANCE_STATUS.DRAFT) {
            throw new Error("invalid_transition");
        }

        if (approver_id === change.metadata?.requester_id) {
            throw new Error("self_approval_forbidden");
        }

        const occurredAt = this.now();
        change.status = GOVERNANCE_STATUS.APPROVED;
        change.approved_by = approver_id;
        change.approved_at = occurredAt;
        change.transition_history = [
            ...(Array.isArray(change.transition_history) ? change.transition_history : []),
            {
                from_status: GOVERNANCE_STATUS.DRAFT,
                to_status: GOVERNANCE_STATUS.APPROVED,
                actor_id: approver_id,
                occurred_at: occurredAt,
                note,
            },
        ];

        await this.#persistChange(change);
        return change;
    }

    async activateApprovedChange({ change_id, activator_id, note = "" }) {
        if (!activator_id) {
            throw new Error("activator_required");
        }

        const change = await this.configChangeRequestModel.findById(change_id);
        if (!change) {
            throw new Error("change_not_found");
        }

        if (change.status !== GOVERNANCE_STATUS.APPROVED) {
            throw new Error("approval_required");
        }

        const requestedConfig = change.requested_config || {};
        const configKey = requestedConfig.config_key;

        if (!configKey) {
            throw new Error("requested_config_required");
        }

        const occurredAt = this.now();
        const configVersionId = `cfg:${change._id}:${occurredAt.toISOString()}`;

        await this.systemConfigModel.findOneAndUpdate(
            { config_key: configKey },
            {
                $set: {
                    value: requestedConfig.value,
                    updated_by: activator_id,
                    updated_at: occurredAt,
                    config_version_id: configVersionId,
                    published_change_id: change._id,
                },
            },
            { upsert: false, new: true }
        );

        change.status = GOVERNANCE_STATUS.ACTIVE;
        change.activated_by = activator_id;
        change.activated_at = occurredAt;
        change.transition_history = [
            ...(Array.isArray(change.transition_history) ? change.transition_history : []),
            {
                from_status: GOVERNANCE_STATUS.APPROVED,
                to_status: GOVERNANCE_STATUS.ACTIVE,
                actor_id: activator_id,
                occurred_at: occurredAt,
                note,
            },
        ];

        await this.#persistChange(change);
        return change;
    }

    async rollbackChange({
        change_id,
        rollback_actor_id,
        rollback_reason,
        original_change_id,
        note = "",
    }) {
        if (!rollback_actor_id) {
            throw new Error("rollback_actor_required");
        }
        if (!rollback_reason) {
            throw new Error("rollback_reason_required");
        }
        if (!original_change_id) {
            throw new Error("original_change_id_required");
        }

        const change = await this.configChangeRequestModel.findById(change_id);
        if (!change) {
            throw new Error("change_not_found");
        }

        const original = await this.configChangeRequestModel.findById(original_change_id);
        if (!original) {
            throw new Error("original_change_not_found");
        }

        if (![GOVERNANCE_STATUS.APPROVED, GOVERNANCE_STATUS.ACTIVE].includes(original.status)) {
            throw new Error("original_change_not_approved");
        }

        const originalConfig = original.requested_config || {};
        const configKey = originalConfig.config_key;

        if (!configKey) {
            throw new Error("requested_config_required");
        }

        const occurredAt = this.now();
        const configVersionId = `cfg:${change._id}:rollback:${occurredAt.toISOString()}`;

        await this.systemConfigModel.findOneAndUpdate(
            { config_key: configKey },
            {
                $set: {
                    value: originalConfig.value,
                    updated_by: rollback_actor_id,
                    updated_at: occurredAt,
                    config_version_id: configVersionId,
                    published_change_id: original._id,
                },
            },
            { upsert: false, new: true }
        );

        const previousStatus = change.status;
        change.status = GOVERNANCE_STATUS.ROLLED_BACK;
        change.rolled_back_by = rollback_actor_id;
        change.rolled_back_at = occurredAt;
        change.transition_history = [
            ...(Array.isArray(change.transition_history) ? change.transition_history : []),
            {
                from_status: previousStatus,
                to_status: GOVERNANCE_STATUS.ROLLED_BACK,
                actor_id: rollback_actor_id,
                occurred_at: occurredAt,
                note: note || rollback_reason,
            },
        ];

        await this.#persistChange(change);
        return change;
    }

    async #persistChange(change) {
        if (change && typeof change.save === "function") {
            await change.save();
            return;
        }

        if (typeof this.configChangeRequestModel.save === "function") {
            await this.configChangeRequestModel.save(change);
            return;
        }

        throw new Error("change_persistence_unavailable");
    }
}

module.exports = ConfigGovernanceService;
