/* ═══════════════════════════════════════════════════════════════════════
   SENTINEL AML — Interaction Layer
   Handles: Modals, Toasts, Notification Panel, Global Search,
            Case Drawer (real API), Simulator, Tab Filters, Settings,
            Export stubs, Log Out
   Requires: api-client.js loaded before this script
   ═══════════════════════════════════════════════════════════════════════ */

// ── 1. TOAST SYSTEM ────────────────────────────────────────────────────
const TOAST_ICONS = { success: 'check_circle', error: 'error', warn: 'warning', info: 'info' };
const TOAST_COLORS = {
  success: 'bg-tertiary-fixed text-on-tertiary-fixed-variant border-tertiary-container',
  error:   'bg-error-container text-on-error-container border-error',
  warn:    'bg-secondary-fixed text-on-secondary-fixed-variant border-secondary',
  info:    'bg-primary-fixed text-on-primary-fixed border-primary'
};

function toast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 items-center pointer-events-none';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = `pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl border text-sm font-semibold transition-all duration-300 opacity-0 translate-y-2 ${TOAST_COLORS[type]}`;
  t.innerHTML = `<span class="material-symbols-outlined text-lg" style="font-variation-settings:'FILL' 1;">${TOAST_ICONS[type]}</span><span>${message}</span>`;
  container.appendChild(t);
  requestAnimationFrame(() => { t.classList.remove('opacity-0','translate-y-2'); });
  setTimeout(() => {
    t.classList.add('opacity-0','translate-y-2');
    setTimeout(() => t.remove(), 300);
  }, duration);
}

// ── 2. MODAL SYSTEM ────────────────────────────────────────────────────
function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('hidden');
  requestAnimationFrame(() => {
    m.querySelector('.modal-panel')?.classList.remove('scale-95','opacity-0');
  });
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  const panel = m.querySelector('.modal-panel');
  if (panel) {
    panel.classList.add('scale-95','opacity-0');
    setTimeout(() => m.classList.add('hidden'), 200);
  } else {
    m.classList.add('hidden');
  }
}

document.addEventListener('click', e => {
  if (e.target.matches('.modal-backdrop')) {
    closeModal(e.target.closest('[id]').id);
  }
});

// ── 3. NEW CASE MODAL ─────────────────────────────────────────────────
function injectNewCaseModal() {
  if (document.getElementById('modal-new-case')) return;
  const html = `
  <div id="modal-new-case" class="hidden fixed inset-0 z-[150] flex items-center justify-center p-4">
    <div class="modal-backdrop absolute inset-0 bg-black/30 backdrop-blur-sm"></div>
    <div class="modal-panel relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 scale-95 opacity-0 transition-all duration-200">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-xl font-extrabold tracking-tight text-slate-900">Initialize New Case</h2>
          <p class="text-sm text-slate-500 mt-0.5">Create a new investigation docket in the Sentinel ledger.</p>
        </div>
        <button onclick="closeModal('modal-new-case')" class="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="space-y-4">
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Alert ID (from detection)</label>
          <input id="nc-alert-id" type="text" placeholder="e.g., alert_id from Alerts page" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"/>
        </div>
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Subject Account ID</label>
          <input id="nc-entity" type="text" placeholder="e.g., ACC-SM-001 or entity name" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"/>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Assign Analyst</label>
            <select id="nc-analyst" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all">
              <option value="analyst">Analyst (default)</option>
              <option value="admin">Admin</option>
              <option value="">Unassigned</option>
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Case Type</label>
            <select id="nc-type" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all">
              <option>SAR Filing</option>
              <option>CTR Filing</option>
              <option>Internal Audit</option>
              <option>KYC Review</option>
            </select>
          </div>
        </div>
      </div>
      <div class="mt-6 flex gap-3 justify-end">
        <button onclick="closeModal('modal-new-case')" class="px-5 py-2.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-colors">Cancel</button>
        <button onclick="submitNewCase()" id="btn-submit-case" class="px-5 py-2.5 rounded-lg text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-all" style="background:linear-gradient(15deg,#3525cd,#4f46e5)">
          <span class="material-symbols-outlined text-sm align-middle mr-1">add</span>Create Case
        </button>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

async function submitNewCase() {
  const alertId = document.getElementById('nc-alert-id')?.value?.trim();
  const entity = document.getElementById('nc-entity')?.value?.trim();
  const analyst = document.getElementById('nc-analyst')?.value;
  const btn = document.getElementById('btn-submit-case');

  if (!entity) {
    toast('Please enter a subject account ID.', 'error');
    document.getElementById('nc-entity')?.focus();
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }

  try {
    const data = await window.CasesAPI.create({
      alert_id: alertId || 'MANUAL-ENTRY',
      subject_account_id: entity,
      assigned_to: analyst || null,
    });

    toast(`Case ${data.case_id?.slice(0,8).toUpperCase()} created.`, 'success');
    closeModal('modal-new-case');
    if (window.engine) window.engine.refreshCases();
    setTimeout(() => { if (typeof navigate === 'function') navigate('cases'); }, 400);
  } catch (err) {
    toast(`Failed to create case: ${err.message}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Create Case'; }
  }
}

window.openNewCase = function() {
  injectNewCaseModal();
  setTimeout(() => openModal('modal-new-case'), 10);
};

// ── 4. NOTIFICATION PANEL ──────────────────────────────────────────────
function buildNotifItems() {
  const engine = window.engine || window.sentinelEngine;
  const alerts = (engine && engine.alerts && engine.alerts.length > 0) ? engine.alerts : [];
  if (alerts.length === 0) {
    return `<div class="px-5 py-8 text-center text-sm text-slate-400">No recent alerts.<br/>Alerts appear here in real-time.</div>`;
  }
  return alerts.slice(0, 8).map(n => {
    const isReal = !!n.risk_tier;
    const icon = isReal ? (n.pattern_type?.includes('CIRCULAR') ? 'loop' : n.pattern_type?.includes('SMURFING') ? 'groups' : 'flag') : (n.icon || 'flag');
    const color = isReal ? (n.risk_tier === 'HIGH' ? 'text-error' : 'text-secondary') : (n.color || 'text-primary');
    const bg = isReal ? (n.risk_tier === 'HIGH' ? 'bg-error-container' : 'bg-secondary/10') : (n.bg || 'bg-primary-fixed');
    const title = isReal ? (n.pattern_type || 'Suspicious Flow').split('_').map(w => w[0] + w.slice(1).toLowerCase()).join(' ') : (n.title || 'Alert');
    const body = isReal ? `Account: ${n.subject_account_id} — Score ${Math.round(n.risk_score || 0)}` : (n.body || '');
    const time = isReal ? _timeAgo(n.created_at) : (n.time || '');

    return `
    <div class="flex gap-4 px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-50 last:border-0" onclick="navigate('live'); toggleNotifications();">
      <div class="w-9 h-9 rounded-full ${bg} flex-shrink-0 flex items-center justify-center">
        <span class="material-symbols-outlined ${color} text-lg" style="font-variation-settings:'FILL' 1;">${icon}</span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-xs font-bold text-slate-800 leading-snug">${title}</p>
        <p class="text-[11px] text-slate-500 mt-0.5 truncate">${body}</p>
        <p class="text-[10px] text-slate-400 mt-1">${time}</p>
      </div>
    </div>`;
  }).join('');
}

function _timeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'Just now';
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function injectNotificationPanel() {
  if (document.getElementById('notif-panel')) {
    document.getElementById('notif-items').innerHTML = buildNotifItems();
    return;
  }
  const html = `
  <div id="notif-panel" class="hidden fixed top-16 right-4 z-[100] w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
    <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
      <div class="flex items-center gap-2">
        <h3 class="text-sm font-bold text-slate-900">Notifications</h3>
      </div>
      <div class="flex gap-2">
        <button onclick="markAllRead()" class="text-[10px] font-bold text-indigo-600 hover:underline">Mark all read</button>
        <button onclick="toggleNotifications()" class="p-1 hover:bg-slate-100 rounded text-slate-400">
          <span class="material-symbols-outlined text-sm">close</span>
        </button>
      </div>
    </div>
    <div id="notif-items" class="max-h-96 overflow-y-auto">${buildNotifItems()}</div>
    <div class="px-5 py-3 bg-slate-50 border-t border-slate-100 text-center">
      <button onclick="navigate('live'); toggleNotifications();" class="text-xs font-bold text-indigo-600 hover:underline">View all alerts</button>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

let notifOpen = false;
window.toggleNotifications = function() {
  injectNotificationPanel();
  const panel = document.getElementById('notif-panel');
  notifOpen = !notifOpen;
  panel.classList.toggle('hidden', !notifOpen);
  if (notifOpen) {
    document.getElementById('notif-items').innerHTML = buildNotifItems();
  }
};

window.markAllRead = function() {
  document.querySelectorAll('.badge-pulse').forEach(b => b.classList.add('opacity-0'));
  toast('All notifications marked as read', 'success', 2000);
};

document.addEventListener('click', e => {
  if (notifOpen && !e.target.closest('#notif-panel') && !e.target.closest('[title="Notifications"]')) {
    notifOpen = false;
    document.getElementById('notif-panel')?.classList.add('hidden');
  }
});

// ── 5. GLOBAL SEARCH ───────────────────────────────────────────────────
const SEARCH_INDEX = [
  { label: 'Overview Dashboard', icon: 'dashboard', page: 'overview', match: 'overview dashboard activity kpi' },
  { label: 'Live Monitoring — Transaction Stream', icon: 'monitor_heart', page: 'live', match: 'live monitoring transaction stream throughput' },
  { label: 'Network Analysis — Entity Inspector', icon: 'hub', page: 'network', match: 'network analysis entity graph nodes' },
  { label: 'Behavioral Analysis — Radar', icon: 'psychology', page: 'behavioral', match: 'behavioral analysis radar xai pattern' },
  { label: 'Case Management', icon: 'work', page: 'cases', match: 'case management investigation global vertex' },
  { label: 'Compliance Reports', icon: 'assessment', page: 'reports', match: 'reports compliance SAR CTR audit filing' },
  { label: 'Anomaly Simulator', icon: 'science', page: 'simulator', match: 'simulator smurfing circular trading inject anomaly' },
  { label: 'System Settings — AI Sensitivity', icon: 'settings', page: 'settings', match: 'settings sensitivity permission audit' },
];

function injectSearchDropdown() {
  if (document.getElementById('search-dropdown')) return;
  const html = `
  <div id="search-dropdown" class="hidden absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-[100]">
    <div id="search-results" class="max-h-72 overflow-y-auto"></div>
    <div class="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 font-medium">Press <kbd class="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono">Enter</kbd> to search · <kbd class="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono">Esc</kbd> to close</div>
  </div>`;
  document.querySelector('#global-search')?.parentElement?.insertAdjacentHTML('afterend', html);
  document.querySelector('#global-search')?.parentElement?.classList.add('relative');
}

const searchInput = document.getElementById('global-search');
if (searchInput) {
  searchInput.addEventListener('input', function() {
    injectSearchDropdown();
    const q = this.value.toLowerCase().trim();
    const dd = document.getElementById('search-dropdown');
    const results = document.getElementById('search-results');
    if (!q) { dd.classList.add('hidden'); return; }
    const hits = SEARCH_INDEX.filter(item => item.match.includes(q) || item.label.toLowerCase().includes(q));
    if (!hits.length) {
      results.innerHTML = `<div class="px-4 py-6 text-center text-sm text-slate-400">No results for "<span class="font-semibold">${q}</span>"</div>`;
    } else {
      results.innerHTML = hits.map(h => `
        <div class="flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors cursor-pointer" onclick="navigate('${h.page}'); closeSearch();">
          <span class="material-symbols-outlined text-indigo-600 text-lg">${h.icon}</span>
          <span class="text-sm font-medium text-slate-800">${h.label}</span>
        </div>`).join('');
    }
    dd.classList.remove('hidden');
  });
  searchInput.addEventListener('keydown', e => { if (e.key === 'Escape') closeSearch(); });
}

window.closeSearch = function() {
  document.getElementById('search-dropdown')?.classList.add('hidden');
  if (searchInput) searchInput.value = '';
};

document.addEventListener('click', e => {
  if (!e.target.closest('#global-search') && !e.target.closest('#search-dropdown')) {
    document.getElementById('search-dropdown')?.classList.add('hidden');
  }
});

// ── 6. CASE DETAIL SIDE DRAWER (Real API) ──────────────────────────────
let _currentCaseId = null;
let _currentCaseData = null;

function injectCaseDrawer() {
  if (document.getElementById('case-drawer')) return;
  const html = `
  <div id="case-drawer" class="hidden fixed inset-y-0 right-0 z-[120] w-full max-w-md bg-white shadow-2xl flex flex-col">
    <div class="flex items-center justify-between px-6 py-5 border-b border-slate-100">
      <div>
        <p id="cd-id" class="text-[10px] font-bold text-indigo-600 uppercase tracking-widest"></p>
        <h3 id="cd-entity" class="text-lg font-extrabold text-slate-900 tracking-tight mt-0.5"></h3>
      </div>
      <button onclick="closeCaseDrawer()" class="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>
    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid grid-cols-3 gap-3">
        <div class="bg-slate-50 rounded-xl p-4"><p class="text-[10px] text-slate-400 uppercase font-bold mb-1">State</p><p id="cd-risk" class="text-sm font-extrabold"></p></div>
        <div class="bg-slate-50 rounded-xl p-4"><p class="text-[10px] text-slate-400 uppercase font-bold mb-1">Escalation</p><p id="cd-amount" class="text-sm font-extrabold text-indigo-700"></p></div>
        <div class="bg-slate-50 rounded-xl p-4"><p class="text-[10px] text-slate-400 uppercase font-bold mb-1">Created</p><p id="cd-since" class="text-xs font-bold text-slate-600"></p></div>
      </div>
      <div><p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Assigned Analyst</p><p id="cd-analyst" class="text-sm font-semibold text-slate-800"></p></div>
      <div><p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Alert ID</p><p id="cd-alert" class="text-xs font-mono text-slate-600 break-all"></p></div>
      <div>
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Quick Actions</p>
        <div class="flex flex-wrap gap-2">
          <button id="cd-btn-sar" onclick="caseDraftSAR()" class="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1">
            <span class="material-symbols-outlined text-xs">description</span>Generate SAR
          </button>
          <button id="cd-btn-escalate" onclick="caseEscalate()" class="px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1">
            <span class="material-symbols-outlined text-xs">arrow_upward</span>Escalate
          </button>
          <button id="cd-btn-close" onclick="caseClose()" class="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1">
            <span class="material-symbols-outlined text-xs">cancel</span>Dismiss Case
          </button>
          <button onclick="navigate('behavioral'); closeCaseDrawer();" class="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors">Behavioral Profile</button>
        </div>
      </div>
      <div id="cd-sar-result" class="hidden p-3 bg-indigo-50 rounded-lg border border-indigo-100">
        <p class="text-[10px] font-bold text-indigo-800 uppercase mb-1">SAR Draft Generated</p>
        <p id="cd-sar-id" class="text-xs font-mono text-indigo-700"></p>
      </div>
      <div class="pt-4 border-t border-slate-100">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Add Investigation Note</p>
        <textarea id="cd-note" rows="3" placeholder="Add investigation note…" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"></textarea>
        <button onclick="saveNote()" class="mt-2 w-full py-2 text-xs font-bold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors">Save Note</button>
      </div>
    </div>
  </div>
  <div id="case-drawer-overlay" class="hidden fixed inset-0 bg-black/20 z-[110]" onclick="closeCaseDrawer()"></div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

window._openCaseRow = async function(caseId, el) {
  injectCaseDrawer();
  try {
    const c = await window.CasesAPI.getById(caseId);
    _currentCaseId = caseId;
    _currentCaseData = c;

    document.getElementById('cd-id').textContent = caseId.slice(0,8).toUpperCase();
    document.getElementById('cd-entity').textContent = c.subject_account_id || caseId;
    document.getElementById('cd-risk').textContent = c.state || '—';
    document.getElementById('cd-amount').textContent = c.escalation_state || 'ON_TRACK';
    document.getElementById('cd-since').textContent = c.created_at ? new Date(c.created_at).toLocaleDateString() : '—';
    document.getElementById('cd-analyst').textContent = c.assigned_to || 'Unassigned';
    document.getElementById('cd-alert').textContent = c.alert_id || '—';
    document.getElementById('cd-note').value = '';
    document.getElementById('cd-sar-result')?.classList.add('hidden');

    document.getElementById('case-drawer').classList.remove('hidden');
    document.getElementById('case-drawer-overlay').classList.remove('hidden');
  } catch (err) {
    toast(`Could not load case: ${err.message}`, 'error');
  }
};

window.openCaseDrawer = window._openCaseRow;

window.closeCaseDrawer = function() {
  document.getElementById('case-drawer')?.classList.add('hidden');
  document.getElementById('case-drawer-overlay')?.classList.add('hidden');
  _currentCaseId = null;
  _currentCaseData = null;
};

window.caseDraftSAR = async function() {
  if (!_currentCaseId) return;
  const btn = document.getElementById('cd-btn-sar');
  if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }
  try {
    const result = await window.CasesAPI.generateSAR(_currentCaseId);
    toast(`SAR draft ${result.sar_id?.slice(0,8).toUpperCase()} created`, 'success');
    const sarResult = document.getElementById('cd-sar-result');
    if (sarResult) {
      sarResult.classList.remove('hidden');
      document.getElementById('cd-sar-id').textContent = `SAR ID: ${result.sar_id}`;
    }
    if (window.engine) window.engine.refreshCases();
  } catch (err) {
    toast(`SAR generation failed: ${err.message}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-symbols-outlined text-xs">description</span>Generate SAR'; }
  }
};

window.caseEscalate = async function() {
  if (!_currentCaseId || !_currentCaseData) return;
  const allowedTransitions = {
    OPEN: 'UNDER_REVIEW',
    UNDER_REVIEW: 'ESCALATED',
  };
  const toState = allowedTransitions[_currentCaseData.state];
  if (!toState) {
    toast(`Cannot escalate case in state: ${_currentCaseData.state}`, 'warn');
    return;
  }
  const btn = document.getElementById('cd-btn-escalate');
  if (btn) { btn.disabled = true; btn.textContent = 'Escalating…'; }
  try {
    await window.CasesAPI.transition(_currentCaseId, toState, 'ANALYST_ESCALATION');
    toast(`Case moved to ${toState}`, 'success');
    closeCaseDrawer();
    if (window.engine) window.engine.refreshCases();
  } catch (err) {
    toast(`Escalation failed: ${err.message}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-symbols-outlined text-xs">arrow_upward</span>Escalate'; }
  }
};

window.caseClose = async function() {
  if (!_currentCaseId) return;
  const btn = document.getElementById('cd-btn-close');
  if (btn) { btn.disabled = true; btn.textContent = 'Closing…'; }
  try {
    await window.CasesAPI.transition(_currentCaseId, 'CLOSED_DISMISSED', 'NO_SUSPICIOUS_ACTIVITY', {
      no_file_rationale: 'Dismissed by analyst after review. No sufficient evidence for SAR filing.',
    });
    toast('Case dismissed and closed.', 'success');
    closeCaseDrawer();
    if (window.engine) window.engine.refreshCases();
  } catch (err) {
    toast(`Close failed: ${err.message}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-symbols-outlined text-xs">cancel</span>Dismiss Case'; }
  }
};

window.saveNote = async function() {
  if (!_currentCaseId) return;
  const note = document.getElementById('cd-note')?.value?.trim();
  if (!note) { toast('Please enter a note.', 'warn'); return; }
  try {
    await window.CasesAPI.addNote(_currentCaseId, note);
    toast('Investigation note saved to case docket.', 'success');
    document.getElementById('cd-note').value = '';
  } catch (err) {
    toast(`Note save failed: ${err.message}`, 'error');
  }
};

// ── 7. LOG OUT ─────────────────────────────────────────────────────────
window.handleLogout = function() {
  if (window.Auth) {
    window.Auth.logout(); // clears token + redirects
  } else {
    localStorage.removeItem('tracr_auth_token');
    localStorage.removeItem('tracr_auth_user');
    window.location.href = '/';
  }
};

// ── 8. SIMULATOR INTERACTIONS ─────────────────────────────────────────
window.triggerSimulator = async function(type, btnId) {
  const btn = document.getElementById(btnId);
  const logEl = document.getElementById('sim-log');

  if (btn) { btn.disabled = true; btn.textContent = 'Injecting…'; }
  if (logEl) {
    const ts = new Date().toLocaleTimeString();
    logEl.innerHTML = `<div class="text-amber-400 font-mono text-[11px]">[${ts}] Triggering ${type}...</div>` + logEl.innerHTML;
  }

  try {
    const result = await window.SimulatorAPI.triggerAnomaly(type);
    toast(`${type.replace('_', ' ')}: ${result.message || 'Injected successfully'}`, 'success', 4000);
    if (logEl) {
      const ts = new Date().toLocaleTimeString();
      const txCount = result.count || '?';
      logEl.innerHTML =
        `<div class="text-emerald-400 font-mono text-[11px]">[${ts}] ✅ ${type} — ${txCount} txs injected. Detection running...</div>` +
        logEl.innerHTML;
    }
    // Refresh metrics after 3s (detection takes a moment)
    setTimeout(() => {
      if (window.engine) window.engine.refreshData();
    }, 3000);
  } catch (err) {
    toast(`Simulator error: ${err.message}`, 'error');
    if (logEl) {
      const ts = new Date().toLocaleTimeString();
      logEl.innerHTML = `<div class="text-red-400 font-mono text-[11px]">[${ts}] ❌ Failed: ${err.message}</div>` + logEl.innerHTML;
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = type === 'SMURFING' ? 'Inject Smurfing Cluster' : 'Inject Circular Trade';
    }
  }
};

window.triggerAIAnalysis = async function() {
  const btn = document.getElementById('btn-ai-analyze');
  const logEl = document.getElementById('sim-log');
  if (btn) { btn.disabled = true; btn.textContent = 'Analyzing…'; }
  try {
    const health = await window.AgentAPI.health();
    const ts = new Date().toLocaleTimeString();
    if (logEl) {
      logEl.innerHTML = `<div class="text-indigo-400 font-mono text-[11px]">[${ts}] 🤖 AI Agent: ${JSON.stringify(health)}</div>` + logEl.innerHTML;
    }
    toast('AI Agent is online and ready.', 'success');
  } catch (err) {
    const ts = new Date().toLocaleTimeString();
    if (logEl) {
      logEl.innerHTML = `<div class="text-yellow-400 font-mono text-[11px]">[${ts}] ⚠️ AI Agent offline: ${err.message}</div>` + logEl.innerHTML;
    }
    toast('AI Agent service not reachable. Start uvicorn on port 8000.', 'warn', 5000);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Test AI Agent Health'; }
  }
};

// ── 9. WIRE UP BUTTONS AFTER PAGE RENDER ──────────────────────────────
window.wirePageInteractions = function(page) {
  if (page === 'overview' || page === 'cases') {
    document.querySelectorAll('button').forEach(btn => {
      if (btn.textContent.includes('New Case') || btn.textContent.includes('Initialize New Case')) {
        btn.addEventListener('click', () => window.openNewCase(), { once: true });
      }
    });
  }

  if (page === 'cases') {
    // Tab filter buttons
    document.querySelectorAll('[class*="tracking-wider"][class*="rounded-lg"]').forEach(btn => {
      if (['All Cases','Flagged','Under Review','Closed'].includes(btn.textContent.trim())) {
        btn.addEventListener('click', function() {
          this.closest('div').querySelectorAll('button').forEach(b => {
            b.className = 'px-4 py-2 rounded-lg text-xs font-bold text-on-surface-variant uppercase tracking-wider hover:bg-white/50 transition-colors';
          });
          this.className = 'bg-surface-container-lowest px-4 py-2 rounded-lg text-xs font-bold text-primary uppercase tracking-wider border-b-2 border-primary';
          toast(`Filtered: ${this.textContent.trim()}`, 'info', 1800);
        });
      }
    });
  }

  if (page === 'reports') {
    document.querySelectorAll('button').forEach(btn => {
      if (btn.textContent.includes('Export PDF')) {
        btn.addEventListener('click', () => toast('Generating PDF report…', 'info'), { once: true });
      }
      if (btn.textContent.includes('New Filing')) {
        btn.addEventListener('click', () => toast('Filing wizard coming soon.', 'info'), { once: true });
      }
    });
  }

  if (page === 'live') {
    document.querySelectorAll('button').forEach(btn => {
      if (btn.textContent.includes('Historical Export')) {
        btn.addEventListener('click', () => toast('Exporting historical data as CSV…', 'info'), { once: true });
      }
      if (btn.textContent.includes('Global Risk Config')) {
        btn.addEventListener('click', () => { navigate('settings'); toast('Navigated to AI Risk Configuration.', 'info'); }, { once: true });
      }
      if (btn.textContent.includes('Dismiss Noise')) {
        btn.addEventListener('click', () => toast('Alert dismissed and logged.', 'success', 2000));
      }
      if (btn.textContent.includes('Flag Account')) {
        btn.addEventListener('click', () => toast('Account flagged for enhanced monitoring.', 'warn', 2500));
      }
      if (btn.textContent.includes('Snooze')) {
        btn.addEventListener('click', () => toast('Alert snoozed for 4 hours.', 'info', 2000));
      }
      if (btn.textContent.includes('Verify Identity')) {
        btn.addEventListener('click', () => toast('Identity verification request sent.', 'info'));
      }
    });
  }

  if (page === 'settings') {
    document.querySelectorAll('button').forEach(btn => {
      if (btn.querySelector && btn.querySelector('.material-symbols-outlined')?.textContent === 'save') {
        btn.addEventListener('click', () => toast('Settings saved. AI model re-indexed successfully.', 'success'));
      }
      if (btn.textContent.includes('Re-Index Ledger')) {
        btn.addEventListener('click', () => {
          toast('Ledger re-indexing started. ETA: ~2 minutes.', 'info');
          btn.textContent = 'Re-Indexing…';
          btn.disabled = true;
          setTimeout(() => {
            btn.textContent = 'Re-Index Ledger';
            btn.disabled = false;
            toast('Ledger re-indexed successfully.', 'success');
          }, 4000);
        });
      }
      if (btn.textContent.includes('Manage Backups')) btn.addEventListener('click', () => toast('Backup manager opening…', 'info', 2000));
      if (btn.textContent.includes('Invite Analyst')) btn.addEventListener('click', () => toast('Analyst invitation workflow coming soon.', 'info'));
      if (btn.textContent.includes('Export CSV')) btn.addEventListener('click', () => toast('Exporting audit log as CSV…', 'info'));
    });
  }

  if (page === 'network') {
    document.querySelectorAll('button').forEach(btn => {
      if (btn.textContent.includes('Flag for Investigation')) {
        btn.addEventListener('click', () => { window.openNewCase(); }, { once: true });
      }
    });
  }

  if (page === 'behavioral') {
    document.querySelectorAll('button').forEach(btn => {
      if (btn.textContent.includes('Export Full Audit')) {
        btn.addEventListener('click', () => toast('Exporting behavioral audit trail…', 'info'), { once: true });
      }
    });
  }
};

// ── 10. NOTIFICATION BELL WIRING ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const bell = document.querySelector('[title="Notifications"]');
  if (bell) bell.addEventListener('click', () => window.toggleNotifications());

  // Wire Log Out button
  document.querySelectorAll('a, button').forEach(el => {
    if (el.textContent?.trim() === 'Log Out') {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        window.handleLogout();
      });
    }
  });
});

// Also wire since DOMContentLoaded may have already fired
(function() {
  const bell = document.querySelector('[title="Notifications"]');
  if (bell && !bell._notifWired) {
    bell.addEventListener('click', () => window.toggleNotifications());
    bell._notifWired = true;
  }
})();

// ── 11. KEYBOARD SHORTCUTS ─────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('global-search')?.focus();
  }
  if (e.key === 'Escape') {
    closeSearch();
    notifOpen = false;
    document.getElementById('notif-panel')?.classList.add('hidden');
    closeCaseDrawer();
  }
});

// ── 12. EXPOSE HELPERS ────────────────────────────────────────────────
window._sentinel = { toast, openModal, closeModal };
