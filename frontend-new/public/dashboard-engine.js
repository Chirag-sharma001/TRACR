/**
 * Sentinel Dashboard Engine
 * ════════════════════════════════════════════════════════════════════════════
 * Orchestrates real-time data flow between the backend and frontend UI.
 * Connects via Socket.io for live alerts and transactions.
 * Refreshes KPIs and Management views via REST APIs.
 */

const ENGINE_CONFIG = {
    BASE_URL: 'http://localhost:5000',
    API_PREFIX: '/api',
    AUTH_STORAGE_KEY: 'tracr_auth_token'
};

class DashboardEngine {
    constructor() {
        this.socket = null;
        this.metrics = {
            total_transactions: 0,
            total_volume: 0,
            suspicious_count: 0,
            high_risk_entities: 0,
            avg_risk_score: 0
        };
        this.alerts = [];
        this.isDevMode = true; // JWT disabled
    }

    async init() {
        console.log('--- SENTINEL ENGINE IGNITION ---');
        
        // 1. Hook Navigation
        this.patchNavigation();

        // 2. Connect Real-time Stream
        this.connectSocket();

        // 3. Initial Data Fetch
        try {
            await this.refreshData();

            // 4. Start Metric Pooling
            setInterval(() => this.refreshMetrics(), 10000);
        } catch (err) {
            console.error('Engine Init Error:', err);
        }
    }

    connectSocket() {
        console.log('Connecting to Sentinel Backbone via Socket.io...');
        this.socket = io(ENGINE_CONFIG.BASE_URL);

        this.socket.on('connect', () => {
            console.log('✅ Connected to Sentinel Backbone');
            if (window.toast) window.toast('Sentinel Intelligence Synchronized', 'success', 2000);
        });

        // Backend event is 'alert:new'
        this.socket.on('alert:new', (alert) => {
            console.log('🚩 New Alert Received:', alert);
            this.handleNewAlert(alert);
        });

        // Backend event is 'transaction:saved'
        this.socket.on('transaction:saved', (tx) => {
            this.handleLiveTransaction(tx);
        });

        // Real-time metric updates
        this.socket.on('metrics:update', (data) => {
            if (data.alertCounts) {
                this.metrics.suspicious_count = (data.alertCounts.LOW || 0) + (data.alertCounts.MEDIUM || 0) + (data.alertCounts.HIGH || 0);
                this.metrics.high_risk_entities = data.alertCounts.HIGH || 0;
                this.updateKPIs();
            }
        });

        this.socket.on('disconnect', () => {
            console.warn('❌ Disconnected from Backbone');
            if (window.toast) window.toast('Sentinel Connection Lost', 'error');
        });
    }

    async refreshData() {
        await Promise.all([
            this.refreshMetrics(),
            this.refreshAlerts(),
            this.refreshCases()
        ]);
    }

    async refreshMetrics() {
        try {
            const res = await fetch(`${ENGINE_CONFIG.BASE_URL}${ENGINE_CONFIG.API_PREFIX}/dashboard/overview-metrics`, {
                headers: this.getHeaders()
            });
            if (!res.ok) return;
            const data = await res.json();
            
            this.metrics = {
                total_transactions: data.total_transactions,
                total_volume: data.total_volume,
                suspicious_count: data.suspicious_count,
                high_risk_entities: data.high_risk_alerts,
                avg_risk_score: data.avg_risk_score
            };

            // Sync alerts if we don't have them yet
            if (data.recent_alerts && this.alerts.length === 0) {
                this.alerts = data.recent_alerts;
                this.renderAlerts();
            }
            
            this.updateKPIs();
        } catch (err) {
            console.error('Failed to refresh metrics:', err);
        }
    }

    async refreshAlerts() {
        try {
            const res = await fetch(`${ENGINE_CONFIG.BASE_URL}${ENGINE_CONFIG.API_PREFIX}/alerts?limit=20`, {
                headers: this.getHeaders()
            });
            if (!res.ok) return;
            const data = await res.json();
            this.alerts = Array.isArray(data) ? data : (data.alerts || []);
            this.renderAlerts();
        } catch (err) {
            console.error('Failed to refresh alerts:', err);
        }
    }

    handleNewAlert(alert) {
        this.alerts.unshift(alert);
        if (this.alerts.length > 20) this.alerts.pop();
        
        // Show toast for HIGH risk
        if (alert.risk_tier === 'HIGH') {
            if (window.toast) window.toast(`CRITICAL: ${this.formatPattern(alert.pattern_type)} Detected`, 'error', 5000);
        }
        
        this.renderAlerts();
        this.updateKPIs();
    }

    handleLiveTransaction(tx) {
        const feed = document.getElementById('live-feed');
        if (!feed) return;

        const row = document.createElement('div');
        row.className = 'grid grid-cols-12 px-6 py-4 border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer animate-in fade-in slide-in-from-left-2 duration-500';
        
        const riskColor = tx.amount_usd > 50000 ? 'bg-error' : 'bg-tertiary';
        
        row.innerHTML = `
            <div class="col-span-1 flex items-center"><div class="w-2 h-2 rounded-full ${riskColor} live-dot"></div></div>
            <div class="col-span-4 min-w-0">
                <p class="text-sm font-bold text-on-surface truncate">${tx.sender_account_id}</p>
                <p class="text-[10px] text-on-surface-variant font-mono truncate">${tx.transaction_id.slice(0, 8)}...</p>
            </div>
            <div class="col-span-2 flex items-center font-bold text-sm">$${tx.amount_usd.toLocaleString()}</div>
            <div class="col-span-2 flex items-center text-xs text-on-surface-variant">${tx.sender_country || 'Global'}</div>
            <div class="col-span-3 text-right text-[10px] text-on-surface-variant whitespace-nowrap">${new Date().toLocaleTimeString()}</div>
        `;

        feed.prepend(row);
        if (feed.children.length > 20) feed.lastElementChild.remove();
        
        this.metrics.total_volume = (this.metrics.total_volume || 0) + tx.amount_usd;
        this.updateKPIs();
    }

    renderAlerts() {
        const list = document.getElementById('alerts-list');
        if (!list) return;

        list.innerHTML = this.alerts.map(alert => {
            const title = this.formatPattern(alert.pattern_type);
            const riskColor = alert.risk_tier === 'HIGH' ? 'text-error' : 'text-secondary';
            const riskBg = alert.risk_tier === 'HIGH' ? 'bg-error-container' : 'bg-secondary/10';
            const timeAgo = this.timeAgo(alert.created_at || new Date());

            return `
            <div class="bg-surface-container-lowest p-4 rounded-lg flex gap-4 hover:shadow-md transition-shadow cursor-pointer" onclick="navigate('live')">
              <div class="w-10 h-10 rounded-full ${riskBg} flex-shrink-0 flex items-center justify-center">
                <span class="material-symbols-outlined ${riskColor} text-xl">${this.getIconForPattern(alert.pattern_type)}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start mb-0.5">
                  <p class="text-sm font-bold text-on-surface truncate">${title}</p>
                  <span class="text-[10px] text-on-surface-variant font-medium">${timeAgo}</span>
                </div>
                <p class="text-xs text-on-surface-variant truncate">Acct: ${alert.subject_account_id}</p>
                <div class="mt-2 flex items-center gap-2">
                    <span class="text-[9px] font-black uppercase tracking-widest ${riskColor}">${alert.risk_tier} RISK</span>
                    <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100">${Math.round(alert.risk_score)} Score</span>
                </div>
              </div>
            </div>
            `;
        }).join('');
    }

    updateKPIs() {
        const kpiTotal = document.getElementById('kpi-total-tx');
        const kpiSuspicious = document.getElementById('kpi-suspicious-vol');
        const kpiHigh = document.getElementById('kpi-high-risk');
        const kpiAvg = document.getElementById('kpi-avg-risk');

        if (kpiTotal) {
            const vol = this.metrics.total_volume || 0;
            if (vol >= 1000000) {
                kpiTotal.textContent = `$${(vol / 1000000).toFixed(2)}M`;
            } else if (vol >= 1000) {
                kpiTotal.textContent = `$${(vol / 1000).toFixed(1)}K`;
            } else {
                kpiTotal.textContent = `$${Math.round(vol).toLocaleString()}`;
            }
        }
        
        if (kpiSuspicious) kpiSuspicious.textContent = (this.metrics.suspicious_count || this.alerts.length).toLocaleString();
        if (kpiHigh) kpiHigh.textContent = (this.metrics.high_risk_entities || 0).toLocaleString();
        if (kpiAvg) kpiAvg.textContent = (this.metrics.avg_risk_score || 0).toLocaleString();
    }

    // ── Management Views ───────────────────────────────────────────────────

    async refreshCases() {
        try {
            const res = await fetch(`${ENGINE_CONFIG.BASE_URL}${ENGINE_CONFIG.API_PREFIX}/cases`, {
                headers: this.getHeaders()
            });
            if (!res.ok) return;
            const data = await res.json();
            this.renderCases(data.items || []);
        } catch (err) {
            console.error('Failed to refresh cases:', err);
        }
    }

    renderCases(cases) {
        const tableBody = document.getElementById('cases-table-body');
        if (!tableBody) return;

        // Update Case KPIs
        const total = cases.length;
        const unassigned = cases.filter(c => !c.assigned_to).length;
        const critical = cases.filter(c => c.escalation_state === 'BREACHED').length;

        const updateKPI = (id, val, barId) => {
            const el = document.getElementById(id);
            const bar = document.getElementById(barId);
            if (el) el.textContent = val;
            if (bar) bar.style.width = total > 0 ? `${(val / total) * 100}%` : '0%';
        };

        updateKPI('kpi-cases-total', total, 'kpi-cases-total-bar');
        updateKPI('kpi-cases-unassigned', unassigned, 'kpi-cases-unassigned-bar');
        updateKPI('kpi-cases-critical', critical, 'kpi-cases-critical-bar');

        tableBody.innerHTML = cases.map(c => `
            <tr class="hover:bg-surface-container-low/30 transition-colors group">
              <td class="px-6 py-5">
                <div class="flex flex-col"><span class="text-sm font-bold text-on-surface">${c.case_id.substring(0, 8).toUpperCase()}</span><span
                    class="text-xs text-on-surface-variant">${c.subject_account_id}</span></div>
              </td>
              <td class="px-6 py-5">
                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${this.getRiskClass(c.escalation_state)}">
                    <span class="w-1 h-1 rounded-full bg-current mr-1.5"></span>${c.escalation_state}
                </span>
              </td>
              <td class="px-6 py-5"><span class="text-xs font-semibold text-on-surface">${c.state}</span></td>
              <td class="px-6 py-5">
                <div class="flex items-center gap-2">
                  <div class="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700">
                    ${(c.assigned_to || 'UA').substring(0, 2).toUpperCase()}
                  </div>
                  <span class="text-xs font-medium">${c.assigned_to || 'Unassigned'}</span>
                </div>
              </td>
              <td class="px-6 py-5"><span class="text-xs text-on-surface-variant">${new Date(c.created_at).toLocaleDateString()}</span></td>
              <td class="px-6 py-5 text-right"><button class="material-symbols-outlined text-outline">more_vert</button></td>
            </tr>
        `).join('');
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    getHeaders() {
        return { 'Content-Type': 'application/json' };
    }

    getRiskClass(state) {
        if (state === 'BREACHED') return 'bg-error-container text-on-error-container';
        if (state === 'AT_RISK') return 'bg-secondary-container/10 text-secondary';
        return 'bg-tertiary-fixed text-on-tertiary-fixed-variant';
    }

    getIconForPattern(type) {
        if (!type) return 'flag';
        if (type.includes('CIRCULAR')) return 'loop';
        if (type.includes('SMURFING')) return 'groups';
        if (type.includes('BEHAVIORAL')) return 'psychology';
        return 'warning';
    }

    formatPattern(type) {
        if (!type) return 'Suspicious Flow';
        return type.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
    }

    timeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return new Date(date).toLocaleDateString();
    }

    patchNavigation() {
        const originalNavigate = window.navigate;
        if (typeof originalNavigate === 'function') {
            window.navigate = (page) => {
                originalNavigate(page);
                this.refreshData();
                if (page === 'live') setTimeout(() => this.renderAlerts(), 100);
            };
        }
        window.initLiveFeed = () => console.log('--- LIVE FEED HOOKED ---');
    }
}

// Ignition
document.addEventListener('DOMContentLoaded', () => {
    window.engine = new DashboardEngine();
    window.engine.init();
});
