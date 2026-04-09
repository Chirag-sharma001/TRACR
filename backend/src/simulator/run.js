const TransactionSimulator = require("./TransactionSimulator");

const tpsBase = process.env.TPS ? parseInt(process.env.TPS, 10) : 10;
const tpsBurst = 100;
const burstDurationMs = 30000;

const simulator = new TransactionSimulator({
    ingestUrl: process.env.API_BASE ? `${process.env.API_BASE}/api/transactions/ingest` : "http://localhost:3000/api/transactions/ingest",
    tps: tpsBase,
    smurfingEnabled: true,
    circularEnabled: true,
    circularWindowHours: 72,
    logger: console
});

console.log(`Starting Transaction Simulator...`);
console.log(`Target: ${simulator.ingestUrl} | Normal TPS: ${simulator.tps}`);

async function boostrap() {
    try {
        console.log("Authenticating simulator...");
        const authRes = await fetch("http://localhost:3000/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "admin", password: "Password123!" }),
        });

        if (!authRes.ok) throw new Error("Auth failed");
        const { token } = await authRes.json();
        simulator.setToken(token);
        console.log("Authenticated successfully.");
        
        simulator.start();
    } catch (err) {
        console.error("Simulator failed to start (auth error):", err.message);
        process.exit(1);
    }
}

boostrap();

// Burst Mode Simulation Function
function triggerBurst() {
    console.log(`\n🚨 [BURST MODE ACTIVATED] Scaling TPS to ${tpsBurst} for ${burstDurationMs / 1000} seconds! 🚨\n`);
    
    // Stop the original interval
    simulator.stop();
    // Update TPS
    simulator.tps = tpsBurst;
    // Restart
    simulator.start();

    // Revert back after duration
    setTimeout(() => {
        console.log(`\n📉 [BURST MODE CONCLUDED] Reverting TPS to ${tpsBase}... 📉\n`);
        simulator.stop();
        simulator.tps = tpsBase;
        simulator.start();
    }, burstDurationMs);
}

// Automatically trigger bursts occasionally (every 3 minutes)
setInterval(() => {
    triggerBurst();
}, 3 * 60 * 1000);

// You can also manually call triggerBurst via some UI, but this suffices for the script.

process.on("SIGINT", () => {
    simulator.stop();
    console.log("Transaction Simulator stopped.");
    process.exit(0);
});
