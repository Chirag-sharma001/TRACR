/**
 * SENTINEL AML — Dashboard Engine
 * Integrates real-time Socket.io streams and REST API calls
 * into the Sentinel UI Layer.
 */

const ENGINE_CONFIG = {
    // Determine the backend URL. If served by the backend, it will be the same origin.
    BASE_URL: window.location.origin.includes('localhost') ? window.location.origin.replace(':3001', ':3000') : window.location.origin,
    API_PREFIX: '/api',
    AUTH_STORAGE_KEY: 'tracr_auth_token'
};

class DashboardEngine {
    constructor() {
        this.socket = null;
        this.token = localStorage.getItem(ENGINE_CONFIG.AUTH_STORAGE_KEY);
        this.metrics = {
            total_volume: 0,
            suspicious_count: 0,
            high_risk_entities: 0,
            avg_risk_score: 0
        };
        this.alerts = [];
        
        console.log('--- SENTINEL ENGINE INITIALIZED ---');
        this.patchNavigation();
        this.init();
    }

    async init() {
        try {
            // 1. Check for Auth
            if (!this.token) {
                console.warn('No auth token found. Redirecting to login...');
                // In a real app, we'd redirect to / here
                // window.location.href = '/';
                // For demo, we'll wait for manual login or use an existing session
            }

            // 2. Connect Socket
            this.connectSocket();

            // 3. Initial Data Fetch
            await this.refreshData();

            // 4. Start Metric Pooling
            setInterval(() => this.refreshMetrics(), 10000);
        } catch (err) {
            console.error('Engine Init Error:', err);
        }
    }

    connectSocket() {
        console.log('Connecting to Intelligent Layer via Socket.io...');
        
        // io() automatically connects to the same host if no URL provided
        // But since we might be on 3001, we specify the backend URL
        this.socket = io(ENGINE_CONFIG.BASE_URL);

        this.socket.on('connect', () => {
            console.log('✅ Connected to Sentinel Backbone');
            if (window.toast) window.toast('Sentinel Intelligence Synchronized', 'success', 2000);
        });

        this.socket.on('alert:scored', (alert) => {
            console.log('🚩 High Risk Alert Received:', alert);
            this.handleNewAlert(alert);
        });

        this.socket.on('transaction:saved', (tx) => {
            this.handleLiveTransaction(tx);
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
            const res = await fetch(`${ENGINE_CONFIG.BASE_URL}${ENGINE_CONFIG.API_PREFIX}/admin/config`, {
                headers: this.getHeaders()
            });
            if (!res.ok) return;
            
            // For demo, we'll fetch general metrics if an endpoint exists, 
            // otherwise use some randomized real-ish data based on config
            this.updateKPIs();
        } catch (err) {
            console.error('Failed to refresh metrics:', err);
        }
    }

    async refreshAlerts() {
        try {
            const res = await fetch(`${ENGINE_CONFIG.BASE_URL}${ENGINE_CONFIG.API_PREFIX}/alerts?limit=10`, {
                headers: this.getHeaders()
            });
            if (res.status === 401) return this.handleUnauthorized();
            if (!res.ok) return;
            const data = await res.json();
            this.alerts = data.items || [];
            this.renderAlerts();
        } catch (err) {
            console.error('Failed to refresh alerts:', err);
        }
    }

    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }

    async handleUnauthorized() {
        if (window.toast) window.toast('Session expired. Redirecting to login...', 'error');
        setTimeout(() => {
            window.location.href = '/';
        }, 1500);
    }

    // Monkey-patch the global navigate function to refresh data on tab switch
    patchNavigation() {
        const originalNavigate = window.navigate;
        if (typeof originalNavigate === 'function') {
            window.navigate = (page) => {
                originalNavigate(page);
                this.refreshData();
                // If switching to live monitoring, ensure the feed is ready
                if (page === 'live') {
                    setTimeout(() => this.renderAlerts(), 100);
                }
            };
        }

        // Disable the mock live feed from app.html
        window.initLiveFeed = () => {
             console.log('--- LIVE FEED HOOKED TO ENGINE ---');
             // The engine handles the 'live-feed' container via socket events
        };
    }

    handleNewAlert(alert) {
        this.alerts.unshift(alert);
        if (this.alerts.length > 10) this.alerts.pop();
        
        // Show toast for HIGH risk
        if (alert.risk_tier === 'HIGH') {
            if (window.toast) window.toast(`CRITICAL: ${alert.anomalies[0]?.pattern_type || 'Suspicious Activity'} Detected`, 'error', 5000);
        }
        
        this.renderAlerts();
        this.updateKPIs();
    }

    handleLiveTransaction(tx) {
        const feed = document.getElementById('live-feed');
        if (!feed) return;

        const row = document.createElement('div');
        row.className = 'grid grid-cols-12 px-6 py-4 border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer animate-in fade-in slide-in-from-left-2 duration-500';
        
        const riskColor = tx.amount_usd > 10000 ? 'bg-error' : 'bg-tertiary';
        
        row.innerHTML = `
            <div class="col-span-1 flex items-center"><div class="w-2 h-2 rounded-full ${riskColor}"></div></div>
            <div class="col-span-4 min-w-0">
                <p class="text-sm font-bold text-on-surface truncate">${tx.sender_account_id}</p>
                <p class="text-[10px] text-on-surface-variant font-mono truncate">${tx.transaction_id.slice(0, 8)}...</p>
            </div>
            <div class="col-span-2 flex items-center font-bold text-sm">$${tx.amount_usd.toLocaleString()}</div>
            <div class="col-span-2 flex items-center text-xs text-on-surface-variant">${tx.geolocation?.sender_country || 'US'}</div>
            <div class="col-span-3 text-right text-[10px] text-on-surface-variant whitespace-nowrap">${new Date().toLocaleTimeString()}</div>
        `;

        feed.prepend(row);
        if (feed.children.length > 50) feed.lastElementChild.remove();
        
        this.metrics.total_volume += tx.amount_usd;
        this.updateKPIs();
    }

    async refreshCases() {
        try {
            const res = await fetch(`${ENGINE_CONFIG.BASE_URL}${ENGINE_CONFIG.API_PREFIX}/cases`, {
                headers: this.getHeaders()
            });
            if (res.status === 401) return this.handleUnauthorized();
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

        const footerSpan = document.querySelector('#page-cases .text-on-surface-variant span.font-bold:last-child');
        if (footerSpan) footerSpan.textContent = total;
        const footerRange = document.querySelector('#page-cases .text-on-surface-variant span.font-bold:first-child');
        if (footerRange) footerRange.textContent = total > 0 ? `1 – ${total}` : '0';

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
              <td class="px-6 py-5 text-right"><button class="material-symbols-outlined text-outline opacity-0 group-hover:opacity-100 transition-opacity">more_vert</button></td>
            </tr>
        `).join('');
    }

    getRiskClass(state) {
        if (state === 'BREACHED') return 'bg-error-container text-on-error-container';
        if (state === 'AT_RISK') return 'bg-secondary-container/10 text-secondary';
        return 'bg-tertiary-fixed text-on-tertiary-fixed-variant';
    }

    renderAlerts() {
        const list = document.getElementById('alerts-list');
        if (!list) return;

        list.innerHTML = this.alerts.map(alert => {
            const anomaly = alert.anomalies[0] || { pattern_type: 'Suspicious Flow' };
            const riskColor = alert.risk_tier === 'HIGH' ? 'bg-error' : 'bg-secondary';
            const riskBg = alert.risk_tier === 'HIGH' ? 'bg-error-container' : 'bg-secondary/10';
            
            return `
            <div class="bg-surface-container-lowest p-4 rounded-lg flex gap-4 hover:shadow-md transition-shadow cursor-pointer">
              <div class="w-10 h-10 rounded-full ${riskBg} flex-shrink-0 flex items-center justify-center">
                <span class="material-symbols-outlined ${alert.risk_tier === 'HIGH' ? 'text-error' : 'text-secondary'} text-xl">${this.getIconForPattern(anomaly.pattern_type)}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start mb-0.5">
                  <p class="text-sm font-bold text-on-surface truncate">${this.formatPattern(anomaly.pattern_type)}</p>
                  <span class="text-[10px] text-on-surface-variant font-medium">${this.timeAgo(alert.timestamp)}</span>
                </div>
                <p class="text-xs text-on-surface-variant truncate">ID: ${alert.subject_account_id}</p>
                <div class="mt-2"><span class="bg-${alert.risk_tier === 'HIGH' ? 'error' : 'secondary'}/10 text-${alert.risk_tier === 'HIGH' ? 'error' : 'secondary'} text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full">Score: ${Math.round(alert.risk_score)}</span></div>
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

        if (kpiTotal) kpiTotal.textContent = `$${(this.metrics.total_volume / 1000000).toFixed(1)}M`;
        if (kpiSuspicious) kpiSuspicious.textContent = this.alerts.length;
        if (kpiHigh) kpiHigh.textContent = this.alerts.filter(a => a.risk_tier === 'HIGH').length;
        if (kpiAvg) {
            const sum = this.alerts.reduce((a, b) => a + b.risk_score, 0);
            const avg = this.alerts.length ? (sum / this.alerts.length).toFixed(1) : 0;
            kpiAvg.textContent = avg;
        }
    }

    getIconForPattern(type) {
        if (type.includes('CIRCULAR')) return 'loop';
        if (type.includes('SMURFING')) return 'groups';
        if (type.includes('VELOCITY')) return 'bolt';
        return 'flag';
    }

    formatPattern(type) {
        return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    timeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        return `${Math.floor(minutes / 60)}h ago`;
    }
}

// Start Engine
window.addEventListener('load', () => {
    window.sentinelEngine = new DashboardEngine();
});
