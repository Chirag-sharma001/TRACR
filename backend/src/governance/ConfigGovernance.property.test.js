const fc = require("fast-check");
const mongoose = require("mongoose");
const ConfigChangeRequest = require("../models/ConfigChangeRequest");
const ConfigGovernanceService = require("./ConfigGovernanceService");

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

describe("ConfigGovernanceService property tests", () => {
    function createServiceHarness() {
        const requestStore = new Map();
        let seq = 0;

        const configChangeRequestModel = {
            create: async (payload) => {
                seq += 1;
                const id = `change-${seq}`;
                const doc = {
                    _id: id,
                    ...payload,
                };
                requestStore.set(id, doc);
                return doc;
            },
            findById: async (id) => requestStore.get(id) || null,
            save: async (doc) => {
                requestStore.set(doc._id, doc);
                return doc;
            },
        };

        const systemConfigModel = {
            findOneAndUpdate: jest.fn(async (_q, update) => ({ ...update.$set })),
        };

        const service = new ConfigGovernanceService({
            configChangeRequestModel,
            systemConfigModel,
            now: () => new Date("2026-04-10T00:00:00Z"),
        });

        return { service, requestStore, systemConfigModel };
    }

    test("submit action stores metadata and returns a DRAFT request", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 80 }),
                fc.string({ minLength: 1, maxLength: 24 }),
                async (reason, requesterId) => {
                    const { service, requestStore } = createServiceHarness();

                    const created = await service.submitChange({
                        requester_id: requesterId,
                        reason,
                        change_scope: ["threshold"],
                        detector_scope: ["cycle"],
                        risk_scope: ["high"],
                        requested_config: {
                            config_key: "score_weight_cycle",
                            value: 0.42,
                        },
                    });

                    expect(created.status).toBe("DRAFT");
                    expect(created.metadata.requester_id).toBe(requesterId);
                    expect(created.metadata.reason).toBe(reason);
                    expect(requestStore.get(created._id)).toBeTruthy();
                }
            ),
            { numRuns: 30 }
        );
    });

    test("approve action rejects when approver equals requester", async () => {
        await fc.assert(
            fc.asyncProperty(fc.string({ minLength: 1, maxLength: 24 }), async (actorId) => {
                const { service } = createServiceHarness();
                const draft = await service.submitChange({
                    requester_id: actorId,
                    reason: "adjust scoring",
                    change_scope: ["threshold"],
                    detector_scope: ["smurfing"],
                    risk_scope: ["medium"],
                    requested_config: { config_key: "score_weight_smurfing", value: 0.31 },
                });

                await expect(
                    service.approveChange({ change_id: draft._id, approver_id: actorId })
                ).rejects.toThrow("self_approval_forbidden");
            }),
            { numRuns: 20 }
        );
    });

    test("activate action rejects unless request status is APPROVED", async () => {
        await fc.assert(
            fc.asyncProperty(fc.constantFrom("DRAFT", "ACTIVE", "ROLLED_BACK"), async (status) => {
                const { service, requestStore } = createServiceHarness();
                const draft = await service.submitChange({
                    requester_id: "admin-requester",
                    reason: "adjust thresholds",
                    change_scope: ["threshold"],
                    detector_scope: ["cycle"],
                    risk_scope: ["high"],
                    requested_config: { config_key: "score_weight_cycle", value: 0.39 },
                });

                const current = requestStore.get(draft._id);
                current.status = status;

                await expect(
                    service.activateApprovedChange({ change_id: draft._id, activator_id: "admin-ops" })
                ).rejects.toThrow("approval_required");
            }),
            { numRuns: 20 }
        );
    });

    test("transition history captures actor and timestamps in deterministic ordering", async () => {
        const { service, systemConfigModel } = createServiceHarness();
        const draft = await service.submitChange({
            requester_id: "req-1",
            reason: "raise cycle threshold",
            change_scope: ["threshold"],
            detector_scope: ["cycle"],
            risk_scope: ["high"],
            requested_config: { config_key: "cycle_threshold", value: 75 },
        });

        const approved = await service.approveChange({ change_id: draft._id, approver_id: "approver-1" });
        const activated = await service.activateApprovedChange({ change_id: draft._id, activator_id: "activator-1" });

        expect(approved.transition_history[0]).toEqual(
            expect.objectContaining({
                from_status: "DRAFT",
                to_status: "APPROVED",
                actor_id: "approver-1",
                occurred_at: expect.any(Date),
            })
        );

        expect(activated.transition_history[1]).toEqual(
            expect.objectContaining({
                from_status: "APPROVED",
                to_status: "ACTIVE",
                actor_id: "activator-1",
                occurred_at: expect.any(Date),
            })
        );

        expect(systemConfigModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
        expect(systemConfigModel.findOneAndUpdate).toHaveBeenCalledWith(
            { config_key: "cycle_threshold" },
            {
                $set: expect.objectContaining({
                    value: 75,
                    updated_by: "activator-1",
                    config_version_id: expect.any(String),
                    published_change_id: draft._id,
                }),
            },
            { upsert: false, new: true }
        );
    });
});
