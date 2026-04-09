const createTransactionRoutes = require("./transactions");
const { createAppWithJson, startServer, jsonRequest } = require("../testUtils/httpHarness");
const ReplayService = require("../ingestion/ReplayService");

function createHarness({ role = "ADMIN" } = {}) {
  const replayService = {
    listFailedItems: jest.fn(async () => ({
      items: [
        {
          failure_id: "507f1f77bcf86cd799439011",
          transaction_id: "tx-1",
          idempotency_key: "idem-1",
          failure_code: "PROCESSING_ERROR",
          failure_message: "event bus unavailable",
          failed_at: "2026-01-01T12:00:00.000Z",
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-01T23:00:00.000Z",
    })),
    reprocessFailedItem: jest.fn(async () => ({
      failure_id: "507f1f77bcf86cd799439011",
      transaction_id: "tx-1",
      idempotency_key: "idem-1",
      status: "replayed",
      duplicate_suppressed: true,
      replayed_at: "2026-01-01T12:05:00.000Z",
      operator_id: "operator-1",
    })),
  };

  const jwtMiddleware = (req, _res, next) => {
    req.user = { user_id: "operator-1", role };
    next();
  };

  const router = createTransactionRoutes({
    validator: { validate: jest.fn(() => ({ valid: true, errors: [] })) },
    normalizer: { normalize: jest.fn((v) => v) },
    repository: { save: jest.fn(async (v) => v) },
    replayService,
    jwtMiddleware,
  });

  return {
    app: createAppWithJson(router, "/api/transactions"),
    replayService,
  };
}

describe("Transactions replay route contracts (RED)", () => {
  test("ReplayService interface exposes list/reprocess methods", async () => {
    const service = new ReplayService({
      failureModel: {},
      ledgerModel: {},
      repository: {},
    });

    await expect(service.listFailedItems({})).rejects.toThrow("not_implemented");
    await expect(service.reprocessFailedItem({})).rejects.toThrow("not_implemented");
  });

  test("GET /recovery/failed enforces bounded from/to window and snake_case response", async () => {
    const { app, replayService } = createHarness({ role: "ADMIN" });
    const server = await startServer(app);

    try {
      const valid = await jsonRequest(
        server.baseUrl,
        "/api/transactions/recovery/failed?from=2026-01-01T00:00:00.000Z&to=2026-01-01T12:00:00.000Z&limit=20&page=1"
      );

      expect(valid.status).toBe(200);
      expect(valid.body).toEqual(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              failure_id: expect.any(String),
              idempotency_key: expect.any(String),
              failed_at: expect.any(String),
            }),
          ]),
          page: 1,
          limit: 20,
          total: expect.any(Number),
          from: expect.any(String),
          to: expect.any(String),
        })
      );
      expect(replayService.listFailedItems).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "2026-01-01T00:00:00.000Z",
          to: "2026-01-01T12:00:00.000Z",
          page: 1,
          limit: 20,
          operator_id: "operator-1",
        })
      );

      const missingBounds = await jsonRequest(server.baseUrl, "/api/transactions/recovery/failed");
      expect(missingBounds.status).toBe(400);
      expect(missingBounds.body).toEqual({ error: "from_and_to_required" });

      const unbounded = await jsonRequest(
        server.baseUrl,
        "/api/transactions/recovery/failed?from=2026-01-01T00:00:00.000Z&to=2026-01-04T00:00:00.000Z"
      );
      expect(unbounded.status).toBe(400);
      expect(unbounded.body).toEqual({ error: "replay_window_exceeded" });
    } finally {
      await server.close();
    }
  });

  test("POST /recovery/:failure_id/reprocess is explicit operator trigger and idempotent no-op safe", async () => {
    const { app, replayService } = createHarness({ role: "MANAGER" });
    const server = await startServer(app);

    try {
      const response = await jsonRequest(
        server.baseUrl,
        "/api/transactions/recovery/507f1f77bcf86cd799439011/reprocess",
        {
          method: "POST",
          body: { trigger: "operator" },
        }
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.objectContaining({
          failure_id: "507f1f77bcf86cd799439011",
          status: "replayed",
          duplicate_suppressed: true,
          replayed_at: expect.any(String),
          operator_id: "operator-1",
        })
      );

      expect(replayService.reprocessFailedItem).toHaveBeenCalledWith(
        expect.objectContaining({
          failure_id: "507f1f77bcf86cd799439011",
          operator_id: "operator-1",
        })
      );

      const nonOperator = await jsonRequest(
        server.baseUrl,
        "/api/transactions/recovery/507f1f77bcf86cd799439011/reprocess",
        {
          method: "POST",
          body: { trigger: "system" },
        }
      );

      expect(nonOperator.status).toBe(400);
      expect(nonOperator.body).toEqual({ error: "operator_trigger_required" });
    } finally {
      await server.close();
    }
  });

  test("recovery routes deny non-operator roles", async () => {
    const { app, replayService } = createHarness({ role: "ANALYST" });
    const server = await startServer(app);

    try {
      const list = await jsonRequest(
        server.baseUrl,
        "/api/transactions/recovery/failed?from=2026-01-01T00:00:00.000Z&to=2026-01-01T01:00:00.000Z"
      );
      expect(list.status).toBe(403);
      expect(list.body).toEqual({ error: "forbidden" });

      const replay = await jsonRequest(
        server.baseUrl,
        "/api/transactions/recovery/507f1f77bcf86cd799439011/reprocess",
        {
          method: "POST",
          body: { trigger: "operator" },
        }
      );
      expect(replay.status).toBe(403);
      expect(replay.body).toEqual({ error: "forbidden" });

      expect(replayService.listFailedItems).not.toHaveBeenCalled();
      expect(replayService.reprocessFailedItem).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });
});
