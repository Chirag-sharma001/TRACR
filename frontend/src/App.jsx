import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // State for Real-Time and Fetched Data
  const [metrics, setMetrics] = useState({
    tps: 0,
    alertCounts: { HIGH: 0, MEDIUM: 0, LOW: 0 },
    trend: []
  });
  const [token, setToken] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [cases, setCases] = useState([]);
  const [sars, setSars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Network Analysis State
  const [searchAccount, setSearchAccount] = useState('');
  const [subgraph, setSubgraph] = useState(null);
  const [searchingGraph, setSearchingGraph] = useState(false);

  const initialize = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    let active = true;

    try {
      console.log('Initializing TRACR Layer...');
      
      // 1. Authenticate with a timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const authRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'Password123!' }),
        signal: controller.signal
      }).catch(err => {
        if (err.name === 'AbortError') throw new Error("Auth request timed out after 8s");
        throw err;
      });
      
      clearTimeout(timeoutId);

      if (!authRes.ok) {
         console.warn("Auth failed, loading with mock data mode.");
         setLoading(false);
         return;
      }
      
      const authData = await authRes.json();
      const jwtToken = authData.token;
      const headers = { 'Authorization': `Bearer ${jwtToken}` };
      if (active) setToken(jwtToken);

      // 2. Fetch Initial Data (REST API)
      console.log('Fetching operational data...');
      const [alertsRes, casesRes, sarsRes] = await Promise.all([
        fetch('/api/alerts?limit=10', { headers }),
        fetch('/api/cases?limit=20', { headers }),
        fetch('/api/sar?limit=20', { headers })
      ]);

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        if (active) setAlerts(alertsData.items || []);
      }
      
      if (casesRes.ok) {
        const casesData = await casesRes.json();
        if (active) setCases(casesData.items || []);
      }

      if (sarsRes.ok) {
        const sarsData = await sarsRes.json();
        if (active) setSars(sarsData.items || []);
      }

      if (active) setLoading(false);
    } catch (err) {
      console.error('Initialization error:', err);
      if (active) {
        setErrorMsg(err.message);
        // Fallback: loading anyway so user can see the UI even if backend is flaky
        setTimeout(() => { if (active) setLoading(false); }, 1000);
      }
    }
  }, []);

  useEffect(() => {
    let socket = null;
    initialize();

    // 3. Connect WebSocket (via Vite Proxy)
    socket = io();
    
    socket.on('connect', () => {
      console.log('Connected to Backend SocketGateway');
    });

    socket.on('metrics:update', (data) => {
      setMetrics(data);
    });

    socket.on('alert:new', (newAlert) => {
      setAlerts(prev => [newAlert, ...prev].slice(0, 10)); // keep top 10
    });

    return () => {
      if (socket) socket.disconnect();
    };
  }, [initialize]);

  const fetchSubgraph = async () => {
    if (!searchAccount || !token) return;
    setSearchingGraph(true);
    try {
      const res = await fetch(`/api/graph/subgraph/${searchAccount}?depth=2`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSubgraph(data);
      } else {
        alert("Account not found or no graph data available.");
      }
    } catch (err) {
      console.error("Failed to fetch subgraph:", err);
    } finally {
      setSearchingGraph(false);
    }
  };

  const generateSAR = async (alertId) => {
    try {
      if (!token) return;
      const res = await fetch(`/api/alerts/${alertId}/sar`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        alert(`SAR Generation Started: ${data.sar_id}`);
        // Refresh SAR list after a short delay
        setTimeout(async () => {
          const sarsRes = await fetch('/api/sar?limit=20', { 
            headers: { 'Authorization': `Bearer ${token}` } 
          });
          if (sarsRes.ok) {
            const sarsData = await sarsRes.json();
            setSars(sarsData.items || []);
          }
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to generate SAR:', err);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid_view' },
    { id: 'network', label: 'Network Analysis', icon: 'hub' },
    { id: 'cases', label: 'Case Management', icon: 'folder_managed' },
    { id: 'sar', label: 'AI/SAR Reports', icon: 'description' },
  ];

  const renderDashboard = () => (
    <>
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <KPIItem title="Active High-Risk Alerts" value={metrics.alertCounts.HIGH || 0} color="text-[#ff4d4d]" showLive />
        <KPIItem title="Medium Risk Alerts" value={metrics.alertCounts.MEDIUM || 0} color="text-[#ffa64d]" />
        <KPIItem title="Low Risk Alerts" value={metrics.alertCounts.LOW || 0} color="text-[#4da6ff]" />
        <KPIItem title="Live Transactions / Sec" value={metrics.tps.toFixed(1)} color="text-[#66dd8b]" showSocketPulse />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 glass-panel rounded-md flex flex-col h-[500px]">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-[10px] font-bold tracking-widest uppercase text-[#c6c6cd]">Transaction Network Topology</h3>
            {metrics.alertCounts.HIGH > 0 && (
              <div className="flex gap-2 items-center">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                <span className="text-[10px] text-red-400 font-medium uppercase">Active Threat Detected</span>
              </div>
            )}
          </div>
          <div className="flex-1 relative bg-[#0d162d] overflow-hidden">
            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-40">
              <span className="material-symbols-outlined text-6xl mb-4" data-icon="hub">hub</span>
              <p className="text-sm font-mono italic">Macro Network View Active</p>
            </div>
            <button 
              onClick={() => setActiveTab('network')}
              className="absolute top-4 right-4 bg-[#66dd8b]/10 hover:bg-[#66dd8b]/20 text-[#66dd8b] text-[10px] px-3 py-1.5 rounded-sm border border-[#66dd8b]/30 transition-all font-bold uppercase"
            >
              Enter Analyst Mode
            </button>
          </div>
        </div>

        <div className="glass-panel rounded-md flex flex-col h-[500px]">
          <div className="p-4 border-b border-white/5">
            <h3 className="text-[10px] font-bold tracking-widest uppercase text-[#c6c6cd]">Live Anomaly Feed</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 hide-scrollbar">
            {alerts.length === 0 ? (
              <div className="text-center text-xs text-[#c6c6cd] p-4 italic opacity-50">Waiting for intelligence signals...</div>
            ) : (
              alerts.map((alert, idx) => (
                <AlertCard key={idx} alert={alert} />
              ))
            )}
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-md overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-[10px] font-bold tracking-widest uppercase text-[#c6c6cd]">Escalated Cases Pipeline</h3>
          <button 
            onClick={() => setActiveTab('cases')}
            className="text-[#66dd8b] text-[10px] hover:underline font-bold uppercase"
          >
            Manage Pipeline
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0d162d] text-[10px] text-[#c6c6cd] uppercase tracking-tighter">
                <th className="px-6 py-3 font-medium">Case ID</th>
                <th className="px-6 py-3 font-medium">Subject</th>
                <th className="px-6 py-3 font-medium">Reason</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {cases.slice(0, 5).map((c) => (
                <CaseRow key={c.case_id} c={c} onGenerateSAR={() => generateSAR(c.alert_id)} />
              ))}
              {cases.length === 0 && (
                <tr>
                   <td colSpan="5" className="px-6 py-10 text-center text-[#c6c6cd] opacity-50 italic">Zero escalated cases in current window.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );

  const renderNetworkAnalysis = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black uppercase tracking-tighter">Network Topology Analysis</h2>
        <div className="flex items-center gap-4">
            <div className="bg-[#131b2e] px-3 py-1.5 rounded-md border border-white/10 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#c6c6cd] text-sm" data-icon="search">search</span>
                <input 
                    type="text" 
                    placeholder="Search Account ID..." 
                    className="bg-transparent border-none outline-none text-[10px] font-bold text-[#dae2fd] w-40"
                    value={searchAccount}
                    onChange={(e) => setSearchAccount(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchSubgraph()}
                />
                <button onClick={fetchSubgraph} className="text-[#66dd8b] text-[10px] font-black uppercase">Trace</button>
            </div>
            <div className="bg-[#131b2e] px-4 py-2 rounded-md border border-white/5 flex items-center gap-3">
              <span className="text-[10px] uppercase font-bold text-[#c6c6cd]">Analysis Depth</span>
              <select className="bg-transparent text-xs font-bold outline-none border-none text-[#66dd8b] cursor-pointer">
                <option>2 Degrees</option>
                <option>3 Degrees</option>
                <option>4 Degrees</option>
              </select>
            </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 glass-panel h-[700px] relative rounded-lg overflow-hidden border border-[#66dd8b]/20 bg-[#070d1a]/50">
          {searchingGraph ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="w-16 h-16 border-t-2 border-[#66dd8b] rounded-full animate-spin mb-4"></div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#66dd8b]">Querying Graph Database...</p>
            </div>
          ) : subgraph ? (
            <div className="p-8 h-full flex flex-col">
                <div className="flex justify-between items-center mb-10">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-[#66dd8b] uppercase tracking-widest">Root Node</span>
                        <span className="text-2xl font-black text-[#dae2fd] font-mono">{searchAccount}</span>
                    </div>
                    <div className="flex gap-10">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-[#c6c6cd] uppercase">Nodes</span>
                            <span className="text-xl font-bold">{subgraph.nodes?.length || 0}</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-[#c6c6cd] uppercase">Edges</span>
                            <span className="text-xl font-bold">{subgraph.edges?.length || 0}</span>
                        </div>
                    </div>
                </div>
                <div className="flex-1 border border-white/5 rounded-xl bg-white/[0.01] relative flex items-center justify-center overflow-auto p-4">
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                       {subgraph.nodes?.map(node => (
                           <div key={node.id} className="bg-[#131b2e] p-4 rounded-lg border border-white/5 flex flex-col items-center gap-2 group hover:border-[#66dd8b]/30 transition-all">
                               <div className={`w-12 h-12 rounded-full flex items-center justify-center ${node.id === searchAccount ? 'bg-[#66dd8b] text-black' : 'bg-white/10 text-[#c6c6cd]'}`}>
                                   <span className="material-symbols-outlined" data-icon="person">person</span>
                               </div>
                               <span className="text-[9px] font-mono truncate w-full text-center uppercase">{node.id}</span>
                               <span className="text-[8px] font-bold text-[#66dd8b] opacity-0 group-hover:opacity-100 transition-opacity">Trace Edge</span>
                           </div>
                       ))}
                   </div>
                </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center">
              <div className="w-20 h-20 border-t-2 border-[#66dd8b] rounded-full animate-spin mb-6 opacity-40"></div>
              <h4 className="text-lg font-bold text-[#dae2fd] mb-2 uppercase tracking-tight">Graph Engine Initializing</h4>
              <p className="text-sm text-[#c6c6cd] max-w-md italic">Enter an Account ID above to trace fund flows and layering patterns. Our Graph Manager builds a temporal-spatial map of all related entities.</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="glass-panel p-5 rounded-lg border border-white/5">
            <h4 className="text-xs font-bold uppercase tracking-widest text-[#66dd8b] mb-4">Entity Inspector</h4>
            <div className="border-t border-white/5 pt-4">
              {subgraph ? (
                <div className="space-y-4">
                    <div className="bg-white/5 p-3 rounded">
                        <p className="text-[10px] font-bold text-[#c6c6cd] uppercase mb-1">Behavioral Match</p>
                        <p className="text-xs font-black text-[#66dd8b]">87% CONSISTENT</p>
                    </div>
                    <div className="bg-white/5 p-3 rounded">
                        <p className="text-[10px] font-bold text-[#c6c6cd] uppercase mb-1">Max Layering Depth</p>
                        <p className="text-xs font-black">4 HOPS</p>
                    </div>
                </div>
              ) : (
                <>
                    <p className="text-[10px] text-[#c6c6cd] italic mb-4 text-center">Select an account node to inspect behavioral baseline and relationship risk.</p>
                    <div className="space-y-3 opacity-20">
                    <div className="h-10 bg-white/5 rounded"></div>
                    <div className="h-32 bg-white/5 rounded"></div>
                    <div className="h-10 bg-white/5 rounded"></div>
                    </div>
                </>
              )}
            </div>
          </div>
          <div className="glass-panel p-5 rounded-lg bg-red-500/5 border border-red-500/20">
            <h4 className="text-xs font-bold uppercase tracking-widest text-red-500 mb-4">Risk Hotspots</h4>
            <div className="space-y-2">
              {alerts.slice(0, 4).map(a => (
                <div key={a.alert_id} onClick={() => setSearchAccount(a.subject_account_id)} className="text-[10px] flex justify-between items-center p-2 bg-red-500/10 rounded border border-red-500/10 cursor-pointer hover:bg-red-500/20 transition-all">
                  <span className="font-mono text-[#c6c6cd]">{a.subject_account_id?.slice(0, 12)}...</span>
                  <span className="font-bold text-red-400">SCORE {a.risk_score?.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCaseManagement = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black uppercase tracking-tighter">Universal Case Management</h2>
        <button className="bg-[#66dd8b] text-black px-4 py-2 rounded-md text-[10px] font-black uppercase hover:opacity-90 transition-opacity flex items-center gap-2">
          <span className="material-symbols-outlined text-sm" data-icon="add">add</span> New Manual Case
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KPIItem title="Active Queue" value={cases.filter(c => c.state !== 'CLOSED_SAR_FILED').length} color="text-[#66dd8b]" />
        <KPIItem title="Needs Review" value={cases.filter(c => c.state === 'UNDER_REVIEW').length || 0} color="text-[#ffa64d]" />
        <KPIItem title="Escalated to SAR" value={cases.filter(c => c.state === 'ESCALATED').length || 0} color="text-red-500" />
      </div>

      <div className="glass-panel rounded-lg overflow-hidden border border-white/5">
        <div className="p-4 border-b border-white/5 bg-[#0d162d]/50 flex gap-4">
           {['All Cases', 'Active', 'Under Review', 'Escalated'].map((f, i) => (
             <button key={f} className={`text-[10px] font-bold uppercase px-4 py-1.5 rounded-sm transition-all ${i === 0 ? 'bg-[#66dd8b] text-black' : 'text-[#c6c6cd] hover:text-white hover:bg-white/5'}`}>{f}</button>
           ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0d162d] text-[10px] text-[#c6c6cd] uppercase tracking-tighter">
                <th className="px-6 py-4 font-medium">Case Reference</th>
                <th className="px-6 py-4 font-medium">Assignee</th>
                <th className="px-6 py-4 font-medium">Origin Alert</th>
                <th className="px-6 py-4 font-medium">Current State</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {cases.map((c) => (
                <tr key={c.case_id} className="border-b border-white/5 hover:bg-white/3 transition-colors group">
                  <td className="px-6 py-4">
                     <div className="flex flex-col">
                        <span className="font-mono text-[#66dd8b] font-bold">#{c.case_id.slice(-8).toUpperCase()}</span>
                        <span className="text-[9px] text-[#c6c6cd] uppercase mt-1">Entity: {c.subject_account_id}</span>
                     </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-[#c6c6cd]">{c.assigned_to || 'System Queue'}</td>
                  <td className="px-6 py-4 text-[#c6c6cd] font-mono text-[10px]">{c.alert_id?.slice(-8).toUpperCase()}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-sm text-[9px] font-black uppercase ${c.state === 'ESCALATED' ? 'bg-red-500/20 text-red-400' : c.state === 'OPEN' ? 'bg-[#66dd8b]/20 text-[#66dd8b]' : 'bg-[#ffa64d]/20 text-[#ffa64d]'}`}>
                      {c.state}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button className="bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-sm text-[9px] font-bold border border-white/10 uppercase transition-all">Review</button>
                      <button 
                        onClick={() => generateSAR(c.alert_id)}
                        className="bg-[#66dd8b]/10 text-[#66dd8b] hover:bg-[#66dd8b] hover:text-black px-3 py-1.5 rounded-sm text-[9px] font-bold border border-[#66dd8b]/30 uppercase transition-all"
                      >
                        Auto-SAR
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderSARReports = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
            <h2 className="text-2xl font-black uppercase tracking-tighter">AI/SAR Reports</h2>
            <p className="text-[10px] text-[#66dd8b] font-bold uppercase tracking-widest mt-1">Intelligence Engine Multi-Modal Analysis</p>
        </div>
        <div className="bg-[#131b2e] px-4 py-2 rounded-md border border-[#66dd8b]/20 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#66dd8b] text-sm animate-pulse" data-icon="auto_awesome">auto_awesome</span>
            <span className="text-[10px] font-black text-[#66dd8b]">GEMINI PRO-1.5 CONNECTED</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {sars.length === 0 ? (
            <div className="glass-panel p-20 rounded-lg text-center opacity-40 flex flex-col items-center border-dashed border-2 border-white/10">
              <span className="material-symbols-outlined text-6xl mb-4 text-[#c6c6cd]" data-icon="description">description</span>
              <p className="text-sm font-bold uppercase">No SAR Reports Generated</p>
              <p className="text-[10px] mt-2 italic">Reports appear here after AI narrative generation is triggered.</p>
            </div>
          ) : (
            sars.map(sar => (
              <div key={sar.sar_id} className="glass-panel p-6 rounded-lg border border-white/5 hover:border-[#66dd8b]/40 transition-all cursor-pointer group hover:bg-white/[0.02]">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="font-bold text-lg text-[#dae2fd] uppercase tracking-tight">Suspicious Activity Report</h4>
                    <p className="text-[9px] text-[#c6c6cd] font-mono mt-1 opacity-60">ID: {sar.sar_id} | {new Date(sar.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-sm text-[9px] font-black uppercase border ${sar.status === 'COMPLETED' ? 'bg-[#66dd8b]/10 text-[#66dd8b] border-[#66dd8b]/30' : 'bg-[#ffa64d]/10 text-[#ffa64d] border-[#ffa64d]/30'}`}>
                    {sar.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-[#0d162d] p-3 rounded border border-white/5">
                    <p className="text-[9px] font-bold text-[#c6c6cd] uppercase mb-1">Subject</p>
                    <p className="text-xs font-mono text-[#dae2fd] truncate">{sar.subject_details?.name || sar.subject_id || 'UNKNOWN'}</p>
                  </div>
                  <div className="bg-[#0d162d] p-3 rounded border border-white/5">
                    <p className="text-[9px] font-bold text-[#c6c6cd] uppercase mb-1">Risk Confidence</p>
                    <p className="text-xs font-black text-red-500">92/100</p>
                  </div>
                </div>

                <div className="bg-[#070d1a] p-4 rounded text-[11px] leading-relaxed text-[#c6c6cd] border-l-2 border-[#66dd8b] h-24 overflow-hidden relative font-inter">
                   {sar.narrative_draft || 'AI ENGINE: Synthesizing transaction history, topological features, and behavioral anomalies for regulatory submission...'}
                   <div className="absolute bottom-0 left-0 w-full h-10 bg-gradient-to-t from-[#070d1a] to-transparent"></div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0b1326] text-white font-inter">
      {/* Sidebar Navigation */}
      <aside className="fixed left-0 top-0 h-screen w-64 border-r border-white/5 bg-[#0b1326] flex flex-col py-8 z-50 hidden md:flex shadow-[20px_0_40px_rgba(0,0,0,0.5)]">
        <div className="px-8 mb-12 flex items-center gap-3 group cursor-pointer" onClick={() => setActiveTab('dashboard')}>
          <div className="w-10 h-10 bg-[#66dd8b] rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(102,221,139,0.3)] group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-black font-black text-2xl" data-icon="shield_with_heart">shield_with_heart</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black text-[#dae2fd] tracking-[0.2em] uppercase leading-none">TRACR</span>
            <span className="text-[8px] font-bold text-[#66dd8b] uppercase tracking-[0.3em] mt-1">Intelligence</span>
          </div>
        </div>
        
        <nav className="flex-1 space-y-2 px-4">
          {navItems.map((item) => (
            <div 
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-4 px-5 py-3.5 rounded-lg cursor-pointer active:scale-95 transition-all duration-300 label-sm uppercase font-bold tracking-wider ${
                activeTab === item.id 
                  ? 'text-black bg-[#66dd8b] shadow-[0_4px_15px_rgba(102,221,139,0.2)]' 
                  : 'text-[#c6c6cd] hover:text-[#dae2fd] hover:bg-white/[0.03]'
              }`}
            >
              <span className="material-symbols-outlined text-xl" data-icon={item.icon}>{item.icon}</span>
              <span className="text-[11px]">{item.label}</span>
            </div>
          ))}
        </nav>

        <div className="px-6 mt-auto">
          <div className="bg-[#131b2e] p-5 rounded-xl border border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-[#66dd8b] opacity-5 blur-2xl group-hover:opacity-10 transition-opacity"></div>
            <p className="text-[9px] font-black text-[#66dd8b] uppercase tracking-widest mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#66dd8b] rounded-full animate-pulse"></span>
                Network Core
            </p>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-[#dae2fd] font-mono font-bold tracking-tighter">API_V1: STABLE</span>
              <span className="text-[8px] text-[#c6c6cd] font-mono opacity-50">Latency: 24ms</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Top App Bar */}
      <header className="fixed top-0 right-0 w-full md:w-[calc(100%-16rem)] h-16 backdrop-blur-2xl bg-[#0b1326]/60 flex items-center justify-between px-8 z-40 border-b border-white/5">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 bg-white/[0.03] px-3 py-1.5 rounded-lg border border-white/5 focus-within:border-[#66dd8b]/30 transition-all">
            <span className="material-symbols-outlined text-[#c6c6cd] text-lg" data-icon="search">search</span>
            <input type="text" placeholder="Trace entity or case..." className="bg-transparent border-none outline-none text-xs w-48 font-medium text-[#dae2fd] placeholder:text-[#c6c6cd]/50" />
          </div>
          <div className="h-4 w-px bg-white/10 hidden lg:block"></div>
          <h1 className="font-inter text-[10px] font-bold uppercase tracking-widest text-[#c6c6cd] hidden lg:block">
            Core <span className="mx-2 opacity-30">/</span> <span className="text-[#dae2fd]">{activeTab}</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-5">
           {/* SIMULATOR CONTROLS */}
           <div className="flex gap-2 items-center bg-white/[0.03] p-1 rounded-lg border border-white/5">
                <button 
                  onClick={() => fetch('/api/simulator/trigger-anomaly', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ type: 'CIRCULAR_TRADING' })
                  })}
                  className="px-3 py-1.5 rounded-md text-[9px] font-black uppercase text-purple-400 hover:bg-purple-400 hover:text-black transition-all"
                >
                  Circular
                </button>
                <div className="w-px h-3 bg-white/10"></div>
                <button 
                  onClick={() => fetch('/api/simulator/trigger-anomaly', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ type: 'SMURFING' })
                  })}
                  className="px-3 py-1.5 rounded-md text-[9px] font-black uppercase text-orange-400 hover:bg-orange-400 hover:text-black transition-all"
                >
                  Smurfing
                </button>
           </div>

          <div className="flex items-center gap-3 pl-4 border-l border-white/10">
            <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black text-[#dae2fd] leading-tight uppercase">Admin Investigator</p>
                <p className="text-[8px] font-bold text-[#66dd8b] uppercase tracking-widest opacity-70">Level 4 Access</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#66dd8b] to-[#4da6ff] p-[1.5px] group cursor-pointer transition-transform hover:rotate-12">
              <div className="w-full h-full rounded-[10px] bg-[#0b1326] overflow-hidden">
                <img className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBx_JiVeeT4J66py0o85u5033eYh3NSP52Mp3O-HfOmpZvetKs0wwGIFwdp9ogyI7XXg1zIrkbgpHjkiNhPIwM5pm7PBRRlq2ayAdVp3XCj1jU9ctDNHOeQkGpyaUecLF6RIfou3UCdLQrdpnsAe64ezxaJluPLGOm1LHUut262rxtSOHFNM8fqCLm95RkNd1yTFgoOIihJMiUj9rKHzfjjFG7LwGhvazE8tLax8ybrm-wHK6fS3v5Kc3gLN67hBfIvzSJRXe2-pPKk" alt="Avatar" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="pt-24 pb-24 px-4 md:pl-72 md:pr-10 max-w-full overflow-hidden min-h-screen">
        {loading ? (
          <div className="h-[70vh] flex flex-col items-center justify-center">
            <div className="relative">
                <div className="w-16 h-16 border-2 border-[#66dd8b]/20 rounded-full"></div>
                <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-[#66dd8b] rounded-full animate-spin"></div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#66dd8b] mt-8 animate-pulse">Syncing Intelligence Layer</p>
            {errorMsg && (
              <div className="mt-10 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-center">
                <p className="text-xs text-red-500 font-bold mb-2">INTELLIGENCE SYNC FAILURE</p>
                <p className="text-[10px] text-[#c6c6cd] font-mono">{errorMsg}</p>
                <button onClick={() => initialize()} className="mt-4 px-4 py-2 bg-[#66dd8b] text-black text-[10px] font-black uppercase rounded hover:opacity-90">Retry Connection</button>
              </div>
            )}
            <button onClick={() => setLoading(false)} className="mt-10 text-[9px] text-[#c6c6cd] underline uppercase tracking-widest opacity-50 hover:opacity-100">Bypass Sync & Enter Offline Mode</button>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'network' && renderNetworkAnalysis()}
            {activeTab === 'cases' && renderCaseManagement()}
            {activeTab === 'sar' && renderSARReports()}
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
        body { font-family: 'Inter', sans-serif; }
        .glass-panel { background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.05); }
      `}} />
    </div>
  );
}

function KPIItem({ title, value, color, showLive, showSocketPulse }) {
  return (
    <div className="glass-panel p-6 rounded-xl relative overflow-hidden group">
      <p className="text-[9px] text-[#c6c6cd] font-black uppercase tracking-[0.2em] mb-2">{title}</p>
      <div className="flex items-end justify-between relative z-10">
        <h2 className={`text-4xl font-black ${color} tracking-tighter`}>{value}</h2>
        {showLive && <div className="bg-red-500/10 px-2 py-1 rounded text-[8px] text-red-400 font-bold">LIVE</div>}
      </div>
    </div>
  );
}

function AlertCard({ alert }) {
  const isHigh = alert.risk_tier === 'HIGH';
  return (
    <div className={`p-4 rounded-xl border group ${isHigh ? 'bg-red-500/[0.03] border-red-500/20' : 'bg-white/[0.02] border-white/5'}`}>
      <div className="flex justify-between items-start mb-3">
        <div className={`px-2 py-0.5 rounded text-[8px] font-black ${isHigh ? 'bg-red-500/10 text-red-500' : 'bg-[#66dd8b]/10 text-[#66dd8b]'}`}>
          RISK: {alert.risk_score ? alert.risk_score.toFixed(0) : 'N/A'}%
        </div>
      </div>
      <h4 className="text-[11px] font-black text-[#dae2fd] uppercase">{alert.pattern_type || 'Anomaly'}</h4>
    </div>
  );
}

function CaseRow({ c, onGenerateSAR }) {
  return (
    <tr className="border-b border-white/5 hover:bg-white/[0.02]">
      <td className="px-6 py-5 font-mono text-[#dae2fd]">#{c.case_id?.slice(-8).toUpperCase()}</td>
      <td className="px-6 py-5 font-bold">{c.subject_id}</td>
      <td className="px-6 py-5">
        <span className={`px-2 py-1 rounded text-[8px] font-black ${c.state === 'ESCALATED' ? 'bg-red-500/10 text-red-400' : 'bg-[#66dd8b]/10 text-[#66dd8b]'}`}>{c.state}</span>
      </td>
      <td className="px-6 py-5 text-right">
        <button onClick={onGenerateSAR} className="bg-[#66dd8b]/10 text-[#66dd8b] px-3 py-1.5 rounded text-[9px] font-black uppercase border border-[#66dd8b]/30">Auto-SAR</button>
      </td>
    </tr>
  );
}

function StatBar({ label, value }) {
  return (
    <div>
      <div className="flex justify-between text-[8px] font-black text-[#c6c6cd] uppercase mb-1.5">
        <span>{label}</span>
        <span className="text-[#66dd8b]">{value}</span>
      </div>
      <div className="w-full h-1 bg-white/[0.05] rounded-full overflow-hidden">
        <div className="h-full bg-[#66dd8b]" style={{ width: value }}></div>
      </div>
    </div>
  );
}
