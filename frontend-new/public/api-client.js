/**
 * ═══════════════════════════════════════════════════════════════════════
 *  SENTINEL AML — Centralized API Client
 *  Handles: JWT token storage, authenticated fetch wrappers,
 *           consistent error handling, Base URL config
 * ═══════════════════════════════════════════════════════════════════════
 */

const API_CONFIG = {
    BASE_URL: 'http://localhost:5000',
    AI_BASE_URL: 'http://localhost:8000',
    TOKEN_KEY: 'tracr_auth_token',
    USER_KEY: 'tracr_auth_user',
};

// ── Token Management ──────────────────────────────────────────────────────────

const Auth = {
    getToken() {
        return localStorage.getItem(API_CONFIG.TOKEN_KEY) || null;
    },
    setToken(token) {
        localStorage.setItem(API_CONFIG.TOKEN_KEY, token);
    },
    clearToken() {
        localStorage.removeItem(API_CONFIG.TOKEN_KEY);
        localStorage.removeItem(API_CONFIG.USER_KEY);
    },
    getUser() {
        try {
            return JSON.parse(localStorage.getItem(API_CONFIG.USER_KEY) || 'null');
        } catch {
            return null;
        }
    },
    setUser(user) {
        localStorage.setItem(API_CONFIG.USER_KEY, JSON.stringify(user));
    },
    isLoggedIn() {
        return !!this.getToken();
    },
    logout() {
        this.clearToken();
        window.location.href = '/';
    },
};

// ── Authenticated Fetch Helpers ───────────────────────────────────────────────

function buildHeaders(extra = {}) {
    const token = Auth.getToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...extra,
    };
}

async function handleResponse(res) {
    if (res.status === 401) {
        Auth.clearToken();
        if (window.toast) window.toast('Session expired. Please sign in again.', 'error');
        setTimeout(() => { window.location.href = '/'; }, 1500);
        throw new Error('unauthorized');
    }
    if (!res.ok) {
        let errBody = {};
        try { errBody = await res.json(); } catch (_) {}
        const msg = errBody.error || errBody.message || `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return res.json();
}

const api = {
    // ── REST to Node.js backend ───────────────────────────────────────────────
    async get(path) {
        const res = await fetch(`${API_CONFIG.BASE_URL}${path}`, {
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    async post(path, body = {}) {
        const res = await fetch(`${API_CONFIG.BASE_URL}${path}`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify(body),
        });
        return handleResponse(res);
    },

    async patch(path, body = {}) {
        const res = await fetch(`${API_CONFIG.BASE_URL}${path}`, {
            method: 'PATCH',
            headers: buildHeaders(),
            body: JSON.stringify(body),
        });
        return handleResponse(res);
    },

    async delete(path) {
        const res = await fetch(`${API_CONFIG.BASE_URL}${path}`, {
            method: 'DELETE',
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    // ── REST to FastAPI AI agents service ────────────────────────────────────
    async aiPost(path, body = {}) {
        const res = await fetch(`${API_CONFIG.AI_BASE_URL}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        return handleResponse(res);
    },

    async aiGet(path) {
        const res = await fetch(`${API_CONFIG.AI_BASE_URL}${path}`, {
            headers: { 'Content-Type': 'application/json' },
        });
        return handleResponse(res);
    },
};

// ── Auth API ─────────────────────────────────────────────────────────────────

const AuthAPI = {
    async login(username, password) {
        const res = await fetch(`${API_CONFIG.BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Login failed');
        }
        const data = await res.json();
        Auth.setToken(data.token);
        Auth.setUser(data.user);
        return data;
    },

    async guestLogin() {
        // Use the analyst demo account seeded in the DB
        return this.login('analyst', 'Password123!');
    },
};

// ── Simulator API ─────────────────────────────────────────────────────────────

const SimulatorAPI = {
    async triggerAnomaly(type) {
        return api.post('/api/simulator/trigger-anomaly', { type });
    },
};

// ── Cases API ─────────────────────────────────────────────────────────────────

const CasesAPI = {
    async list(page = 1, limit = 20) {
        return api.get(`/api/cases?page=${page}&limit=${limit}`);
    },
    async getById(caseId) {
        return api.get(`/api/cases/${caseId}`);
    },
    async create(body) {
        return api.post('/api/cases', body);
    },
    async transition(caseId, to_state, reason_code, extras = {}) {
        return api.patch(`/api/cases/${caseId}/state`, {
            to_state,
            reason_code,
            decision_source: 'HUMAN',
            ...extras,
        });
    },
    async addNote(caseId, note) {
        return api.post(`/api/cases/${caseId}/notes`, { note });
    },
    async generateSAR(caseId) {
        return api.post(`/api/cases/${caseId}/sar/draft`, {});
    },
    async qualityCheck(caseId) {
        return api.post(`/api/cases/${caseId}/sar/quality-check`, {});
    },
};

// ── Alerts API ────────────────────────────────────────────────────────────────

const AlertsAPI = {
    async list(params = {}) {
        const qs = new URLSearchParams(params).toString();
        return api.get(`/api/alerts${qs ? '?' + qs : ''}`);
    },
    async getById(alertId) {
        return api.get(`/api/alerts/${alertId}`);
    },
    async getExplainability(alertId) {
        return api.get(`/api/alerts/${alertId}/explainability`);
    },
    async getEvidenceReplay(alertId) {
        return api.get(`/api/alerts/${alertId}/evidence-replay`);
    },
};

// ── AI Agents API ─────────────────────────────────────────────────────────────

const AgentAPI = {
    async analyzeTransaction(transactionData) {
        return api.aiPost('/analyze/transaction', transactionData);
    },
    async analyzeBehavior(accountId, recentTransactions) {
        return api.aiPost('/analyze/behavior', { account_id: accountId, transactions: recentTransactions });
    },
    async explainGraphAnomaly(alert) {
        return api.aiPost('/graph/anomaly-explain', { alert });
    },
    async generateSARNarrative(alertId) {
        return api.aiPost('/sar/generate-narrative', { alert_id: alertId });
    },
    async health() {
        return api.aiGet('/health');
    },
};

// ── Graph API ─────────────────────────────────────────────────────────────────

const GraphAPI = {
    async getSubgraph(accountId, depth = 2) {
        return api.get(`/api/graph/subgraph/${accountId}?depth=${depth}`);
    },
    async getBaseline(accountId) {
        return api.get(`/api/accounts/${accountId}/baseline`);
    }
};

// ── Expose globally ───────────────────────────────────────────────────────────

window.Auth = Auth;
window.AuthAPI = AuthAPI;
window.SimulatorAPI = SimulatorAPI;
window.CasesAPI = CasesAPI;
window.AlertsAPI = AlertsAPI;
window.AgentAPI = AgentAPI;
window.GraphAPI = GraphAPI;
window.sentinelApi = api;
window.API_CONFIG = API_CONFIG;
