const express = require("express");
const SystemConfig = require("../models/SystemConfig");
const AuditLog = require("../models/AuditLog");
const { requireRole } = require("../auth/RBACMiddleware");
const ConfigGovernanceService = require("../governance/ConfigGovernanceService");

function mapGovernanceError(error) {
    switch (error?.message) {
    case "metadata_required":
    case "metadata_scope_required":
    case "requested_config_required":
    case "approver_required":
    case "activator_required":
        return 400;
    case "self_approval_forbidden":
        return 403;
    case "change_not_found":
        return 404;
    case "approval_required":
    case "invalid_transition":
        return 409;
    default:
        return 500;
    }
}

function createAdminRoutes({
    jwtMiddleware,
    auditLogger = null,
    thresholdConfig,
    systemConfigModel = SystemConfig,
    auditLogModel = AuditLog,
    configGovernanceService = new ConfigGovernanceService({ systemConfigModel }),
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

            return res.json(change);
        } catch (error) {
            const code = mapGovernanceError(error);
            return res.status(code).json({ error: error.message });
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
