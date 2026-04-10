const express = require("express");
const Transaction = require("../models/Transaction");
const ReplayService = require("../ingestion/ReplayService");
const { requireRole } = require("../auth/RBACMiddleware");

function createTransactionRoutes({
    validator,
    normalizer,
    repository,
    thresholdConfig = null,
    jwtMiddleware = null,
    transactionModel = Transaction,
    replayService = null,
} = {}) {
    const router = express.Router();

    const ingestMiddlewares = jwtMiddleware ? [jwtMiddleware] : [];
    router.post("/ingest", ...ingestMiddlewares, async (req, res) => {
        const validation = validator.validate(req.body);
        if (!validation.valid) {
            return res.status(400).json({ error: "validation_failed", details: validation.errors });
        }

        const normalized = normalizer.normalize(req.body, thresholdConfig);
        const saved = await repository.save(normalized);
        return res.status(202).json({ transaction_id: saved.transaction_id });
    });

    if (jwtMiddleware) {
        router.get("/:id", jwtMiddleware, async (req, res) => {
            const tx = await transactionModel.findOne({ transaction_id: req.params.id }).lean();
            if (!tx) {
                return res.status(404).json({ error: "not_found" });
            }
            return res.json(tx);
        });

        const recoveryRoleGate = requireRole("ADMIN", "MANAGER")();
        const replay = replayService || new ReplayService({ repository });

        router.get("/recovery/failed", jwtMiddleware, recoveryRoleGate, async (req, res) => {
            const from = req.query.from;
            const to = req.query.to;

            if (!from || !to) {
                return res.status(400).json({ error: "from_and_to_required" });
            }

            const fromDate = new Date(from);
            const toDate = new Date(to);
            if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
                return res.status(400).json({ error: "invalid_window" });
            }

            const maxWindowHours = 24;
            const windowMs = toDate.getTime() - fromDate.getTime();
            if (windowMs < 0) {
                return res.status(400).json({ error: "invalid_window" });
            }

            if (windowMs > maxWindowHours * 60 * 60 * 1000) {
                return res.status(400).json({ error: "replay_window_exceeded" });
            }

            const page = Math.max(1, Number(req.query.page || 1));
            const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));

            const result = await replay.listFailedItems({
                from,
                to,
                page,
                limit,
                operator_id: req.user.user_id,
            });

            return res.status(200).json(result);
        });

        router.post("/recovery/:failure_id/reprocess", jwtMiddleware, recoveryRoleGate, async (req, res) => {
            if (req.body?.trigger !== "operator") {
                return res.status(400).json({ error: "operator_trigger_required" });
            }

            try {
                const result = await replay.reprocessFailedItem({
                    failure_id: req.params.failure_id,
                    operator_id: req.user.user_id,
                    trigger: req.body?.trigger,
                });
                return res.status(200).json(result);
            } catch (error) {
                if (error.message === "failure_not_found") {
                    return res.status(404).json({ error: "failure_not_found" });
                }
                if (error.message === "operator_trigger_required") {
                    return res.status(400).json({ error: "operator_trigger_required" });
                }
                throw error;
            }
        });
    }

    return router;
}

module.exports = createTransactionRoutes;
