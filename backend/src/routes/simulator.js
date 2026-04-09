const express = require("express");
const TransactionSimulator = require("../simulator/TransactionSimulator");

function createSimulatorRoutes({ jwtMiddleware, auditLogger = null } = {}) {
    const router = express.Router();

    // Default configuration for the force-trigger simulator
    const sim = new TransactionSimulator({
        ingestUrl: `http://localhost:${process.env.PORT || 3000}/api/transactions/ingest`,
        // Start it turned off - we just use his generation functions
        smurfingEnabled: false,
        circularEnabled: false
    });

    router.post("/trigger-anomaly", jwtMiddleware, async (req, res) => {
        const { type } = req.body || {};
        
        try {
            if (type === "SMURFING") {
                const cluster = sim.generateSmurfingCluster();
                for (const tx of cluster) {
                    await sim.postTransaction(tx);
                }
                
                if (auditLogger) {
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

                if (auditLogger) {
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
                return res.status(400).json({ error: "invalid_type", valid_types: ["SMURFING", "CIRCULAR_TRADING"] });
            }
        } catch (err) {
            console.error("Force trigger failed:", err);
            return res.status(500).json({ error: "trigger_failed" });
        }
    });

    return router;
}

module.exports = createSimulatorRoutes;
