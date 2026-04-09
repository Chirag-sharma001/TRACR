const { randomUUID } = require("crypto");

const TX_TYPES = ["WIRE", "ACH", "CASH", "CRYPTO"];
const CHANNELS = ["MOBILE", "BRANCH", "ATM", "ONLINE"];
const COUNTRIES = ["US", "IN", "GB", "SG", "AE", "MX", "DE", "JP", "IR", "KP", "MM"];

class TransactionSimulator {
    constructor({
        ingestUrl = "http://localhost:3000/api/transactions/ingest",
        tps = 2,
        smurfingEnabled = true,
        circularEnabled = true,
        circularWindowHours = 72,
        logger = console,
    } = {}) {
        this.ingestUrl = ingestUrl;
        this.tps = Math.min(1000, Math.max(1, Number(tps) || 10));
        this.smurfingEnabled = smurfingEnabled;
        this.circularEnabled = circularEnabled;
        this.circularWindowHours = circularWindowHours;
        this.logger = logger;
        this.token = null;

        this.interval = null;
    }

    setToken(token) {
        this.token = token;
    }


    start() {
        if (this.interval) {
            this.logger.warn("simulator_already_running");
            return;
        }
        const periodMs = Math.max(1, Math.floor(1000 / this.tps));
        this.interval = setInterval(() => {
            this.emitTick().catch((error) => {
                this.logger.error("simulator_tick_failed", { message: error.message });
            });
        }, periodMs);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    async emitTick() {
        const tx = this.generateTransaction();
        await this.postTransaction(tx);

        if (this.smurfingEnabled && Math.random() < 0.03) {
            const cluster = this.generateSmurfingCluster();
            for (const item of cluster) {
                await this.postTransaction(item);
            }
        }

        if (this.circularEnabled && Math.random() < 0.02) {
            const chain = this.generateCircularChain();
            for (const item of chain) {
                await this.postTransaction(item);
            }
        }
    }

    generateTransaction() {
        const amount = this.#sampleAmount();
        const sender = this.#accountId();
        let receiver = this.#accountId();
        
        // Prevent Self-Loop
        while (receiver === sender) {
            receiver = this.#accountId();
        }

        return {
            transaction_id: randomUUID(),
            sender_account_id: sender,
            receiver_account_id: receiver,
            amount,
            currency: "USD",
            timestamp: new Date().toISOString(),
            transaction_type: this.#pick(TX_TYPES),
            geolocation: {
                sender_country: this.#pick(COUNTRIES),
                receiver_country: this.#pick(COUNTRIES),
            },
            channel: this.#pick(CHANNELS),
            device_id: this.#deviceId(),
            is_synthetic: true,
            pattern_tag: null,
        };
    }

    generateSmurfingCluster() {
        const count = this.#randInt(3, 15);
        const sender = this.#accountId();
        const receiverPool = Array.from({ length: this.#randInt(2, 6) }, () => {
            let id = this.#accountId();
            while (id === sender) id = this.#accountId();
            return id;
        });
        const start = Date.now();

        const cluster = [];
        for (let i = 0; i < count; i += 1) {
            cluster.push({
                transaction_id: randomUUID(),
                sender_account_id: sender,
                receiver_account_id: this.#pick(receiverPool),
                amount: this.#randInt(8500, 9950),
                currency: "USD",
                timestamp: new Date(start + this.#randInt(0, 60 * 60 * 1000)).toISOString(),
                transaction_type: this.#pick(TX_TYPES),
                geolocation: {
                    sender_country: this.#pick(COUNTRIES),
                    receiver_country: this.#pick(["IR", "KP", "MM"]),
                },
                channel: this.#pick(CHANNELS),
                device_id: this.#deviceId(),
                is_synthetic: true,
                pattern_tag: "SMURFING",
                metadata: { ground_truth: "SMURFING_TARGET" },
            });
        }

        return cluster;
    }

    generateCircularChain() {
        const length = this.#randInt(3, 6); // Min 3 for a proper cycle
        const nodes = [];
        const used = new Set();
        
        while (nodes.length < length) {
            const id = this.#accountId();
            if (!used.has(id)) {
                nodes.push(id);
                used.add(id);
            }
        }
        nodes.push(nodes[0]); // Cycle back

        const start = Date.now();
        const maxOffsetMs = this.circularWindowHours * 60 * 60 * 1000;

        const chain = [];
        for (let i = 0; i < length; i += 1) {
            chain.push({
                transaction_id: randomUUID(),
                sender_account_id: nodes[i],
                receiver_account_id: nodes[i + 1],
                amount: 15000,
                currency: "USD",
                timestamp: new Date(start + this.#randInt(0, maxOffsetMs)).toISOString(),
                transaction_type: this.#pick(TX_TYPES),
                geolocation: {
                    sender_country: this.#pick(COUNTRIES),
                    receiver_country: this.#pick(["IR", "KP", "MM"]),
                },
                channel: this.#pick(CHANNELS),
                device_id: this.#deviceId(),
                is_synthetic: true,
                pattern_tag: "CIRCULAR_TRADING",
                metadata: { ground_truth: "CIRCULAR_TARGET" },
                channel: this.#pick(CHANNELS),
                device_id: this.#deviceId(),
                is_synthetic: true,
                pattern_tag: "CIRCULAR_TRADING",
                metadata: { ground_truth: "CIRCULAR_TRADING_TARGET" },
            });
        }

        return chain;
    }

    async postTransaction(tx) {
        const headers = { "Content-Type": "application/json" };
        if (this.token) {
            headers["Authorization"] = `Bearer ${this.token}`;
        }

        try {
            // Added timeout to prevent simulator hanging on slow backend
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(this.ingestUrl, {
                method: "POST",
                headers,
                body: JSON.stringify(tx),
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (!response.ok) {
                this.logger.warn("simulator_post_failed", {
                    transaction_id: tx.transaction_id,
                    status: response.status,
                });
            }
        } catch (err) {
            this.logger.error("simulator_post_error", {
                transaction_id: tx.transaction_id,
                message: err.message
            });
        }
    }

    #sampleAmount() {
        if (Math.random() < 0.8) {
            return this.#randFloat(10, 4999);
        }
        return this.#randFloat(5000, 75000);
    }

    #accountId() {
        return `ACC-${this.#randInt(100000, 999999)}`;
    }

    #deviceId() {
        return `DEV-${this.#randInt(100000, 999999)}`;
    }

    #pick(values) {
        return values[this.#randInt(0, values.length - 1)];
    }

    #randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    #randFloat(min, max) {
        return Number((Math.random() * (max - min) + min).toFixed(2));
    }
}

module.exports = TransactionSimulator;
