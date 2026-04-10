/**
 * Sentinel Dashboard Engine
 * ════════════════════════════════════════════════════════════════════════════
 * Orchestrates real-time data flow between the backend and frontend UI.
 * Connects via Socket.io for live alerts and transactions.
 * Refreshes KPIs and Management views via REST APIs.
 *
 * Requires: api-client.js (loaded before this script)
 */

const ENGINE_CONFIG = {
    BASE_URL: 'http://localhost:5000',    // ← Fixed: was 5000
    AI_BASE_URL: 'http://localhost:8000', // FastAPI AI agents
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
        this.cases = [];
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

            // 4. Start Metric Polling every 10s
            setInterval(() => this.refreshMetrics(), 10000);
        } catch (err) {
            console.error('Engine Init Error:', err);
        }
    }

    // ── Auth Header Builder ───────────────────────────────────────────────────
    getHeaders() {
        const token = (window.Auth && window.Auth.getToken())
            || localStorage.getItem(ENGINE_CONFIG.AUTH_STORAGE_KEY)
            || null;
        return {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        };
    }

    // ── Socket.io Realtime ────────────────────────────────────────────────────
    connectSocket() {
        console.log('Connecting to Sentinel Backbone via Socket.io...');
        try {
            this.socket = io(ENGINE_CONFIG.BASE_URL, {
                transports: ['websocket', 'polling'],
            });

            this.socket.on('connect', () => {
                console.log('✅ Connected to Sentinel Backbone');
                if (window.toast) window.toast('Sentinel Intelligence Synchronized', 'success', 2000);
            });

            // Live alert from detection engine
            this.socket.on('alert:new', (alert) => {
                console.log('🚩 New Alert Received:', alert);
                this.handleNewAlert(alert);
            });

            // Live transaction event
            this.socket.on('transaction:saved', (tx) => {
                this.handleLiveTransaction(tx);
            });

            // Metric push from backend
            this.socket.on('metrics:update', (data) => {
                if (data.alertCounts) {
                    this.metrics.suspicious_count = (data.alertCounts.LOW || 0) + (data.alertCounts.MEDIUM || 0) + (data.alertCounts.HIGH || 0);
                    this.metrics.high_risk_entities = data.alertCounts.HIGH || 0;
                }
                if (data.total_transactions != null) this.metrics.total_transactions = data.total_transactions;
                if (data.total_volume != null) this.metrics.total_volume = data.total_volume;
                if (data.avg_risk_score != null) this.metrics.avg_risk_score = data.avg_risk_score;
                this.updateKPIs();
            });

            this.socket.on('disconnect', () => {
                console.warn('❌ Disconnected from Backbone');
                if (window.toast) window.toast('Sentinel Connection Lost', 'warn');
            });

            this.socket.on('connect_error', (err) => {
                console.warn('Socket connection error:', err.message);
            });
        } catch (err) {
            console.warn('Socket.io not available:', err.message);
        }
    }

    // ── Data Refresh ──────────────────────────────────────────────────────────
    async refreshData() {
        await Promise.allSettled([
            this.refreshMetrics(),
            this.refreshAlerts(),
            this.refreshCases(),
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

            if (data.recent_alerts && data.recent_alerts.length > 0 && this.alerts.length === 0) {
                this.alerts = data.recent_alerts;
                this.renderAlerts();
                this.updateBehavioral(); 
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
            // API returns { page, limit, total, items: [...] }
            this.alerts = Array.isArray(data) ? data : (data.items || data.alerts || []);
            this.renderAlerts();
            this.updateBehavioral();
        } catch (err) {
            console.warn('Failed to refresh alerts (may need auth):', err.message);
        }
    }

    async refreshCases() {
        try {
            const res = await fetch(`${ENGINE_CONFIG.BASE_URL}${ENGINE_CONFIG.API_PREFIX}/cases`, {
                headers: this.getHeaders()
            });
            if (!res.ok) return;
            const data = await res.json();
            this.cases = data.items || [];
            this.renderCases(this.cases);
        } catch (err) {
            console.warn('Failed to refresh cases (may need auth):', err.message);
        }
    }

    // ── Live Event Handlers ───────────────────────────────────────────────────
    handleNewAlert(alert) {
        this.alerts.unshift(alert);
        if (this.alerts.length > 20) this.alerts.pop();

        const badge = document.getElementById('notification-badge');
        if (badge) badge.classList.remove('hidden');

        this.renderAlerts();
        this.updateKPIs();
        this.updateBehavioral(alert);
    }

    updateBehavioral(latestAlert) {
        // ── Behavioral Alerts counter ─────────────────────────────
        const behavioralAlerts = this.alerts.filter(a =>
            a.pattern_type && (
                a.pattern_type.includes('BEHAVIORAL') ||
                a.pattern_type.includes('SMURFING') ||
                a.pattern_type.includes('CIRCULAR') ||
                a.pattern_type.includes('CRYPTO')
            )
        );
        const alertCountEl = document.getElementById('behavioral-kpi-alerts');
        if (alertCountEl) alertCountEl.textContent = behavioralAlerts.length;

        // ── Risk Divergence: scale with alert count ────────────────
        const divergenceEl = document.getElementById('behavioral-kpi-divergence');
        const divergenceLabelEl = document.getElementById('behavioral-kpi-divergence-label');
        if (divergenceEl) {
            const pct = Math.min(200, 40 + this.alerts.length * 1.5);
            divergenceEl.textContent = `+${pct.toFixed(1)}%`;
        }
        if (divergenceLabelEl) {
            divergenceLabelEl.textContent = this.alerts.length > 10 ? 'Critical' : this.alerts.length > 5 ? 'Elevated' : 'Abnormal';
        }

        // ── Radar chart: animate points based on pattern types ────
        const radar = document.getElementById('behavioral-radar-current');
        if (radar) {
            // 5 axes: Velocity (top), Volume (right), Diversity (bottom-right),
            //         Jurisdiction (bottom-left), Cadence (left)
            // Base = 50,5  95,45  80,95  10,75  5,40
            // Pull each axis based on alert type count
            const smurfing = this.alerts.filter(a => a.pattern_type?.includes('SMURFING')).length;
            const circular = this.alerts.filter(a => a.pattern_type?.includes('CIRCULAR')).length;
            const crypto   = this.alerts.filter(a => a.pattern_type?.includes('CRYPTO')).length;
            const total    = this.alerts.length;

            const scale = v => Math.max(5, Math.min(95, v));
            // Velocity (y goes smaller = further up = more extreme)
            const velY  = scale(5 + Math.max(0, 15 - smurfing * 2));
            // Volume (x goes larger = further right)
            const volX  = scale(80 + Math.min(15, circular * 3));
            // Diversity
            const divX  = scale(70 + Math.min(20, crypto * 4));
            const divY  = scale(95 - Math.min(20, total));
            // Jurisdiction
            const jurX  = scale(20 - Math.min(15, circular * 2));
            // Cadence
            const cadX  = scale(5 - Math.min(3, smurfing));
            const cadY  = scale(40 - Math.min(20, total));

            radar.setAttribute('points',
                `50,${velY} ${volX},45 ${divX},${divY} ${jurX},80 ${cadX},${cadY}`
            );
        }

        // ── Anomaly Drivers: jitter values for "live" feel ────────
        const freqPctEl = document.getElementById('behavioral-freq-pct');
        const freqBarEl = document.getElementById('behavioral-freq-bar');
        const valPctEl  = document.getElementById('behavioral-freq-pct'); // Wait, fixed below
        const frequency = Math.min(300, 150 + this.alerts.length * 10 + (Math.random() * 20));
        if (freqPctEl) freqPctEl.textContent = `+${Math.round(frequency)}%`;
        if (freqBarEl) freqBarEl.style.width = `${Math.min(100, frequency / 3)}%`;

        const valPct = document.getElementById('behavioral-value-pct');
        const valBar = document.getElementById('behavioral-value-bar');
        const shift  = Math.min(150, 40 + this.alerts.length * 5 + (Math.random() * 15));
        if (valPct) valPct.textContent = `+${Math.round(shift)}%`;
        if (valBar) valBar.style.width = `${Math.min(100, shift / 1.5)}%`;

        // ── Behavioral Deviations table: prepend row ──────────────
        if (!latestAlert) return;
        const tbody = document.getElementById('behavioral-deviations-body');
        if (!tbody) return;

        const tier = (latestAlert.risk_tier || 'LOW').toUpperCase();
        const pattern = this.formatPattern(latestAlert.pattern_type);
        const account = latestAlert.subject_account_id || 'Unknown';
        const score   = Math.round(latestAlert.risk_score || 0);
        const ts      = new Date(latestAlert.created_at || new Date()).toLocaleString();
        const severityClass = tier === 'HIGH'
            ? 'text-xs font-bold text-error bg-error-container px-2 py-0.5 rounded'
            : tier === 'MEDIUM'
            ? 'text-xs font-bold text-on-secondary-fixed-variant bg-secondary-fixed px-2 py-0.5 rounded'
            : 'text-xs font-bold text-tertiary bg-tertiary-fixed px-2 py-0.5 rounded';
        const severityLabel = tier === 'HIGH' ? 'Severe' : tier === 'MEDIUM' ? 'Moderate' : 'Low';
        const dotColor = tier === 'HIGH' ? 'bg-error' : tier === 'MEDIUM' ? 'bg-secondary' : 'bg-tertiary';

        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-50/50 transition-colors animate-pulse-once';
        row.innerHTML = `
            <td class="px-6 py-4 text-sm font-medium text-on-surface-variant">${ts}</td>
            <td class="px-6 py-4">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full ${dotColor}"></span>
                <span class="text-sm font-bold text-on-surface">${pattern}</span>
              </div>
            </td>
            <td class="px-6 py-4 text-sm text-on-surface-variant">Account: ${account} — Risk Score: ${score}</td>
            <td class="px-6 py-4"><span class="${severityClass}">${severityLabel}</span></td>
            <td class="px-6 py-4 text-right">
              <button onclick="navigate('live')" class="text-primary hover:bg-primary/5 p-1 rounded">
                <span class="material-symbols-outlined">more_vert</span>
              </button>
            </td>
        `;

        tbody.prepend(row);
        // Keep max 10 rows
        while (tbody.children.length > 10) tbody.lastElementChild.remove();
    }

    handleLiveTransaction(tx) {
        const feed = document.getElementById('live-feed');

        // Always update metrics — even if live feed div not visible
        this.metrics.total_transactions = (this.metrics.total_transactions || 0) + 1;
        this.metrics.total_volume = (this.metrics.total_volume || 0) + (tx.amount_usd || 0);
        this.updateKPIs();

        if (!feed) return;

        const row = document.createElement('div');
        row.className = 'grid grid-cols-12 px-6 py-4 border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer';

        const isHighRisk = tx.amount_usd > 50000;
        const riskColor = isHighRisk ? 'bg-error' : 'bg-tertiary';

        row.innerHTML = `
            <div class="col-span-1 flex items-center"><div class="w-2 h-2 rounded-full ${riskColor} live-dot"></div></div>
            <div class="col-span-4 min-w-0">
                <p class="text-sm font-bold text-on-surface truncate">${tx.sender_account_id || 'Unknown'}</p>
                <p class="text-[10px] text-on-surface-variant font-mono truncate">${(tx.transaction_id || '').slice(0, 12)}...</p>
            </div>
            <div class="col-span-2 flex items-center font-bold text-sm">$${(tx.amount_usd || 0).toLocaleString()}</div>
            <div class="col-span-2 flex items-center text-xs text-on-surface-variant">${tx.geolocation?.sender_country || 'Global'}</div>
            <div class="col-span-3 text-right text-[10px] text-on-surface-variant whitespace-nowrap">${new Date().toLocaleTimeString()}</div>
        `;

        feed.prepend(row);
        if (feed.children.length > 20) feed.lastElementChild.remove();
    }

    // ── Renderers ─────────────────────────────────────────────────────────────
    renderAlerts() {
        const list = document.getElementById('alerts-list');
        const notifList = document.getElementById('notification-dropdown-list');

        if (!this.alerts.length) {
            const emptyHTML = `<div class="p-6 text-center text-xs text-on-surface-variant font-medium">No new alerts detected.</div>`;
            if (list) list.innerHTML = emptyHTML;
            if (notifList) notifList.innerHTML = emptyHTML;
            return;
        }

        const alertsHTML = this.alerts.slice(0, 8).map(alert => {
            const title = this.formatPattern(alert.pattern_type);
            const tier = (alert.risk_tier || 'LOW').toUpperCase();
            const riskColor = tier === 'HIGH' ? 'text-error' : tier === 'MEDIUM' ? 'text-secondary' : 'text-tertiary';
            const riskBg = tier === 'HIGH' ? 'bg-error-container' : tier === 'MEDIUM' ? 'bg-secondary/10' : 'bg-tertiary-fixed';
            const timeAgo = this.timeAgo(alert.created_at || new Date());
            const score = Math.round(alert.risk_score || 0);

            return `
            <div class="bg-surface-container-lowest p-4 rounded-lg flex gap-4 hover:shadow-md transition-shadow cursor-pointer border border-transparent hover:border-slate-200" onclick="navigate('live'); window.toggleNotifications && window.toggleNotifications(true)">
              <div class="w-10 h-10 rounded-full ${riskBg} flex-shrink-0 flex items-center justify-center shadow-inner">
                <span class="material-symbols-outlined ${riskColor} text-xl" style="font-variation-settings:'FILL' 1;">${this.getIconForPattern(alert.pattern_type)}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start mb-0.5">
                  <p class="text-sm font-bold text-on-surface truncate">${title}</p>
                  <span class="text-[10px] text-on-surface-variant font-medium whitespace-nowrap ml-2">${timeAgo}</span>
                </div>
                <p class="text-xs text-on-surface-variant truncate">Acct: ${alert.subject_account_id || 'Unknown'}</p>
                <div class="mt-2 flex items-center gap-2">
                    <span class="text-[9px] font-black uppercase tracking-widest ${riskColor}">${tier} RISK</span>
                    <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100">${score} Score</span>
                </div>
              </div>
            </div>
            `;
        }).join('');

        if (list) list.innerHTML = alertsHTML;
        if (notifList) notifList.innerHTML = alertsHTML;
    }

    renderCases(cases) {
        const tableBody = document.getElementById('cases-table-body');
        if (!tableBody) return;

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

        if (!cases.length) {
            tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-12 text-center text-sm text-on-surface-variant">No cases found. Create a new case to get started.</td></tr>`;
            return;
        }

        tableBody.innerHTML = cases.map(c => {
            const caseIdShort = (c.case_id || '').substring(0, 8).toUpperCase();
            const dateStr = c.created_at ? new Date(c.created_at).toLocaleDateString() : '—';
            const analyst = c.assigned_to || 'Unassigned';
            const initials = analyst !== 'Unassigned' ? analyst.substring(0, 2).toUpperCase() : 'UA';
            return `
            <tr class="hover:bg-surface-container-low/30 transition-colors group cursor-pointer" onclick="window._openCaseRow && window._openCaseRow('${c.case_id}', this)">
              <td class="px-6 py-5">
                <div class="flex flex-col">
                  <span class="text-sm font-bold text-on-surface">${caseIdShort}</span>
                  <span class="text-xs text-on-surface-variant">${c.subject_account_id || '—'}</span>
                </div>
              </td>
              <td class="px-6 py-5">
                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${this.getRiskClass(c.escalation_state)}">
                    <span class="w-1 h-1 rounded-full bg-current mr-1.5"></span>${c.escalation_state || 'ON_TRACK'}
                </span>
              </td>
              <td class="px-6 py-5"><span class="text-xs font-semibold text-on-surface">${c.state || '—'}</span></td>
              <td class="px-6 py-5">
                <div class="flex items-center gap-2">
                  <div class="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700">${initials}</div>
                  <span class="text-xs font-medium">${analyst}</span>
                </div>
              </td>
              <td class="px-6 py-5"><span class="text-xs text-on-surface-variant">${dateStr}</span></td>
              <td class="px-6 py-5 text-right">
                <button onclick="event.stopPropagation(); window._openCaseRow && window._openCaseRow('${c.case_id}', this)" class="material-symbols-outlined text-outline hover:text-primary transition-colors">more_vert</button>
              </td>
            </tr>
        `}).join('');
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

        // Also update transaction count element if present
        const kpiTxCount = document.getElementById('kpi-tx-count');
        if (kpiTxCount) {
            kpiTxCount.textContent = (this.metrics.total_transactions || 0).toLocaleString();
        }

        if (kpiSuspicious) kpiSuspicious.textContent = (this.metrics.suspicious_count || this.alerts.length).toLocaleString();
        if (kpiHigh) kpiHigh.textContent = (this.metrics.high_risk_entities || 0).toLocaleString();
        if (kpiAvg) kpiAvg.textContent = (this.metrics.avg_risk_score || 0).toFixed(1);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    getHeaders() {
        const token = (window.Auth && window.Auth.getToken())
            || localStorage.getItem(ENGINE_CONFIG.AUTH_STORAGE_KEY)
            || null;
        return {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        };
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
                // Refresh relevant data after navigation
                setTimeout(() => {
                    if (page === 'cases') this.refreshCases();
                    if (page === 'live') { this.refreshAlerts(); this.refreshMetrics(); }
                    if (page === 'overview') this.refreshData();
                }, 150);
            };
        }
        window.sentinelEngine = this;
    }
}

// ── Notifications UI Logic ───────────────────────────────────────────────────
window.toggleNotifications = function(forceClose = false) {
    const dropdown = document.getElementById('notification-dropdown');
    const badge = document.getElementById('notification-badge');
    if (!dropdown) return;

    if (forceClose || !dropdown.classList.contains('hidden')) {
        dropdown.classList.add('opacity-0');
        setTimeout(() => dropdown.classList.add('hidden'), 200);
    } else {
        dropdown.classList.remove('hidden');
        setTimeout(() => dropdown.classList.remove('opacity-0'), 10);
        if (badge) badge.classList.add('hidden');
    }
};

window.clearNotifications = function() {
    if (window.engine) {
        window.engine.alerts = [];
        window.engine.renderAlerts();
    }
    const badge = document.getElementById('notification-badge');
    if (badge) badge.classList.add('hidden');
};

// ── Boot ───────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    window.engine = new DashboardEngine();
    window.engine.init();
});
