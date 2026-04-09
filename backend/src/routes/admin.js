const express = require("express");
const SystemConfig = require("../models/SystemConfig");
const AuditLog = require("../models/AuditLog");
const { requireRole } = require("../auth/RBACMiddleware");
const ConfigGovernanceService = require("../governance/ConfigGovernanceService");
const DetectionQualityMetrics = require("../observability/DetectionQualityMetrics");

function mapGovernanceError(error) {
    switch (error?.message) {
        case "metadata_required":
        case "metadata_scope_required":
        case "requested_config_required":
        case "approver_required":
        case "activator_required":
        case "rollback_actor_required":
        case "rollback_reason_required":
        case "original_change_id_required":
            return 400;
        case "self_approval_forbidden":
            return 403;
        case "change_not_found":
        case "original_change_not_found":
            return 404;
        case "approval_required":
        case "invalid_transition":
        case "original_change_not_approved":
            return 409;
        default:
            return 500;
    }
}

async function emitGovernanceAudit(auditLogger, req, event) {
    if (!auditLogger || typeof auditLogger.log !== "function") {
        return;
    }

    await auditLogger.log({
        userId: req.user.user_id,
        userRole: req.user.role,
        actionType: event.actionType,
        resourceType: "CONFIG_CHANGE",
        resourceId: event.resourceId,
        outcome: "SUCCESS",
        metadata: event.metadata,
        ipAddress: req.ip,
    });
}

function createAdminRoutes({
    jwtMiddleware,
    auditLogger = null,
    thresholdConfig,
    systemConfigModel = SystemConfig,
    auditLogModel = AuditLog,
    configGovernanceService = new ConfigGovernanceService({ systemConfigModel }),
    detectionQualityMetricsService = new DetectionQualityMetrics(),
} = {}) {
    const router = express.Router();

    const adminOnly = requireRole("ADMIN")({ auditLogger });

    router.use(jwtMiddleware, adminOnly);

    router.get("/config", async (req, res) => {
        const configs = await systemConfigModel.find({}).lean();
        return res.json(configs);
    });

    router.put("/config", async (_req, res) => {
        return res.status(410).json({
            error: "direct_config_mutation_disabled",
            hint: "use_governance_lifecycle_endpoints",
        });
    });

    router.post("/config/changes", async (req, res) => {
        try {
            const change = await configGovernanceService.submitChange({
                requester_id: req.user.user_id,
                reason: req.body?.reason,
                change_scope: req.body?.change_scope,
                detector_scope: req.body?.detector_scope,
                risk_scope: req.body?.risk_scope,
                requested_config: req.body?.requested_config,
            });

            await emitGovernanceAudit(auditLogger, req, {
                actionType: "CONFIG_SUBMIT",
                resourceId: change._id,
                metadata: {
                    reason: req.body?.reason,
                    requested_config: req.body?.requested_config,
                },
            });

            return res.status(201).json(change);
        } catch (error) {
            const code = mapGovernanceError(error);
            return res.status(code).json({ error: error.message });
        }
    });

    router.post("/config/changes/:id/approve", async (req, res) => {
        try {
            const change = await configGovernanceService.approveChange({
                change_id: req.params.id,
                approver_id: req.user.user_id,
                note: req.body?.note || "",
            });

            await emitGovernanceAudit(auditLogger, req, {
                actionType: "CONFIG_APPROVE",
                resourceId: change._id,
                metadata: {
                    note: req.body?.note || "",
                },
            });

            return res.json(change);
        } catch (error) {
            const code = mapGovernanceError(error);
            return res.status(code).json({ error: error.message });
        }
    });

    router.post("/config/changes/:id/activate", async (req, res) => {
        try {
            const change = await configGovernanceService.activateApprovedChange({
                change_id: req.params.id,
                activator_id: req.user.user_id,
                note: req.body?.note || "",
            });

            if (thresholdConfig && typeof thresholdConfig.reload === "function") {
                await thresholdConfig.reload();
            }

            await emitGovernanceAudit(auditLogger, req, {
                actionType: "CONFIG_ACTIVATE",
                resourceId: change._id,
                metadata: {
                    note: req.body?.note || "",
                },
            });

            return res.json(change);
        } catch (error) {
            const code = mapGovernanceError(error);
            return res.status(code).json({ error: error.message });
        }
    });

    router.post("/config/changes/:id/rollback", async (req, res) => {
        const rollbackReason = req.body?.rollback_reason;
        const originalChangeId = req.body?.original_change_id;

        if (!rollbackReason || !originalChangeId) {
            return res.status(400).json({ error: "rollback_reason_and_original_change_id_required" });
        }

        try {
            const change = await configGovernanceService.rollbackChange({
                change_id: req.params.id,
                rollback_actor_id: req.user.user_id,
                rollback_reason: rollbackReason,
                original_change_id: originalChangeId,
                note: req.body?.note || "",
            });

            if (thresholdConfig && typeof thresholdConfig.reload === "function") {
                await thresholdConfig.reload();
            }

            await emitGovernanceAudit(auditLogger, req, {
                actionType: "CONFIG_ROLLBACK",
                resourceId: change._id,
                metadata: {
                    rollback_reason: rollbackReason,
                    original_change_id: originalChangeId,
                },
            });

            return res.json(change);
        } catch (error) {
            const code = mapGovernanceError(error);
            return res.status(code).json({ error: error.message });
        }
    });

    router.get("/telemetry/detection-quality", async (req, res) => {
        const dayWindowDays = Math.min(31, Math.max(1, Number(req.query.day_window_days || 7)));
        const weekWindowWeeks = Math.min(12, Math.max(1, Number(req.query.week_window_weeks || 4)));

        try {
            const telemetry = await detectionQualityMetricsService.getDetectionQualityTelemetry({
                day_window_days: dayWindowDays,
                week_window_weeks: weekWindowWeeks,
            });
            return res.json(telemetry);
        } catch (error) {
            return res.status(500).json({ error: error.message || "telemetry_failed" });
        }
    });

    router.get("/audit", async (req, res) => {
        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));

        const query = {};
        if (req.query.start_date || req.query.end_date) {
            query.action_timestamp = {};
            if (req.query.start_date) query.action_timestamp.$gte = new Date(req.query.start_date);
            if (req.query.end_date) query.action_timestamp.$lte = new Date(req.query.end_date);
        }

        const [items, total] = await Promise.all([
            auditLogModel
                .find(query)
                .sort({ action_timestamp: 1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            auditLogModel.countDocuments(query),
        ]);

        return res.json({ page, limit, total, items });
    });

    return router;
}

module.exports = createAdminRoutes;
