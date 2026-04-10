const express = require("express");
const Case = require("../models/Case");
const Alert = require("../models/Alert");
const SARDraft = require("../models/SARDraft");
const { requireRole } = require("../auth/RBACMiddleware");
const { assertHumanDecisionGate } = require("../sar/AiAdvisoryPolicy");

const ALLOWED_TRANSITIONS = {
    OPEN: ["UNDER_REVIEW"],
    UNDER_REVIEW: ["ESCALATED", "CLOSED_DISMISSED"],
    ESCALATED: ["CLOSED_SAR_FILED", "CLOSED_DISMISSED"],
    CLOSED_SAR_FILED: [],
    CLOSED_DISMISSED: [],
};

const REGULATED_TRANSITIONS = new Set(["CLOSED_SAR_FILED", "CLOSED_DISMISSED"]);
const DEFAULT_SLA_HOURS = 24;
const AT_RISK_WINDOW_MS = 4 * 60 * 60 * 1000;
const DEFAULT_SAR_DEADLINE_DAYS = 30;
const SAR_UPCOMING_WINDOW_MS = 72 * 60 * 60 * 1000;
const SAR_AT_RISK_WINDOW_MS = 24 * 60 * 60 * 1000;

function computeEscalationState(slaStartedAt, slaDueAt, now = new Date()) {
    if (!slaStartedAt || !slaDueAt) {
        return "ON_TRACK";
    }

    const nowMs = now.getTime();
    const dueMs = new Date(slaDueAt).getTime();

    if (Number.isNaN(dueMs)) {
        return "ON_TRACK";
    }

    if (nowMs >= dueMs) {
        return "BREACHED";
    }

    if (dueMs - nowMs <= AT_RISK_WINDOW_MS) {
        return "AT_RISK";
    }

    return "ON_TRACK";
}

function ensureSlaTracking(c, assignee, now = new Date()) {
    c.assigned_to = assignee;

    if (!c.sla_started_at) {
        c.sla_started_at = now;
    }

    if (!c.sla_due_at) {
        c.sla_due_at = new Date(new Date(c.sla_started_at).getTime() + DEFAULT_SLA_HOURS * 60 * 60 * 1000);
    }

    c.escalation_state = computeEscalationState(c.sla_started_at, c.sla_due_at, now);
}

function normalizeCaseEscalation(c, now = new Date()) {
    if (!c) {
        return c;
    }

    return {
        ...c,
        escalation_state: computeEscalationState(c.sla_started_at, c.sla_due_at, now),
    };
}

function resolveSarDeadlineAt(c) {
    if (c?.sar_deadline_at) {
        return new Date(c.sar_deadline_at);
    }

    const anchor = c?.created_at ? new Date(c.created_at) : new Date();
    return new Date(anchor.getTime() + DEFAULT_SAR_DEADLINE_DAYS * 24 * 60 * 60 * 1000);
}

function computeSarDeadlineState(deadlineAt, now = new Date()) {
    const deadlineMs = new Date(deadlineAt).getTime();
    if (Number.isNaN(deadlineMs)) {
        return "UPCOMING";
    }

    const remaining = deadlineMs - now.getTime();

    if (remaining < 0) {
        return "BREACHED";
    }

    if (remaining <= SAR_AT_RISK_WINDOW_MS) {
        return "AT_RISK";
    }

    if (remaining <= SAR_UPCOMING_WINDOW_MS) {
        return "UPCOMING";
    }

    return "ON_TRACK";
}

async function findCaseById(caseModel, caseId, { lean = false } = {}) {
    const query = caseModel.findOne({ case_id: caseId });
    if (lean && query && typeof query.lean === "function") {
        return query.lean();
    }
    return query;
}

async function listCases(caseModel, query = {}) {
    const result = caseModel.find(query);
    if (result && typeof result.lean === "function") {
        return result.lean();
    }
    return result;
}

function createCaseRoutes({
    jwtMiddleware,
    auditLogger = null,
    caseModel = Case,
    alertModel = Alert,
    sarDraftModel = SARDraft,
    sarService = null,
} = {}) {
    const router = express.Router();
    const managerOnly = requireRole("MANAGER", "ADMIN", "COMPLIANCE_MANAGER")({ auditLogger });
    const sarSensitiveRoles = requireRole("INVESTIGATOR", "MANAGER", "ADMIN", "COMPLIANCE_MANAGER")({ auditLogger });

    router.post("/", jwtMiddleware, async (req, res) => {
        const { alert_id, subject_account_id, assigned_to } = req.body || {};
        if (!alert_id || !subject_account_id) {
            return res.status(400).json({ error: "missing_fields" });
        }

        const now = new Date();
        const hasAssignment = Boolean(assigned_to);
        const slaStartedAt = hasAssignment ? now : null;
        const slaDueAt = hasAssignment
            ? new Date(now.getTime() + DEFAULT_SLA_HOURS * 60 * 60 * 1000)
            : null;
        const sarDeadlineAt = new Date(now.getTime() + DEFAULT_SAR_DEADLINE_DAYS * 24 * 60 * 60 * 1000);

        const created = await caseModel.create({
            alert_id,
            subject_account_id,
            state: "OPEN",
            state_history: [
                {
                    from_state: null,
                    to_state: "OPEN",
                    reason_code: "INITIAL_CREATE",
                    changed_by: req.user.user_id,
                    changed_at: now,
                },
            ],
            assigned_to: assigned_to || null,
            sla_started_at: slaStartedAt,
            sla_due_at: slaDueAt,
            escalation_state: computeEscalationState(slaStartedAt, slaDueAt, now),
            sar_deadline_at: sarDeadlineAt,
        });

        if (auditLogger) {
            await auditLogger.log({
                userId: req.user.user_id,
                userRole: req.user.role,
                actionType: "CASE_CREATE",
                resourceType: "CASE",
                resourceId: created.case_id,
                outcome: "SUCCESS",
                ipAddress: req.ip,
            });
        }

        return res.status(201).json(created);
    });

    router.get("/oversight/dashboard", jwtMiddleware, managerOnly, async (req, res) => {
        const now = new Date();
        const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));

        const allCases = await listCases(caseModel, {});
        const activeCases = allCases
            .filter((c) => c.state !== "CLOSED_SAR_FILED" && c.state !== "CLOSED_DISMISSED")
            .map((c) => normalizeCaseEscalation(c, now));

        const triageRows = activeCases
            .map((c) => {
                const createdAt = new Date(c.created_at || now);
                const dueAt = c.sla_due_at ? new Date(c.sla_due_at) : null;
                const overdueMinutes = dueAt ? Math.max(0, Math.floor((now.getTime() - dueAt.getTime()) / 60000)) : 0;
                const backlogAgeHours = Math.max(0, Number(((now.getTime() - createdAt.getTime()) / 3600000).toFixed(2)));

                return {
                    case_id: c.case_id,
                    state: c.state,
                    assigned_to: c.assigned_to,
                    escalation_state: c.escalation_state,
                    sla_started_at: c.sla_started_at,
                    sla_due_at: c.sla_due_at,
                    backlog_age_hours: backlogAgeHours,
                    overdue_minutes: overdueMinutes,
                };
            })
            .sort((a, b) => {
                const rank = { BREACHED: 0, AT_RISK: 1, ON_TRACK: 2 };
                if (rank[a.escalation_state] !== rank[b.escalation_state]) {
                    return rank[a.escalation_state] - rank[b.escalation_state];
                }
                if (b.overdue_minutes !== a.overdue_minutes) {
                    return b.overdue_minutes - a.overdue_minutes;
                }
                return b.backlog_age_hours - a.backlog_age_hours;
            });

        const summary = {
            total_active: activeCases.length,
            unassigned_count: activeCases.filter((c) => !c.assigned_to).length,
            breached_count: activeCases.filter((c) => c.escalation_state === "BREACHED").length,
            at_risk_count: activeCases.filter((c) => c.escalation_state === "AT_RISK").length,
            on_track_count: activeCases.filter((c) => c.escalation_state === "ON_TRACK").length,
            avg_backlog_age_hours:
                activeCases.length === 0
                    ? 0
                    : Number(
                        (
                            triageRows.reduce((acc, row) => acc + row.backlog_age_hours, 0) /
                            activeCases.length
                        ).toFixed(2)
                    ),
        };

        return res.json({
            generated_at: now.toISOString(),
            summary,
            backlog: triageRows.slice(0, limit),
        });
    });

    router.get("/sar/deadlines", jwtMiddleware, managerOnly, async (req, res) => {
        const now = new Date();
        const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
        const allCases = await listCases(caseModel, {});

        const activeCases = allCases.filter((c) => c.state !== "CLOSED_SAR_FILED" && c.state !== "CLOSED_DISMISSED");
        const items = activeCases
            .map((c) => {
                const deadlineAt = resolveSarDeadlineAt(c);
                const deadlineState = computeSarDeadlineState(deadlineAt, now);
                const remainingHours = Number(((deadlineAt.getTime() - now.getTime()) / 3600000).toFixed(2));

                return {
                    case_id: c.case_id,
                    alert_id: c.alert_id,
                    assigned_to: c.assigned_to,
                    case_state: c.state,
                    sar_deadline_at: deadlineAt,
                    deadline_state: deadlineState,
                    remaining_hours: remainingHours,
                };
            })
            .filter((row) => row.deadline_state !== "ON_TRACK")
            .sort((left, right) => {
                const rank = { BREACHED: 0, AT_RISK: 1, UPCOMING: 2 };
                if (rank[left.deadline_state] !== rank[right.deadline_state]) {
                    return rank[left.deadline_state] - rank[right.deadline_state];
                }
                return left.remaining_hours - right.remaining_hours;
            });

        return res.json({
            generated_at: now.toISOString(),
            summary: {
                total_active: activeCases.length,
                breached_count: items.filter((row) => row.deadline_state === "BREACHED").length,
                at_risk_count: items.filter((row) => row.deadline_state === "AT_RISK").length,
                upcoming_count: items.filter((row) => row.deadline_state === "UPCOMING").length,
            },
            items: items.slice(0, limit),
        });
    });

    router.get("/:id", jwtMiddleware, async (req, res) => {
        const c = await findCaseById(caseModel, req.params.id, { lean: true });
        if (!c) {
            return res.status(404).json({ error: "not_found" });
        }
        return res.json(normalizeCaseEscalation(c));
    });

    router.patch("/:id/assignment", jwtMiddleware, async (req, res) => {
        const c = await findCaseById(caseModel, req.params.id);
        if (!c) {
            return res.status(404).json({ error: "not_found" });
        }

        const assignedTo = typeof req.body?.assigned_to === "string" ? req.body.assigned_to.trim() : "";
        if (!assignedTo) {
            return res.status(400).json({ error: "missing_fields" });
        }

        const now = new Date();
        ensureSlaTracking(c, assignedTo, now);
        await c.save();

        if (auditLogger) {
            await auditLogger.log({
                userId: req.user.user_id,
                userRole: req.user.role,
                actionType: "CASE_ASSIGN",
                resourceType: "CASE",
                resourceId: c.case_id,
                outcome: "SUCCESS",
                metadata: { assigned_to: assignedTo },
                ipAddress: req.ip,
            });
        }

        return res.json(c);
    });

    router.post("/:id/claim", jwtMiddleware, async (req, res) => {
        const c = await findCaseById(caseModel, req.params.id);
        if (!c) {
            return res.status(404).json({ error: "not_found" });
        }

        const now = new Date();
        ensureSlaTracking(c, req.user.user_id, now);
        await c.save();

        if (auditLogger) {
            await auditLogger.log({
                userId: req.user.user_id,
                userRole: req.user.role,
                actionType: "CASE_CLAIM",
                resourceType: "CASE",
                resourceId: c.case_id,
                outcome: "SUCCESS",
                metadata: { assigned_to: req.user.user_id },
                ipAddress: req.ip,
            });
        }

        return res.json(c);
    });

    router.get("/", jwtMiddleware, async (req, res) => {
        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
        const items = await caseModel
            .find({})
            .sort({ created_at: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
        return res.json({ items });
    });


    router.patch("/:id/state", jwtMiddleware, async (req, res) => {
        const c = await findCaseById(caseModel, req.params.id);
        if (!c) {
            return res.status(404).json({ error: "not_found" });
        }

        const { to_state, reason_code, decision_source } = req.body || {};
        if (!to_state || !reason_code) {
            return res.status(400).json({ error: "missing_fields" });
        }

        const allowed = ALLOWED_TRANSITIONS[c.state] || [];
        if (!allowed.includes(to_state)) {
            return res.status(400).json({ error: "invalid_transition" });
        }

        if (to_state === "CLOSED_SAR_FILED" && !c.sar_draft_id) {
            return res.status(400).json({ error: "sar_required" });
        }

        const noFileRationale = typeof req.body?.no_file_rationale === "string"
            ? req.body.no_file_rationale.trim()
            : "";
        if (to_state === "CLOSED_DISMISSED" && !noFileRationale) {
            return res.status(400).json({ error: "no_file_rationale_required" });
        }

        if (REGULATED_TRANSITIONS.has(to_state)) {
            try {
                assertHumanDecisionGate({
                    action: `CASE_${to_state}`,
                    decision_source,
                });
            } catch (error) {
                return res.status(error.status || 400).json({ error: error.code || "human_decision_required" });
            }
        }

        const fromState = c.state;
        c.state = to_state;
        if (to_state === "CLOSED_DISMISSED") {
            c.no_file_rationale = noFileRationale;
        }
        c.escalation_state = computeEscalationState(c.sla_started_at, c.sla_due_at);
        c.state_history.push({
            from_state: fromState,
            to_state,
            reason_code,
            changed_by: req.user.user_id,
            changed_at: new Date(),
        });

        await c.save();

        if (auditLogger) {
            await auditLogger.log({
                userId: req.user.user_id,
                userRole: req.user.role,
                actionType: "CASE_TRANSITION",
                resourceType: "CASE",
                resourceId: c.case_id,
                outcome: "SUCCESS",
                metadata: {
                    from_state: fromState,
                    to_state,
                    no_file_rationale: to_state === "CLOSED_DISMISSED" ? noFileRationale : null,
                },
                ipAddress: req.ip,
            });
        }

        return res.json(c);
    });

    router.post("/:id/notes", jwtMiddleware, async (req, res) => {
        const c = await findCaseById(caseModel, req.params.id);
        if (!c) {
            return res.status(404).json({ error: "not_found" });
        }

        const note = req.body?.note;
        if (!note) {
            return res.status(400).json({ error: "missing_note" });
        }

        c.notes.push({
            author_user_id: req.user.user_id,
            note,
            timestamp: new Date(),
        });

        await c.save();

        if (auditLogger) {
            await auditLogger.log({
                userId: req.user.user_id,
                userRole: req.user.role,
                actionType: "NOTE_ADD",
                resourceType: "CASE",
                resourceId: c.case_id,
                outcome: "SUCCESS",
                ipAddress: req.ip,
            });
        }

        return res.status(201).json(c.notes[c.notes.length - 1]);
    });

    router.post("/:id/sar/draft", jwtMiddleware, sarSensitiveRoles, async (req, res) => {
        if (!sarService || typeof sarService.generateSAR !== "function") {
            return res.status(501).json({ error: "sar_service_unavailable" });
        }

        const c = await findCaseById(caseModel, req.params.id);
        if (!c) {
            return res.status(404).json({ error: "not_found" });
        }

        const alertQuery = alertModel.findOne({ alert_id: c.alert_id });
        const alert = alertQuery && typeof alertQuery.lean === "function"
            ? await alertQuery.lean()
            : await alertQuery;
        if (!alert) {
            return res.status(404).json({ error: "alert_not_found" });
        }

        const draft = await sarService.generateSAR({
            alert,
            account: req.body?.account || null,
            generatedBy: req.user.user_id,
            caseId: c.case_id,
        });

        c.sar_draft_id = draft.sar_id;
        if (!c.sar_deadline_at) {
            c.sar_deadline_at = resolveSarDeadlineAt(c);
        }
        await c.save();

        if (auditLogger) {
            await auditLogger.log({
                userId: req.user.user_id,
                userRole: req.user.role,
                actionType: "CASE_SAR_DRAFT_GENERATE",
                resourceType: "CASE",
                resourceId: c.case_id,
                outcome: "SUCCESS",
                metadata: {
                    sar_id: draft.sar_id,
                    alert_id: c.alert_id,
                },
                ipAddress: req.ip,
            });
        }

        return res.status(202).json({
            case_id: c.case_id,
            sar_id: draft.sar_id,
            is_partial: Boolean(draft.is_partial),
            evidence_trace: draft.evidence_trace || null,
        });
    });

    router.post("/:id/sar/quality-check", jwtMiddleware, sarSensitiveRoles, async (req, res) => {
        if (!sarService || typeof sarService.evaluateDraftQuality !== "function") {
            return res.status(501).json({ error: "sar_service_unavailable" });
        }

        const c = await findCaseById(caseModel, req.params.id);
        if (!c) {
            return res.status(404).json({ error: "not_found" });
        }

        if (!c.sar_draft_id) {
            return res.status(400).json({ error: "sar_required" });
        }

        const draftQuery = sarDraftModel.findOne({ sar_id: c.sar_draft_id });
        const draft = draftQuery && typeof draftQuery.lean === "function"
            ? await draftQuery.lean()
            : await draftQuery;
        if (!draft) {
            return res.status(404).json({ error: "sar_not_found" });
        }

        const quality = sarService.evaluateDraftQuality(draft);

        if (auditLogger) {
            await auditLogger.log({
                userId: req.user.user_id,
                userRole: req.user.role,
                actionType: "CASE_SAR_QUALITY_CHECK",
                resourceType: "CASE",
                resourceId: c.case_id,
                outcome: "SUCCESS",
                metadata: {
                    sar_id: c.sar_draft_id,
                    ready_to_file: quality.ready_to_file,
                    quality_score: quality.quality_score,
                    issue_count: quality.issues.length,
                },
                ipAddress: req.ip,
            });
        }

        return res.json({
            case_id: c.case_id,
            sar_id: c.sar_draft_id,
            quality,
        });
    });

    return router;
}

module.exports = createCaseRoutes;
