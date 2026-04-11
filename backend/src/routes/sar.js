const express = require("express");
const SARDraft = require("../models/SARDraft");

function createSARRoutes({ jwtMiddleware, auditLogger = null, sarModel = SARDraft } = {}) {
    const router = express.Router();

    router.get("/", jwtMiddleware, async (req, res) => {
        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
        
        const items = await sarModel
            .find({})
            .sort({ created_at: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
            
        return res.json({ items });
    });

    router.get("/:id", jwtMiddleware, async (req, res) => {
        const sar = await sarModel.findOne({ sar_id: req.params.id }).lean();
        if (!sar) {
            return res.status(404).json({ error: "not_found" });
        }
        return res.json(sar);
    });

    return router;
}

module.exports = createSARRoutes;
