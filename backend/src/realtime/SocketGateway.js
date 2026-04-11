const { Server } = require("socket.io");
const Alert = require("../models/Alert");
const Transaction = require("../models/Transaction");
const eventBus = require("../events/eventBus");

class SocketGateway {
  constructor({
    httpServer,
    alertModel = Alert,
    emitter = eventBus,
    sarQueue = null,
    corsOrigin = "*",
    approvedOrigins = ["*"],
    logger = console,
  } = {}) {
    this.httpServer = httpServer;
    this.alertModel = alertModel;
    this.emitter = emitter;
    this.sarQueue = sarQueue;
    this.corsOrigin = corsOrigin;
    this.approvedOrigins = Array.isArray(approvedOrigins) && approvedOrigins.length > 0
      ? approvedOrigins
      : ["*"];
    this.logger = logger;

    this.io = null;
    this.metricsInterval = null;
    this.txTimestamps = [];
    this.graphSubscriptions = new Map();

    this.boundOnAlertNew = this.onAlertNew.bind(this);
    this.boundOnAlertUpdated = this.onAlertUpdated.bind(this);
    this.boundOnTransactionSaved = this.onTransactionSaved.bind(this);
  }

  start() {
    this.io = new Server(this.httpServer, {
      cors: {
        origin: this.corsOrigin,
      },
    });

    this.io.on("connection", (socket) => {
      const origin = socket?.handshake?.headers?.origin || null;
      if (!this.#isApprovedOrigin(origin)) {
        socket.emit("connection:denied", { error: "forbidden_origin" });
        socket.disconnect(true);
        return;
      }

      const principal = this.#resolvePrincipal(socket);
      socket.data = socket.data || {};
      socket.data.principal = principal;
      this.graphSubscriptions.set(socket.id, new Set());

      socket.on("graph:subscribe", ({ accountId, channel_scope }) => {
        if (!this.#hasScope(principal, channel_scope || "GRAPH_READ")) {
          socket.emit("graph:denied", { error: "scope_forbidden" });
          return;
        }

        const room = this.#roomForAccount(accountId);
        socket.join(room);
        this.graphSubscriptions.get(socket.id).add(accountId);
      });

      socket.on("graph:unsubscribe", ({ accountId }) => {
        const room = this.#roomForAccount(accountId);
        socket.leave(room);
        const subs = this.graphSubscriptions.get(socket.id);
        if (subs) {
          subs.delete(accountId);
        }
      });

      socket.on("disconnect", () => {
        this.graphSubscriptions.delete(socket.id);
      });
    });

    this.emitter.on("alert:new", this.boundOnAlertNew);
    this.emitter.on("alert:updated", this.boundOnAlertUpdated);
    this.emitter.on("transaction:saved", this.boundOnTransactionSaved);

    this.metricsInterval = setInterval(() => {
      this.pushMetrics().catch((error) => {
        this.logger.error("metrics_push_failed", { message: error.message });
      });
    }, 5000);
  }

  stop() {
    this.emitter.off("alert:new", this.boundOnAlertNew);
    this.emitter.off("alert:updated", this.boundOnAlertUpdated);
    this.emitter.off("transaction:saved", this.boundOnTransactionSaved);

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    if (this.io) {
      this.io.close();
      this.io = null;
    }
  }

  onAlertNew(alertPayload) {
    if (!this.io) {
      return;
    }

    this.io.emit("alert:new", alertPayload);
  }

  onAlertUpdated(payload) {
    if (!this.io) {
      return;
    }

    this.io.emit("alert:updated", payload);
  }

  onTransactionSaved(tx) {
    this.txTimestamps.push(Date.now());
    this.#trimTxTimestamps();

    if (!this.io) {
      return;
    }

    // Broadcast full transaction to ALL connected clients (for live feed + KPI updates)
    this.io.emit("transaction:saved", {
      transaction_id: tx.transaction_id,
      sender_account_id: tx.sender_account_id,
      receiver_account_id: tx.receiver_account_id,
      amount_usd: tx.amount_usd,
      currency: tx.currency,
      geolocation: tx.geolocation,
      transaction_type: tx.transaction_type,
      timestamp: tx.timestamp,
      pattern_tag: tx.pattern_tag || null,
    });

    // Also emit graph:update to room-specific subscribers
    const update = {
      from: tx.sender_account_id,
      to: tx.receiver_account_id,
      amount: tx.amount_usd,
      timestamp: new Date(tx.timestamp).toISOString(),
      txId: tx.transaction_id,
    };

    this.io.to(this.#roomForAccount(tx.sender_account_id)).emit("graph:update", update);
    this.io.to(this.#roomForAccount(tx.receiver_account_id)).emit("graph:update", update);
  }

  async pushMetrics() {
    if (!this.io) {
      return;
    }

    this.#trimTxTimestamps();
    const tps = this.txTimestamps.length / 5;

    const alertCounts = await this.#alertCounts();

    const trend = await this.alertModel.aggregate([
      {
        $match: {
          created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: {
            hour: { $dateToString: { format: "%Y-%m-%dT%H:00:00Z", date: "$created_at" } },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.hour": 1 } },
    ]);

    // Add total volume + count for KPI cards
    const [totalTxCount, volumeResult, avgScoreResult] = await Promise.all([
      Transaction.countDocuments({}),
      Transaction.aggregate([{ $group: { _id: null, total: { $sum: "$amount_usd" } } }]),
      this.alertModel.aggregate([{ $group: { _id: null, avg: { $avg: "$risk_score" } } }]),
    ]);

    this.io.emit("metrics:update", {
      tps,
      alertCounts,
      trend,
      sarQueueDepth: this.sarQueue?.getDepth ? this.sarQueue.getDepth() : 0,
      total_transactions: totalTxCount,
      total_volume: volumeResult.length > 0 ? volumeResult[0].total : 0,
      avg_risk_score: avgScoreResult.length > 0 ? Math.round((avgScoreResult[0].avg || 0) * 10) / 10 : 0,
    });
  }

  async #alertCounts() {
    const grouped = await this.alertModel.aggregate([
      {
        $group: {
          _id: "$risk_tier",
          count: { $sum: 1 },
        },
      },
    ]);

    const counts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
    for (const row of grouped) {
      counts[row._id] = row.count;
    }
    return counts;
  }

  #trimTxTimestamps() {
    const cutoff = Date.now() - 5000;
    this.txTimestamps = this.txTimestamps.filter((ts) => ts >= cutoff);
  }

  #roomForAccount(accountId) {
    return `graph:${accountId}`;
  }

  #isApprovedOrigin(origin) {
    if (this.approvedOrigins.includes("*")) {
      return true;
    }

    if (!origin) {
      return false;
    }

    return this.approvedOrigins.includes(origin);
  }

  #resolvePrincipal(socket) {
    const auth = socket?.handshake?.auth || {};
    const role = String(auth.role || "UNKNOWN").toUpperCase();
    const channelScopes = Array.isArray(auth.channel_scopes)
      ? auth.channel_scopes.map((scope) => String(scope).toUpperCase())
      : [];

    const defaultScopesByRole = {
      ADMIN: ["GRAPH_READ", "METRICS_READ", "SAR_QUEUE_READ"],
      COMPLIANCE_MANAGER: ["GRAPH_READ", "METRICS_READ", "SAR_QUEUE_READ"],
      MANAGER: ["GRAPH_READ", "METRICS_READ"],
      INVESTIGATOR: ["GRAPH_READ"],
    };

    return {
      role,
      channel_scopes: channelScopes.length > 0
        ? channelScopes
        : (defaultScopesByRole[role] || []),
    };
  }

  #hasScope(principal, requiredScope) {
    const scope = String(requiredScope || "GRAPH_READ").toUpperCase();
    return Array.isArray(principal?.channel_scopes) && principal.channel_scopes.includes(scope);
  }
}

module.exports = SocketGateway;
