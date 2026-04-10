'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Activity, ShieldAlert, Network, ArrowLeft, FileDown, Download, Wallet, Fingerprint, Search } from 'lucide-react'

const GlobalHeatmap = dynamic(() => import('@/components/GlobalHeatmap'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-gray-400 font-mono text-sm animate-pulse">
      Initializing Map Engine...
    </div>
  )
})

interface Alert {
  alert_id: string;
  pattern_type: string;
  risk_score: number;
  subject_account_id: string;
  detected_at: string;
  risk_tier: string;
  involved_accounts: string[];
}

interface Metrics {
  total_volume: number;
  alertCounts: { HIGH: number; MEDIUM: number; LOW: number };
  total_transactions: number;
}

export default function AnalysisPage() {
  const [isExporting, setIsExporting] = useState(false)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [statusMsg, setStatusMsg] = useState('System Ready')
  const [metrics, setMetrics] = useState<Metrics>({
    total_volume: 0,
    alertCounts: { HIGH: 0, MEDIUM: 0, LOW: 0 },
    total_transactions: 0
  })

  // Load initial threats and setup WebSocket
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/alerts?limit=10');
        const data = await res.json();
        if (data.items) {
          setAlerts(data.items);
          if (data.items.length > 0) setSelectedAlert(data.items[0]);
        }
      } catch (err) {
        console.error('Failed to fetch initial alerts:', err);
      }
    };
    
    fetchAlerts();

    // Setup Socket.io
    const socket = io('http://localhost:5000', {
      transports: ['websocket'],
      auth: { role: 'ADMIN' }
    });

    socket.on('alert:new', (newAlert: Alert) => {
      console.log('New Live Alert Received:', newAlert.alert_id);
      setAlerts(prev => {
        // Avoid duplicates if rest fetch and socket overlap
        if (prev.some(a => a.alert_id === newAlert.alert_id)) return prev;
        return [newAlert, ...prev.slice(0, 9)];
      });
      // Automatically select if none selected
      setSelectedAlert(current => current || newAlert);
    });

    socket.on('metrics:update', (data: any) => {
      setMetrics({
        total_volume: data.total_volume || 0,
        alertCounts: data.alertCounts || { HIGH: 0, MEDIUM: 0, LOW: 0 },
        total_transactions: data.total_transactions || 0
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleExportReport = async () => {
    if (isExporting || !selectedAlert) return;
    
    setIsExporting(true)
    setStatusMsg(`Agent active: Analyzing ${selectedAlert.subject_account_id.slice(0, 8)}...`)
    
    try {
      console.log('Initiating Agent-Driven SAR Export...');
      
      // 1. Call AI Agent Backend for Narrative
      const aiRes = await fetch('http://localhost:8000/sar/generate-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: selectedAlert.alert_id })
      });
      
      if (!aiRes.ok) throw new Error('AI Backend unreachable');
      
      const sarData = await aiRes.json();
      
      // 2. Dynamically import the PDF generator
      const { generateSARReport } = await import('@/utils/SARReportGenerator')
      
      // 3. Extract agent name from recommended fields or narrative
      const agentName = sarData.recommended_fields?.['Investigator Agent'] || 'Agent SENTINEL';

      const reportData = {
        caseId: `SAR-${selectedAlert.alert_id}`,
        status: selectedAlert.risk_tier,
        detectedAt: new Date(selectedAlert.detected_at).toLocaleString(),
        narrative: sarData.sar_narrative,
        agentName: agentName,
        threats: [
          { 
            type: selectedAlert.pattern_type.replace('_', ' '), 
            severity: selectedAlert.risk_tier, 
            count: selectedAlert.involved_accounts?.length || 1 
          }
        ],
        behavioralSignals: sarData.risk_indicators || [
          "Automated pattern detection triggered",
          "Risk score exceeds threshold"
        ]
      }

      await generateSARReport(reportData)
      setStatusMsg('SAR Report Generated Successfully.')
      console.log('SAR Export successful.');
    } catch (error) {
      console.error('Failed to generate SAR report:', error);
      setStatusMsg('Export failed. Check AI Service.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-white p-4 sm:p-6 font-sans selection:bg-indigo-500/30 relative overflow-x-hidden">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 mesh-bg opacity-40 pointer-events-none" />
      <div className="fixed inset-0 grid-overlay opacity-30 pointer-events-none" />

      {/* Top Navbar */}
      <header className="relative z-20 flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-[var(--glass-border)] pb-4 sm:pb-6 mb-6 sm:mb-8 gap-4 sm:gap-0 backdrop-blur-sm">
        
        <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
          <Link 
            href="/"
            className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--glass-bg)] hover:bg-[var(--glass-bg-hover)] border border-[var(--glass-border)] text-gray-400 hover:text-white transition-all shadow-sm group"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          </Link>
          
          <div className="flex flex-col">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-500 font-metropolis uppercase">
              SATYA FLOW
            </h1>
            <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-indigo-400 font-semibold mt-0.5 flex items-center gap-1.5">
              <Fingerprint size={10} />
              Command Center // Agentic Intelligence
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
          <div className="flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-2 px-4 py-2 rounded-xl glass border border-[var(--glass-border)] text-indigo-400">
            <Activity size={14} className="text-indigo-400" />
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-200">Live Traffic</span>
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse ml-1 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
          </div>
          <div className="flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-2 px-4 py-2 rounded-xl glass border border-rose-900/40" style={{ background: 'rgba(251, 113, 133, 0.05)' }}>
            <ShieldAlert size={14} className="text-rose-400" />
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-rose-200">{metrics.alertCounts.HIGH} Critical</span>
          </div>
        </div>
      </header>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Sidebar (Now Real-Time) */}
        <div className="col-span-1 space-y-6">
          <div className="p-5 rounded-2xl glass flex flex-col h-full sm:h-auto">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-6 flex items-center gap-2">
              <Network size={14} />
              Global Telemetry
            </h3>
            
            <div className="space-y-6">
              <div className="pb-5 border-b border-[var(--glass-border)]">
                <div className="text-[11px] font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Total Monitored Vol. (24h)</div>
                <div className="text-2xl sm:text-3xl font-light tracking-tight text-white">
                  ${(metrics.total_volume / 1000000000).toFixed(1)}B
                </div>
              </div>
              <div className="pb-5 border-b border-[var(--glass-border)]">
                <div className="text-[11px] font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Processed Transactions</div>
                <div className="text-xl sm:text-2xl font-light text-rose-400 flex items-center gap-2">
                  {metrics.total_transactions.toLocaleString()}
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    LIVE
                  </span>
                </div>
              </div>
              <div className="pb-2">
                <div className="text-[11px] font-medium text-gray-500 mb-1.5 uppercase tracking-wide">High-Risk Nodes</div>
                <div className="text-xl sm:text-2xl font-light text-amber-400">{metrics.alertCounts.HIGH + metrics.alertCounts.MEDIUM}</div>
              </div>
            </div>

            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400 mt-8 mb-4 border-b border-indigo-500/20 pb-2">
              Live Threat Radar
            </h3>
            
            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {alerts.length === 0 ? (
                <div className="text-center py-6 text-gray-600 text-[10px] font-mono uppercase tracking-widest animate-pulse italic">Awaiting signals...</div>
              ) : (
                alerts.map(alert => (
                  <button
                    key={alert.alert_id}
                    onClick={() => setSelectedAlert(alert)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all duration-300 group ${
                      selectedAlert?.alert_id === alert.alert_id 
                        ? 'bg-indigo-600/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]' 
                        : 'bg-white/5 border-transparent hover:border-white/20'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        alert.risk_tier === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {alert.pattern_type}
                      </span>
                      <span className="text-[9px] font-mono text-gray-500">{alert.risk_score.toFixed(1)}</span>
                    </div>
                    <div className="text-sm font-medium text-gray-200 truncate group-hover:text-white transition-colors">
                      {alert.subject_account_id}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[8px] text-gray-500 uppercase tracking-tighter">
                      <span>{alert.alert_id}</span>
                      <span>{new Date(alert.detected_at).toLocaleTimeString()}</span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-[var(--glass-border)]">
               <div className="p-3 bg-white/5 rounded-xl border border-white/10 mb-4">
                  <div className="text-[9px] text-gray-500 uppercase font-bold mb-1">Active Subject</div>
                  <div className="text-xs font-mono text-indigo-300 break-all">
                    {selectedAlert?.subject_account_id || '---'}
                  </div>
               </div>

              <button 
                onClick={handleExportReport}
                disabled={isExporting || !selectedAlert}
                className={`w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl font-bold text-[10px] uppercase tracking-[0.15em] transition-all shadow-lg active:scale-[0.98] ${
                  isExporting 
                    ? 'bg-gray-800 cursor-not-allowed text-gray-500' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/30'
                }`}
              >
                {isExporting ? (
                  <>
                    <Activity size={14} className="animate-spin" />
                    Agent Processing...
                  </>
                ) : (
                  <>
                    <FileDown size={14} />
                    Generate Agent SAR
                  </>
                )}
              </button>
              <p className="mt-3 text-[8px] text-center text-gray-500 font-mono italic">
                {statusMsg}
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl glass">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4 flex items-center justify-between">
              Intelligence Feed
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
            </h3>
            <div className="h-40 font-mono text-[10px] text-gray-400 overflow-hidden flex flex-col justify-end space-y-2">
              <div className="text-gray-600">&gt; Node [x8f] suspicious routing detected</div>
              <div className="text-gray-500">&gt; CROSS_BORDER_WASH: High Confidence</div>
              <div className="text-gray-400">&gt; Initializing XAI Narrator... OK</div>
              <div className="text-indigo-400 font-medium">&gt; {selectedAlert ? `Focusing on ${selectedAlert.alert_id}` : 'Waiting for selection...'}</div>
              <div className="text-indigo-300 animate-pulse mt-2">_</div>
            </div>
          </div>
        </div>

        {/* Right Main Panel: Global View */}
        <div className="col-span-1 lg:col-span-3">
          <div className="w-full h-[600px] lg:h-[750px] rounded-2xl overflow-hidden shadow-2xl relative group glass !p-0 border-[var(--glass-border)] bg-[#050505]">
            
            {/* Map Container */}
            <div className="absolute inset-0 opacity-90 mix-blend-screen filter saturate-[0.75] contrast-[1.1]">
              <GlobalHeatmap 
                onCountryClick={(iso) => console.log(`Drilled down on ${iso}`)}
              />
            </div>

            {/* Premium Soft Gradients Overlay */}
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#050505] via-[#050505]/60 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-transparent pointer-events-none" />
            <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#050505] via-[#050505]/60 to-transparent pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#050505] via-[#050505]/60 to-transparent pointer-events-none" />
            
            {/* Subject Detail Overlay (HUD) */}
            <AnimatePresence>
              {selectedAlert && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="absolute bottom-10 right-10 z-30 p-6 rounded-3xl backdrop-blur-2xl border border-white/10 bg-slate-900/40 w-72 shadow-2xl"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center border border-rose-500/30">
                      <ShieldAlert className="text-rose-500" size={20} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-tighter">Threat Profile</h4>
                      <p className="text-[10px] text-rose-400 font-mono font-bold">{selectedAlert.alert_id}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Wallet Hash</div>
                      <div className="text-xs font-mono text-white truncate bg-white/5 p-2 rounded-lg border border-white/5">
                        {selectedAlert.subject_account_id}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Risk Score</div>
                        <div className="text-xl font-light text-rose-500">{selectedAlert.risk_score.toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Peers</div>
                        <div className="text-xl font-light text-indigo-400">{selectedAlert.involved_accounts?.length || 'N/A'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[8px] text-gray-500 uppercase tracking-widest">Confidence Index</span>
                    <span className="text-[10px] font-bold text-emerald-400 font-mono">98.2%</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>
    </div>
  )
}
