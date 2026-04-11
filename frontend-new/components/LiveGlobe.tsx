'use client'
import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  ComposableMap,
  Geographies,
  Geography,
  Line,
  ZoomableGroup,
  Marker
} from 'react-simple-maps'
import { io } from 'socket.io-client'
import { motion, AnimatePresence } from 'framer-motion'

// Mapping for countries commonly used in the simulator
const COUNTRY_COORDS: Record<string, [number, number]> = {
  'US': [-77.0369, 38.9072],   // DC
  'USA': [-100, 40],           // Center of US
  'GB': [-0.1278, 51.5074],    // London
  'GBR': [-0.1278, 51.5074],
  'IN': [77.2090, 28.6139],    // New Delhi
  'IND': [77.2090, 28.6139],
  'SG': [103.8198, 1.3521],    // Singapore
  'SGP': [103.8198, 1.3521],
  'AE': [55.2708, 25.2048],    // Dubai
  'ARE': [55.2708, 25.2048],
  'CH': [8.5417, 47.3769],     // Switzerland
  'CHE': [8.5417, 47.3769],
  'RU': [37.6173, 55.7558],    // Russia
  'RUS': [37.6173, 55.7558],
  'CN': [116.4074, 39.9042],   // China
  'CHN': [116.4074, 39.9042],
  'CYM': [-81.2546, 19.3133],  // Cayman Islands
  'PAN': [-79.5199, 8.9824],   // Panama
  'VGB': [-64.6399, 18.4207],  // BVI
  'IR': [51.3890, 35.6892],    // Iran
  'KP': [125.7625, 39.0392],   // North Korea
  'MM': [96.1735, 16.8661],    // Myanmar
};

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

interface FlowArc {
  id: string
  src: [number, number]
  dst: [number, number]
  amount: number
  isSuspicious: boolean
  senderAddress: string
  receiverAddress: string
  pattern?: string
  timestamp: number
}

interface HubNode {
  id: string
  coords: [number, number]
  count: number
  lastUpdated: number
}

interface SuspiciousFeed {
  id: string
  address: string
  amount: number
  pattern: string
  timestamp: number
}

interface NetworkNode {
    id: string
    address: string
    coords: [number, number]
    country: string
    pattern: string
    riskScore: number
    lastActive: number
}

interface NetworkEdge {
    id: string
    from: string // address
    to: string // address
    fromCoords: [number, number]
    toCoords: [number, number]
    lastActive: number
}

export default function LiveGlobe() {
  const [flows, setFlows] = useState<FlowArc[]>([])
  const [hubs, setHubs] = useState<Record<string, HubNode>>({})
  const [feeds, setFeeds] = useState<SuspiciousFeed[]>([])
  const [nodes, setNodes] = useState<Record<string, NetworkNode>>({})
  const [edges, setEdges] = useState<Record<string, NetworkEdge>>({})
  const [metrics, setMetrics] = useState({ tps: 0, activeHubs: 0, alertCount: 0 })
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [filter, setFilter] = useState('ALL')
  const [activeFraud, setActiveFraud] = useState(false)
  const socketRef = useRef<any>(null)

  // Identify neighbors of the hovered node for networking highlighting
  const activeNetwork = useMemo(() => {
    if (!hoveredNodeId) return null;
    const connected = new Set<string>([hoveredNodeId]);
    Object.values(edges).forEach(edge => {
      if (edge.from === hoveredNodeId) connected.add(edge.to);
      if (edge.to === hoveredNodeId) connected.add(edge.from);
    });
    return connected;
  }, [hoveredNodeId, edges]);

  useEffect(() => {
    // Connect to backend socket
    socketRef.current = io('http://localhost:5000', {
        transports: ['websocket'],
        auth: { role: 'ADMIN' }
    });

    socketRef.current.on('connect', () => {
        console.log('Connected to Live Fund Flow socket');
    });

    const handleMessage = (e: MessageEvent) => {
        if (!e.data || !e.data.cmd) return;
        const { cmd, value } = e.data;
        if (cmd === 'FILTER_FLOW') setFilter(value || 'ALL');
        if (cmd === 'REPORT_ANALYTICS') console.log('Generating report for', value);
    }
    window.addEventListener('message', handleMessage);

    socketRef.current.on('transaction:saved', (tx: any) => {
        const srcCountry = tx.geolocation?.sender_country || 'US';
        const dstCountry = tx.geolocation?.receiver_country || 'CYM';
        
        const srcCoords = COUNTRY_COORDS[srcCountry] || [-74, 40];
        const dstCoords = COUNTRY_COORDS[dstCountry] || [-81, 19];

        const newFlow: FlowArc = {
            id: Math.random().toString(36).substr(2, 9),
            src: srcCoords,
            dst: dstCoords,
            amount: tx.amount_usd,
            isSuspicious: !!tx.pattern_tag,
            senderAddress: tx.sender_account_id,
            receiverAddress: tx.receiver_account_id,
            pattern: tx.pattern_tag,
            timestamp: Date.now()
        };

        setFlows(prev => [...prev.slice(-15), newFlow]);

        // Network Graph Logic for Suspicious Transactions
        if (tx.pattern_tag) {
            const getJitteredCoords = (cc: string): [number, number] => {
                const base = COUNTRY_COORDS[cc] || [-74, 40];
                return [
                    base[0] + (Math.random() - 0.5) * 6, // Jitter for longitude
                    base[1] + (Math.random() - 0.5) * 6  // Jitter for latitude
                ];
            };

            const senderId = tx.sender_account_id;
            const receiverId = tx.receiver_account_id;

            setNodes(prev => {
                const next = { ...prev };
                if (!next[senderId]) {
                    next[senderId] = {
                        id: senderId,
                        address: senderId,
                        coords: getJitteredCoords(srcCountry),
                        country: srcCountry,
                        pattern: tx.pattern_tag,
                        riskScore: 75 + Math.random() * 24.5,
                        lastActive: Date.now()
                    };
                } else {
                    next[senderId].lastActive = Date.now();
                }

                if (!next[receiverId]) {
                    next[receiverId] = {
                        id: receiverId,
                        address: receiverId,
                        coords: getJitteredCoords(dstCountry),
                        country: dstCountry,
                        pattern: tx.pattern_tag,
                        riskScore: 75 + Math.random() * 24.5,
                        lastActive: Date.now()
                    };
                } else {
                    next[receiverId].lastActive = Date.now();
                }
                return next;
            });

            setEdges(prev => {
                const edgeId = `${senderId}->${receiverId}`;
                const next = { ...prev };
                // We rely on nodes being updated first or concurrently. 
                // In this state batch, we can assume the jittered coords are available if we do it carefully.
                // However, setNodes and setEdges are async. We'll use the calculated ones.
            });

            // Refined edge update to use current jittered coords or existing ones
            setEdges(prev => {
                const edgeId = `${senderId}->${receiverId}`;
                return {
                    ...prev,
                    [edgeId]: {
                        id: edgeId,
                        from: senderId,
                        to: receiverId,
                        // We'll let the renderer look up coordinates from node state to keep it consistent
                        fromCoords: [0,0], // placeholder
                        toCoords: [0,0], // placeholder
                        lastActive: Date.now()
                    }
                };
            });

            setMetrics(p => ({ ...p, alertCount: p.alertCount + 1 }));
            const newFeed: SuspiciousFeed = {
                id: Math.random().toString(36).substr(2, 9),
                address: tx.sender_account_id,
                amount: tx.amount_usd,
                pattern: tx.pattern_tag,
                timestamp: Date.now()
            };
            setFeeds(prev => [newFeed, ...prev.slice(0, 7)]);
        }

        // Update Hub Detection
        setHubs(prev => {
            const next = { ...prev };
            const country = dstCountry;
            const coords = dstCoords;

            if (!next[country]) {
                next[country] = { id: country, coords, count: 1, lastUpdated: Date.now() };
            } else {
                next[country] = { ...next[country], count: next[country].count + 1, lastUpdated: Date.now() };
            }
            return next;
        });
    });

    socketRef.current.on('metrics:update', (data: any) => {
        setMetrics(p => ({ ...p, tps: data.tps }));
    });

    // Cleanup interval for old arcs and decaying hubs/nodes
    const cleanup = setInterval(() => {
        const now = Date.now();
        setFlows(prev => prev.filter(f => now - f.timestamp < 10000));
        
        setHubs(prev => {
            const next = { ...prev };
            let changed = false;
            Object.keys(next).forEach(key => {
                if (now - next[key].lastUpdated > 60000) {
                    delete next[key];
                    changed = true;
                }
            });
            return changed ? next : prev;
        });

        setNodes(prev => {
            const next = { ...prev };
            let changed = false;
            Object.keys(next).forEach(id => {
                if (now - next[id].lastActive > 30000) {
                    delete next[id];
                    changed = true;
                }
            });
            return changed ? next : prev;
        });

        setEdges(prev => {
            const next = { ...prev };
            let changed = false;
            Object.keys(next).forEach(id => {
                if (now - next[id].lastActive > 30000) {
                    delete next[id];
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, 2000);

    return () => {
        socketRef.current?.disconnect();
        window.removeEventListener('message', handleMessage);
        clearInterval(cleanup);
    };
  }, []);

  const activeHubList = useMemo(() => {
    return Object.values(hubs).filter(h => h.count > 5);
  }, [hubs]);

  const getRiskColor = (score: number) => {
    if (score > 92) return '#f43f5e'; // Critical (Rose)
    if (score > 85) return '#f97316'; // Elevated (Orange)
    return '#fbbf24'; // Moderate (Amber)
  };

  const getRiskGlow = (score: number) => {
    if (score > 92) return 'url(#glow-red)';
    if (score > 85) return 'url(#glow-orange)';
    return 'url(#glow-amber)';
  };

  return (
    <div className="relative w-full h-full bg-[#020617] overflow-hidden">
      {/* HUD Overlays */}
      <div className="absolute top-4 left-6 z-20 pointer-events-none">
        <div className="flex flex-col gap-1">
          <h2 className="text-emerald-400 font-mono text-sm tracking-[0.2em] font-bold uppercase">
            Live Fund Ingestion
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              TPS: {metrics.tps.toFixed(1)}
            </div>
            <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-mono text-blue-400">
                HUBS: {activeHubList.length}
            </div>
            <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded text-[10px] font-mono text-rose-400">
                ALERTS: {metrics.alertCount}
            </div>
          </div>
        </div>
      </div>

      {/* Live Suspicious Feed Panel */}
      <div className="absolute top-4 right-6 z-20 w-52 pointer-events-none">
        <div className="bg-slate-950/40 backdrop-blur-md border border-slate-800/50 p-3 rounded-xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-rose-400 font-mono text-[9px] font-black uppercase tracking-tighter">Live Threat Radar</h3>
                <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />
            </div>
            <div className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                    {feeds.length === 0 ? (
                        <p className="text-[8px] text-slate-500 font-mono italic">Waiting for signatures...</p>
                    ) : (
                        feeds.map(feed => (
                            <motion.div
                                key={feed.id}
                                initial={{ x: 20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -20, opacity: 0 }}
                                className="bg-rose-500/5 border-l-2 border-rose-500 p-1.5 rounded-r"
                            >
                                <div className="flex justify-between items-center mb-0.5">
                                    <span className="text-[7px] font-black text-rose-400 font-mono">{feed.pattern}</span>
                                    <span className="text-[7px] text-slate-500 font-mono">${(feed.amount/1000).toFixed(1)}k</span>
                                </div>
                                <div className="text-[8px] text-slate-200 font-mono truncate tracking-tight">{feed.address}</div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-6 z-20 pointer-events-none text-left">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest leading-relaxed">
            Network Analysis Engine v4.2<br/>
            Geospatial Crypto Ingestion Active
          </p>
      </div>

      <ComposableMap
        projectionConfig={{ scale: 190, center: [0, 10] }}
        width={800}
        height={450}
        className="w-full h-full"
      >
        <defs>
          <filter id="glow-emerald">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-red">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-orange">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-amber">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#f43f5e" />
          </marker>
        </defs>
        <ZoomableGroup zoom={1}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#020617"
                  stroke="#1e293b"
                  strokeWidth={0.5}
                  style={{
                    default: { 
                      outline: 'none', 
                      opacity: hoveredNodeId ? 0.3 : 1,
                      transition: 'all 0.4s ease'
                    },
                    hover: { fill: '#0f172a', outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {/* Persistent Hub Markers */}
          {activeHubList.map((hub) => (
            <Marker key={hub.id} coordinates={hub.coords}>
              <motion.circle
                initial={{ r: 0, opacity: 0 }}
                animate={{ r: 8, opacity: 0.3 }}
                className="fill-blue-500"
              />
              <circle r={3} fill="#6a1b9a" stroke="#fff" strokeWidth={1} />
              <g transform="translate(8, -8)">
                  <text className="font-mono text-[8px] font-bold fill-blue-400 uppercase tracking-widest">
                    HUB: {hub.id}
                  </text>
              </g>
            </Marker>
          ))}

          {/* Macro-flow: INTER-HUB CONNECTIVITY (Subtle) */}
          {activeHubList.length > 1 && activeHubList.map((h1, i) => 
            activeHubList.slice(i + 1).map((h2) => (
              <Line
                key={`${h1.id}-${h2.id}`}
                from={h1.coords}
                to={h2.coords}
                stroke="#60a5fa"
                strokeWidth={1}
                strokeDasharray="4 4"
                style={{ opacity: 0.3, pointerEvents: 'none' }}
              />
            ))
          )}

          {/* Micro-flow: HUB-TO-NODE TETHERING (Linking entities to their geographic hub) */}
          {Object.values(nodes).map((node) => {
            if (filter !== 'ALL' && node.pattern !== filter) return null;
            const hubCoords = COUNTRY_COORDS[node.country];
            if (!hubCoords) return null;
            return (
              <Line
                key={`tether-${node.id}`}
                from={hubCoords}
                to={node.coords}
                stroke="#475569"
                strokeWidth={1}
                style={{ opacity: 0.6, pointerEvents: 'none' }}
              />
            );
          })}

          {/* LIVE STREAM: HIGH-VELOCITY FUND ARCS (Animated Arcs for Every Transaction) */}
          {flows.map((flow) => {
             if (filter !== 'ALL' && flow.pattern !== filter) return null;
             return (
               <Line
                 key={flow.id}
                 from={flow.src}
                 to={flow.dst}
                 stroke={flow.isSuspicious ? "#f43f5e" : "#10b981"}
                 strokeWidth={flow.isSuspicious ? 1.5 : 0.8}
                 strokeLinecap="round"
                 markerEnd="url(#arrow)"
                 style={{ 
                   opacity: 0.4, 
                   strokeDasharray: '41, 41',
                   animation: 'flowLine 1.5s linear infinite'
                 }}
               />
             );
          })}

          {/* Network Graph: DIRECTED EDGES (Animated discovery to static state) */}
          {Object.values(edges).map((edge) => {
              const fromNode = nodes[edge.from];
              const toNode = nodes[edge.to];
              if (!fromNode || !toNode) return null;
              
              // Filter check
              if (filter !== 'ALL' && fromNode.pattern !== filter) return null;
              
              const isHighlighted = activeNetwork?.has(edge.from) && activeNetwork?.has(edge.to);
              const isDimmed = hoveredNodeId && !isHighlighted;

              // Calculate organic curved path
              const midX = (fromNode.coords[0] + toNode.coords[0]) / 2;
              const midY = (fromNode.coords[1] + toNode.coords[1]) / 2 - 5; // Slight arc
              const d = `M ${fromNode.coords[0]} ${fromNode.coords[1]} Q ${midX} ${midY} ${toNode.coords[0]} ${toNode.coords[1]}`;

              return (
                <g key={edge.id} style={{ transition: 'opacity 0.4s ease', opacity: isDimmed ? 0.1 : 1.0 }}>
                  <motion.path
                    d={d}
                    fill="none"
                    stroke={isHighlighted ? "#fbbf24" : "#f43f5e"}
                    strokeWidth={isHighlighted ? 2 : 1}
                    strokeDasharray={isHighlighted ? "none" : "2 4"}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 1, ease: "easeInOut" }}
                    style={{ filter: isHighlighted ? 'drop-shadow(0 0 6px #fbbf24)' : 'drop-shadow(0 0 2px #f43f5e)' }}
                  />
                  
                  {/* Flow 'Discharge' Animation (Traveling Comet) */}
                  <motion.path
                    d={d}
                    fill="none"
                    stroke={isHighlighted ? "#fff" : "#fbbf24"}
                    strokeWidth={isHighlighted ? 1.5 : 1}
                    strokeLinecap="round"
                    strokeDasharray="1, 40"
                    animate={{ 
                        strokeDashoffset: [80, 0],
                        opacity: [0, 1, 0],
                    }}
                    transition={{ 
                        duration: 1.2, 
                        repeat: Infinity, 
                        ease: "linear",
                        times: [0, 0.5, 1] 
                    }}
                    style={{ filter: isHighlighted ? 'url(#glow-amber)' : 'drop-shadow(0 0 3px #fbbf24)' }}
                  />
                </g>
              );
          })}

          {/* Network Graph: ENTITY NODES & THREAT LABELS */}
          {Object.values(nodes).map((node) => {
            if (filter !== 'ALL' && node.pattern !== filter) return null;
            
            const isHighlighted = activeNetwork?.has(node.id);
            const isDimmed = hoveredNodeId && !isHighlighted;
            const isCenter = hoveredNodeId === node.id;

            return (
              <Marker 
                key={node.id} 
                coordinates={node.coords}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
              >
                  <motion.g
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ 
                        opacity: isDimmed ? 0.2 : 1, 
                        scale: isCenter ? 1.2 : 1,
                      }}
                      transition={{ duration: 0.4 }}
                  >
                      {/* Glowing Node Body */}
                      <circle 
                        r={isHighlighted ? 12 : 8} 
                        fill={getRiskColor(node.riskScore)}
                        fillOpacity={0.2}
                        style={{ filter: node.pattern ? getRiskGlow(node.riskScore) : 'none' }} 
                      />
                      <circle 
                        r={isCenter ? 5 : 3} 
                        fill={getRiskColor(node.riskScore)}
                        stroke="#fff"
                        strokeOpacity={0.4}
                        strokeWidth={0.5} 
                      />
                      
                      {/* Detailed Sophisticated Tooltip */}
                      <AnimatePresence>
                        {isCenter && (
                          <motion.g 
                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 5, scale: 0.9 }}
                            transform="translate(14, -40)"
                          >
                              {/* Background HUD Glass */}
                              <rect 
                                  width={180} 
                                  height={100} 
                                  rx={12} 
                                  className="fill-slate-950/95 stroke-white/10 shadow-2xl" 
                                  style={{ backdropFilter: 'blur(16px)' }}
                              />
                              
                              {/* Top Accent Line */}
                              <rect width={180} height={2} rx={1} className="fill-rose-500 shadow-[0_0_8px_#f43f5e]" />

                              {/* Title Section */}
                              <text x={12} y={20} className="font-mono text-[10px] font-black fill-rose-400 uppercase tracking-widest">
                                 🚨 SIGNATURE: {node.pattern}
                              </text>
                              <text x={12} y={32} className="font-mono text-[7px] fill-slate-500 uppercase font-bold tracking-tighter">
                                 STATUS: INVESTIGATION IN PROGRESS
                              </text>

                              {/* Data Grid */}
                              <g transform="translate(12, 45)">
                                  <text y={0} className="font-mono text-[7px] fill-slate-500 font-bold uppercase">Address Range</text>
                                  <text y={10} className="font-mono text-[9px] fill-white font-medium">{node.address.slice(0, 22)}</text>
                                  
                                  <text y={28} className="font-mono text-[7px] fill-slate-500 font-bold uppercase">Geostatic Origin</text>
                                  <text y={38} className="font-mono text-[9px] fill-emerald-400 font-bold">{node.country} NODE • v4.2</text>
                                  
                                  <text x={100} y={28} className="font-mono text-[7px] fill-slate-500 font-bold uppercase">Risk Score</text>
                                  <text x={100} y={38} className="font-mono text-[9px] fill-rose-500 font-black">{node.riskScore.toFixed(1)}% {node.riskScore > 90 ? 'CRITICAL' : 'ELEVATED'}</text>
                              </g>

                              {/* Decorative HUD Scanning Line */}
                              <motion.rect 
                                width={178} 
                                height={1} 
                                x={1}
                                className="fill-blue-400/20"
                                animate={{ y: [0, 98, 0] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                              />
                          </motion.g>
                        )}
                      </AnimatePresence>
                  </motion.g>
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>
    </div>
  )
}
