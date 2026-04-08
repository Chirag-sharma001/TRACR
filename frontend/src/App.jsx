import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

export default function App() {
  // State for Real-Time and Fetched Data
  const [metrics, setMetrics] = useState({
    tps: 0,
    alertCounts: { HIGH: 0, MEDIUM: 0, LOW: 0 },
    trend: []
  });
  const [alerts, setAlerts] = useState([]);
  const [cases, setCases] = useState([
    // Fallback mock data in case backend isn't seeded yet
    { _id: 'AML-882910', subject_id: 'Zenthia Global Ltd', typology: 'Value Layering', status: 'UNDER_REVIEW' },
    { _id: 'AML-882911', subject_id: 'Marcus Vane', typology: 'Structuring', status: 'ESCALATED' },
  ]);

  useEffect(() => {
    // 1. Fetch Initial Data (REST API)
    fetch('/api/alerts?limit=5')
      .then(res => {
         if (!res.ok) throw new Error("API not ready");
         return res.json();
      })
      .then(data => {
        if (data.alerts && data.alerts.length > 0) setAlerts(data.alerts);
      })
      .catch(err => console.warn('Alerts fetch failed. Backend might need seeding.', err));
      
    fetch('/api/cases?limit=5')
      .then(res => {
         if (!res.ok) throw new Error("API not ready");
         return res.json();
      })
      .then(data => {
         if (data.cases && data.cases.length > 0) setCases(data.cases);
      })
      .catch(err => console.warn('Cases fetch failed. Backend might need seeding.', err));

    // 2. Connect WebSocket to the Backend (via Vite Proxy)
    const socket = io();
    
    socket.on('connect', () => {
      console.log('Connected to Backend SocketGateway');
    });

    socket.on('metrics:update', (data) => {
      setMetrics(data);
    });

    socket.on('alert:new', (newAlert) => {
      setAlerts(prev => [newAlert, ...prev].slice(0, 10)); // keep top 10
    });

    return () => socket.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#0b1326] text-white">
      {/* Sidebar Navigation */}
      <aside className="fixed left-0 top-0 h-screen w-64 border-r border-transparent bg-[#0b1326] dark:bg-slate-950/70 shadow-2xl shadow-slate-950/50 backdrop-blur-3xl flex flex-col py-6 z-50 hidden md:flex">
        <div className="px-6 mb-10">
          <span className="text-xl font-black text-[#dae2fd] tracking-widest uppercase">TRACR</span>
        </div>
        <nav className="flex-1 space-y-2 px-3">
          <div className="flex items-center gap-3 px-4 py-3 rounded-md cursor-pointer active:scale-95 text-[#66dd8b] bg-[#131b2e] border-l-2 border-[#66dd8b] font-inter tracking-tight label-sm uppercase">
            <span className="material-symbols-outlined" data-icon="grid_view">grid_view</span>
            <span>Dashboard</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-md cursor-pointer active:scale-95 text-[#c6c6cd] hover:text-[#dae2fd] hover:bg-[#222a3d] transition-colors duration-200 font-inter tracking-tight label-sm uppercase">
            <span className="material-symbols-outlined" data-icon="hub">hub</span>
            <span>Network Analysis</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-md cursor-pointer active:scale-95 text-[#c6c6cd] hover:text-[#dae2fd] hover:bg-[#222a3d] transition-colors duration-200 font-inter tracking-tight label-sm uppercase">
            <span className="material-symbols-outlined" data-icon="folder_managed">folder_managed</span>
            <span>Case Management</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-md cursor-pointer active:scale-95 text-[#c6c6cd] hover:text-[#dae2fd] hover:bg-[#222a3d] transition-colors duration-200 font-inter tracking-tight label-sm uppercase">
            <span className="material-symbols-outlined" data-icon="description">description</span>
            <span>AI/SAR Reports</span>
          </div>
        </nav>
      </aside>

      {/* Top App Bar */}
      <header className="fixed top-0 right-0 w-full md:w-[calc(100%-16rem)] h-16 backdrop-blur-xl bg-[#0b1326]/80 flex items-center justify-between px-6 md:px-8 z-40">
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined text-[#66dd8b]" data-icon="search">search</span>
          <h1 className="font-inter text-sm font-medium text-[#c6c6cd]">The Intelligence Layer / <span className="text-[#dae2fd]">Dashboard</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center overflow-hidden">
            <img className="w-full h-full object-cover" data-alt="investigator" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBx_JiVeeT4J66py0o85u5033eYh3NSP52Mp3O-HfOmpZvetKs0wwGIFwdp9ogyI7XXg1zIrkbgpHjkiNhPIwM5pm7PBRRlq2ayAdVp3XCj1jU9ctDNHOeQkGpyaUecLF6RIfou3UCdLQrdpnsAe64ezxaJluPLGOm1LHUut262rxtSOHFNM8fqCLm95RkNd1yTFgoOIihJMiUj9rKHzfjjFG7LwGhvazE8tLax8ybrm-wHK6fS3v5Kc3gLN67hBfIvzSJRXe2-pPKk"/>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-24 px-4 md:pl-72 md:pr-8 max-w-full overflow-hidden">

        {/* KPI Row (Data-bound) */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-panel p-5 rounded-md relative overflow-hidden">
            <p className="label-sm text-on-surface-variant uppercase tracking-widest text-[10px] mb-1">Active High-Risk Alerts</p>
            <div className="flex items-end justify-between">
              <h2 className="text-3xl font-black text-on-tertiary-container">{metrics.alertCounts.HIGH || 0}</h2>
              {metrics.alertCounts.HIGH > 0 && <span className="text-[10px] text-tertiary bg-tertiary-container px-1.5 py-0.5 rounded-sm">Live</span>}
            </div>
          </div>
          <div className="glass-panel p-5 rounded-md relative overflow-hidden">
            <p className="label-sm text-on-surface-variant uppercase tracking-widest text-[10px] mb-1">Medium Risk Alerts</p>
            <div className="flex items-end justify-between">
              <h2 className="text-3xl font-black text-secondary-container">{metrics.alertCounts.MEDIUM || 0}</h2>
            </div>
          </div>
          <div className="glass-panel p-5 rounded-md relative overflow-hidden">
            <p className="label-sm text-on-surface-variant uppercase tracking-widest text-[10px] mb-1">Low Risk Alerts</p>
            <div className="flex items-end justify-between">
              <h2 className="text-3xl font-black text-on-primary-container">{metrics.alertCounts.LOW || 0}</h2>
            </div>
          </div>
          <div className="glass-panel p-5 rounded-md relative overflow-hidden">
            <p className="label-sm text-on-surface-variant uppercase tracking-widest text-[10px] mb-1">Live Transactions / Sec</p>
            <div className="flex items-end justify-between">
              <h2 className="text-3xl font-black text-primary">{metrics.tps.toFixed(1)}</h2>
              <span className="text-[10px] text-primary bg-primary-container px-1.5 py-0.5 rounded-sm animate-pulse">Socket Status: Active</span>
            </div>
          </div>
        </section>

        {/* Middle Section: Visualizations */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Topology Panel */}
          <div className="lg:col-span-2 glass-panel rounded-md flex flex-col h-[500px]">
            <div className="p-4 border-b border-outline-variant/10 flex items-center justify-between">
              <h3 className="label-sm font-bold tracking-widest uppercase">Transaction Network Topology</h3>
              {metrics.alertCounts.HIGH > 0 && (
                <div className="flex gap-2">
                  <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>
                  <span className="text-[10px] text-error font-medium uppercase">Active Threat Detected</span>
                </div>
              )}
            </div>
            <div className="flex-1 relative bg-surface-container-lowest overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center opacity-40">
                <p className="text-sm font-mono text-on-surface-variant italic">Network Graph Rendering Active. Nodes bound to WS updates.</p>
              </div>
              <div className="absolute bottom-4 left-4 flex flex-col gap-2 glass-panel p-3 rounded-sm scale-90 origin-bottom-left">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-error"></span><span className="text-[10px]">High Risk Entity</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary"></span><span className="text-[10px]">Verified Safe</span>
                </div>
              </div>
            </div>
          </div>

          {/* Live Anomaly Feed (Data-bound) */}
          <div className="glass-panel rounded-md flex flex-col h-[500px]">
            <div className="p-4 border-b border-outline-variant/10">
              <h3 className="label-sm font-bold tracking-widest uppercase">Live Anomaly Feed</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 hide-scrollbar">
              {alerts.length === 0 ? (
                <div className="text-center text-xs text-on-surface-variant p-4">Waiting for alerts...</div>
              ) : (
                alerts.map((alert, idx) => (
                  <div key={idx} className={`bg-surface-container-low p-3 rounded-md border-l-2 ${alert.risk_tier === 'HIGH' ? 'border-error' : alert.risk_tier === 'MEDIUM' ? 'border-secondary-container' : 'border-primary'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${alert.risk_tier === 'HIGH' ? 'text-error bg-tertiary-container/30' : 'text-secondary-container bg-secondary-container/10'}`}>
                        RISK {alert.risk_score ? alert.risk_score.toFixed(0) : 'N/A'}/100
                      </span>
                      <span className="text-[9px] text-on-surface-variant">{new Date(alert.created_at || Date.now()).toLocaleTimeString()}</span>
                    </div>
                    <h4 className="text-xs font-bold mb-1">{alert.typology || 'Anomaly Detected'}</h4>
                    <p className="text-[10px] text-on-surface-variant mb-2">Subject ID: {alert.subject_id}</p>
                    <div className="bg-surface-container-lowest p-2 rounded-sm italic text-[9px] text-primary/80 border-l border-primary/30">
                      AI Insight: {alert.explanation || 'Pending XAI execution.'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Bottom Section: Escalated Cases Pipeline (Data-bound) */}
        <section className="glass-panel rounded-md overflow-hidden">
          <div className="p-4 border-b border-outline-variant/10 flex items-center justify-between">
            <h3 className="label-sm font-bold tracking-widest uppercase">Escalated Cases Pipeline</h3>
            <div className="flex gap-2">
              <button className="bg-primary text-on-primary font-bold px-3 py-1.5 rounded-sm text-[10px] flex items-center gap-1 transition-all">
                <span className="material-symbols-outlined text-sm" data-icon="add">add</span> New Manual Case
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-lowest text-[10px] text-on-surface-variant uppercase tracking-tighter">
                  <th className="px-6 py-3 font-medium">Case ID</th>
                  <th className="px-6 py-3 font-medium">Entity</th>
                  <th className="px-6 py-3 font-medium">Typology</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {cases.map((c) => (
                  <tr key={c._id} className="border-b border-outline-variant/5 hover:bg-surface-container/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-on-surface-variant">#{c._id.slice(-6).toUpperCase()}</td>
                    <td className="px-6 py-4 font-bold">{c.subject_id}</td>
                    <td className="px-6 py-4">
                      <span className="bg-tertiary-container text-on-tertiary-container px-2 py-0.5 rounded-sm text-[9px]">{c.typology || 'Multi-Event'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'ESCALATED' ? 'bg-error' : 'bg-secondary-container'}`}></span>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="bg-primary/10 text-primary hover:bg-primary hover:text-on-primary px-3 py-1.5 rounded-sm text-[9px] font-bold border border-primary/30 transition-all">
                        Auto-Generate SAR via Gemini
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
