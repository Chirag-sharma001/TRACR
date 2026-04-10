require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

const eventBus = require("./events/eventBus");

const TransactionValidator = require("./ingestion/TransactionValidator");
const TransactionNormalizer = require("./ingestion/TransactionNormalizer");
const TransactionRepository = require("./ingestion/TransactionRepository");

const GraphManager = require("./detection/GraphManager");
const CycleDetector = require("./detection/CycleDetector");
const { SmurfingDetector } = require("./detection/SmurfingDetector");
const { BehavioralProfiler } = require("./detection/BehavioralProfiler");
const DetectionOrchestrator = require("./detection/DetectionOrchestrator");

const { thresholdConfig } = require("./scoring/ThresholdConfig");
const { seedDefaultConfig } = require("./scoring/seedDefaultConfig");
const RiskScorer = require("./scoring/RiskScorer");

const AuditLogger = require("./audit/AuditLogger");

const JWTMiddleware = require("./auth/JWTMiddleware");

const SARService = require("./sar/SARService");
const SARQueue = require("./sar/SARQueue");

const {
    createAuthRoutes,
    createTransactionRoutes,
    createAlertRoutes,
    createGraphRoutes,
    createCaseRoutes,
    createAdminRoutes,
    createDashboardRoutes,
    createSimulatorRoutes,
    createSARRoutes,
} = require("./routes");

const SocketGateway = require("./realtime/SocketGateway");

async function createServer() {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/intelligent_aml";
    const port = Number(process.env.PORT || 3000);

    try {
        await mongoose.connect(mongoUri, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log("Connected to primary MongoDB.");
    } catch (dbError) {
        console.warn("Failed to connect to primary MongoDB, falling back to local MemoryServer:", dbError.message);
        const { MongoMemoryServer } = require("mongodb-memory-server");
        const mongoServer = await MongoMemoryServer.create();
        const fallbackUri = mongoServer.getUri();
        await mongoose.connect(fallbackUri, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log("Connected to fallback memory MongoDB.");
    }

    await seedDefaultConfig();
    await thresholdConfig.initialize();

    const app = express();
    const httpServer = http.createServer(app);

    app.use(cors());
    app.use(express.json({ limit: "2mb" }));
    app.use(express.static(path.join(__dirname, "../../frontend-new/public")));
    app.get("/", (_req, res) => res.redirect("/app.html"));

    const auditLogger = new AuditLogger();
    const sarQueue = new SARQueue();
    const sarService = new SARService({ auditLogger, sarQueue });

    const validator = new TransactionValidator();
    const normalizer = new TransactionNormalizer();
    const repository = new TransactionRepository({ emitter: eventBus });

    const graphManager = new GraphManager({ thresholdConfig });
    await graphManager.bootstrap(thresholdConfig.get("cycle_time_window_hours", 72));
    setInterval(() => graphManager.pruneOldEdges(), 15 * 60 * 1000);

    const cycleDetector = new CycleDetector({ thresholdConfig });
    const smurfingDetector = new SmurfingDetector({ thresholdConfig });
    const behavioralProfiler = new BehavioralProfiler();
    const riskScorer = new RiskScorer({ thresholdConfig, emitter: eventBus });

    const orchestrator = new DetectionOrchestrator({
        graphManager,
        cycleDetector,
        smurfingDetector,
        behavioralProfiler,
        riskScorer,
        emitter: eventBus,
        thresholdConfig,
    });

    const jwtMiddleware = JWTMiddleware();

    app.use("/api/auth", createAuthRoutes({ auditLogger }));
    app.use(
        "/api/transactions",
        createTransactionRoutes({
            validator,
            normalizer,
            repository,
            thresholdConfig,
            jwtMiddleware,
        })
    );
    app.use("/api/alerts", createAlertRoutes({ jwtMiddleware, sarService, auditLogger }));
    app.use("/api", createGraphRoutes({ jwtMiddleware, graphManager }));
    app.use("/api/cases", createCaseRoutes({ jwtMiddleware, auditLogger }));
    app.use(
        "/api/admin",
        createAdminRoutes({
            jwtMiddleware,
            auditLogger,
            thresholdConfig,
        })
    );
    app.use("/api/dashboard", createDashboardRoutes({ jwtMiddleware }));
    app.use("/api/simulator", createSimulatorRoutes({ jwtMiddleware, auditLogger }));
    app.use("/api/sar", createSARRoutes({ jwtMiddleware, auditLogger }));

    app.get("/health", (_req, res) => {
        res.json({ ok: true });
    });

    const approvedOrigins = String(
        process.env.SOCKET_APPROVED_ORIGINS || process.env.CORS_ORIGIN || "http://localhost:3000,http://localhost:3001"
    )
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

    const socketGateway = new SocketGateway({
        httpServer,
        emitter: eventBus,
        sarQueue,
        corsOrigin: approvedOrigins,
        approvedOrigins,
    });
    socketGateway.start();

    eventBus.on("transaction:saved", async (tx) => {
        await behavioralProfiler.initializeBaseline(tx.sender_account_id);
        await behavioralProfiler.updateBaseline(tx.sender_account_id);
    });

    orchestrator.start();

    httpServer.listen(port, () => {
        console.log(`Backend server listening on port ${port}`);
    });

    return {
        app,
        httpServer,
        orchestrator,
        socketGateway,
    };
}

if (require.main === module) {
    createServer().catch((error) => {
        console.error("server_start_failed", error);
        process.exit(1);
    });
}

module.exports = {
    createServer,
};
