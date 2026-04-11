const express = require("express");
const Transaction = require("../models/Transaction");
const Alert = require("../models/Alert");
const Case = require("../models/Case");

function createDashboardRoutes({ jwtMiddleware } = {}) {
    const router = express.Router();

    // NOTE: overview-metrics is intentionally public (no JWT) so the dashboard
    // can display live KPIs before / without a full auth flow. All mutation
    // endpoints are still protected by jwtMiddleware where needed.
    router.get("/overview-metrics", async (req, res) => {
        console.log("Dashboard overview-metrics request received");
        try {
            console.log("Fetching totalTxCount...");
            const totalTxCount = await Transaction.countDocuments({});
            
            console.log("Fetching totalVolumeResult...");
            const totalVolumeResult = await Transaction.aggregate([
                { $group: { _id: null, total: { $sum: "$amount_usd" } } }
            ]);

            console.log("Fetching suspiciousCount...");
            const suspiciousCount = await Alert.countDocuments({});

            console.log("Fetching highRiskAlerts...");
            const highRiskAlerts = await Alert.countDocuments({ risk_tier: "HIGH" });

            console.log("Fetching cases...");
            const cases = await Case.find({}).lean();

            console.log("Fetching recent alerts...");
            const recentAlerts = await Alert.find({}).sort({ created_at: -1 }).limit(5).lean();

            console.log("Dashboard metrics fetched successfully.");
            
            const totalVolume = totalVolumeResult.length > 0 ? totalVolumeResult[0].total : 0;
            
            // Calculate avg risk score from alerts
            const alerts = await Alert.find({}).select('risk_score').lean();
            const avgRiskScore = alerts.length > 0 
                ? alerts.reduce((acc, curr) => acc + (curr.risk_score || 0), 0) / alerts.length
                : 0;

            res.json({
                total_transactions: totalTxCount,
                total_volume: totalVolume,
                suspicious_count: suspiciousCount,
                high_risk_alerts: highRiskAlerts,
                avg_risk_score: Math.round(avgRiskScore * 10) / 10,
                cases_total: cases.length,
                cases_active: cases.filter(c => !c.state.startsWith('CLOSED')).length,
                recent_alerts: recentAlerts
            });
        } catch (err) {
            console.error("Dashboard metrics failed:", err);
            res.status(500).json({ error: "metrics_failed" });
        }
    });

    return router;
}

module.exports = createDashboardRoutes;
