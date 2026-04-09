const fc = require("fast-check");
const mongoose = require("mongoose");
const ConfigChangeRequest = require("../models/ConfigChangeRequest");

// Feature: intelligent-aml-framework, Property GOV-03: Governance lifecycle metadata contract

describe("Config governance lifecycle contract property tests", () => {
    afterAll(async () => {
        delete mongoose.connection.models.ConfigChangeRequest;
    });

    test("draft requests always require structured metadata fields", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 64 }),
                fc.string({ minLength: 1, maxLength: 32 }),
                fc.array(fc.string({ minLength: 1, maxLength: 24 }), { minLength: 1, maxLength: 5 }),
                fc.array(fc.string({ minLength: 1, maxLength: 24 }), { minLength: 1, maxLength: 5 }),
                fc.array(fc.string({ minLength: 1, maxLength: 24 }), { minLength: 1, maxLength: 5 }),
                async (reason, requesterId, changeScope, detectorScope, riskScope) => {
                    const doc = new ConfigChangeRequest({
                        metadata: {
                            reason,
                            requester_id: requesterId,
                            change_scope: changeScope,
                            detector_scope: detectorScope,
                            risk_scope: riskScope,
                        },
                        requested_config: { score_weight_cycle: 0.4 },
                    });

                    const err = doc.validateSync();
                    expect(err).toBeUndefined();
                    expect(doc.status).toBe("DRAFT");
                }
            ),
            { numRuns: 60 }
        );
    });

    test("lifecycle status is always one of the allowed governance states", async () => {
        await fc.assert(
            fc.asyncProperty(fc.constantFrom("DRAFT", "APPROVED", "ACTIVE", "ROLLED_BACK"), async (status) => {
                const doc = new ConfigChangeRequest({
                    status,
                    metadata: {
                        reason: "periodic tuning",
                        requester_id: "admin-1",
                        change_scope: ["threshold"],
                        detector_scope: ["cycle"],
                        risk_scope: ["high"],
                    },
                    requested_config: { score_weight_cycle: 0.41 },
                });

                const err = doc.validateSync();
                expect(err).toBeUndefined();
                expect(["DRAFT", "APPROVED", "ACTIVE", "ROLLED_BACK"]).toContain(doc.status);
            }),
            { numRuns: 40 }
        );
    });
});
