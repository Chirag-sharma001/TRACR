class CryptoConversionDetector {
    constructor(options = {}) {
        this.options = options;
    }

    evaluateCryptoConversion(graphManager, currentTx, options = {}) {
        if (currentTx.transaction_type !== "CRYPTO") {
            return null;
        }

        const windowHours = options.windowHours || 24;
        const middlemanId = currentTx.sender_account_id;
        const txAmount = Number(currentTx.amount_usd || currentTx.amount || 0);

        const incomingEdgesMap = graphManager.reverseAdjacency.get(middlemanId);
        if (!incomingEdgesMap) {
            return null;
        }
        
        const timestampMs = new Date(currentTx.timestamp).getTime();
        const cutoff = new Date(timestampMs - windowHours * 60 * 60 * 1000);

        let totalCashIn = 0;
        const cashSources = new Set();
        const cashTxs = [];

        for (const [from, edges] of incomingEdgesMap.entries()) {
            for (const edge of edges) {
                const edgeTime = new Date(edge.timestamp).getTime();
                if (edge.transaction_type === "CASH" && edgeTime >= cutoff.getTime() && edgeTime <= timestampMs) {
                    totalCashIn += Number(edge.amount || 0);
                    cashSources.add(from);
                    cashTxs.push(edge);
                }
            }
        }

        if (totalCashIn > 0 && totalCashIn > txAmount * 0.5) {
            return {
                pattern: "CASH_TO_CRYPTO",
                risk_score: 95,
                middleman: middlemanId,
                total_cash_in: totalCashIn,
                crypto_out: txAmount,
                details: `Account ${middlemanId} received ${totalCashIn} in CASH and converted ${txAmount} to CRYPTO within ${windowHours}h.`,
                related_txs: cashTxs.map(t => t.txId)
            };
        }

        return null;
    }
}

module.exports = CryptoConversionDetector;
