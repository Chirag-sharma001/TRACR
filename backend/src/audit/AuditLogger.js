const AuditLog = require("../models/AuditLog");

function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) {
        return value;
    }

    Object.freeze(value);
    for (const key of Object.keys(value)) {
        deepFreeze(value[key]);
    }
    return value;
}

function cloneMetadata(metadata) {
    try {
        return JSON.parse(JSON.stringify(metadata ?? {}));
    } catch (_error) {
        return { raw: String(metadata) };
    }
}

class AuditLogger {
    constructor({ auditLogModel = AuditLog, logger = console } = {}) {
        this.auditLogModel = auditLogModel;
        this.logger = logger;
    }

    async log({
        userId,
        userRole,
        actionType,
        resourceType,
        resourceId,
        outcome,
        metadata = {},
        ipAddress = null,
    }) {
        const immutableMetadata = deepFreeze(cloneMetadata(metadata));
        const doc = await this.auditLogModel.create({
            user_id: userId,
            user_role: userRole,
            action_type: actionType,
            resource_type: resourceType,
            resource_id: resourceId,
            action_timestamp: new Date(),
            outcome,
            metadata: immutableMetadata,
            ip_address: ipAddress,
        });

        return doc.toObject ? doc.toObject() : doc;
    }
}

module.exports = AuditLogger;
