const express = require("express");
const TransactionSimulator = require("../simulator/TransactionSimulator");

// Optional no-op middleware — used when jwtMiddleware is not provided (demo/dev mode)
const passthrough = (_req, _res, next) => next();

function createSimulatorRoutes({ jwtMiddleware, auditLogger = null } = {}) {
    const router = express.Router();

    const sim = new TransactionSimulator({
        ingestUrl: `http://localhost:${process.env.PORT || 3000}/api/transactions/ingest`,
        smurfingEnabled: false,
        circularEnabled: false,
    });

    // Use jwtMiddleware if provided, otherwise allow unauthenticated access (demo mode)
    const auth = typeof jwtMiddleware === "function" ? jwtMiddleware : passthrough;

    router.post("/trigger-anomaly", auth, async (req, res) => {
        const { type } = req.body || {};

        try {
            if (type === "SMURFING") {
                const cluster = sim.generateSmurfingCluster();
                for (const tx of cluster) {
                    await sim.postTransaction(tx);
                }

                if (auditLogger && req.user) {
                    await auditLogger.log({
                        userId: req.user.user_id,
                        userRole: req.user.role,
                        actionType: "SIMULATOR_TRIGGER",
                        resourceType: "SIMULATOR",
                        resourceId: "SMURFING",
                        outcome: "SUCCESS",
                        ipAddress: req.ip,
                    });
                }

                return res.json({ ok: true, message: "Injected 1 Smurfing Cluster", count: cluster.length });

            } else if (type === "CIRCULAR_TRADING") {
                const chain = sim.generateCircularChain();
                for (const tx of chain) {
                    await sim.postTransaction(tx);
                }

                if (auditLogger && req.user) {
                    await auditLogger.log({
                        userId: req.user.user_id,
                        userRole: req.user.role,
                        actionType: "SIMULATOR_TRIGGER",
                        resourceType: "SIMULATOR",
                        resourceId: "CIRCULAR_TRADING",
                        outcome: "SUCCESS",
                        ipAddress: req.ip,
                    });
                }

                return res.json({ ok: true, message: "Injected 1 Circular Trading Loop", count: chain.length });

            } else {
                return res.status(400).json({
                    error: "invalid_type",
                    valid_types: ["SMURFING", "CIRCULAR_TRADING"],
                });
            }
        } catch (err) {
            console.error("Force trigger failed:", err);
            return res.status(500).json({ error: "trigger_failed", detail: err.message });
        }
    });

    return router;
}

module.exports = createSimulatorRoutes;
