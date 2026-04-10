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
  timestamp: number
}

interface HubNode {
  id: string
  coords: [number, number]
  count: number
  lastUpdated: number
}

export default function LiveGlobe() {
  const [flows, setFlows] = useState<FlowArc[]>([])
  const [hubs, setHubs] = useState<Record<string, HubNode>>({})
  const [metrics, setMetrics] = useState({ tps: 0, activeHubs: 0, alertCount: 0 })
  const socketRef = useRef<any>(null)

  useEffect(() => {
    // Connect to backend socket
    socketRef.current = io('http://localhost:5000', {
        transports: ['websocket'],
        auth: { role: 'ADMIN' }
    });

    socketRef.current.on('connect', () => {
        console.log('Connected to Live Fund Flow socket');
    });

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
            timestamp: Date.now()
        };

        setFlows(prev => [...prev.slice(-15), newFlow]);

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

        if (tx.pattern_tag) {
            setMetrics(p => ({ ...p, alertCount: p.alertCount + 1 }));
        }
    });

    socketRef.current.on('metrics:update', (data: any) => {
        setMetrics(p => ({ ...p, tps: data.tps }));
    });

    // Cleanup interval for old arcs and decaying hubs
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
    }, 2000);

    return () => {
        socketRef.current?.disconnect();
        clearInterval(cleanup);
    };
  }, []);

  const activeHubList = useMemo(() => {
    return Object.values(hubs).filter(h => h.count > 5);
  }, [hubs]);

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

      <div className="absolute bottom-4 right-6 z-20 pointer-events-none text-right">
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
        </defs>
        <ZoomableGroup zoom={1}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#0f172a"
                  stroke="#1e293b"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover: { fill: '#1e293b', outline: 'none' },
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
              <circle r={3} fill="#60a5fa" stroke="#fff" strokeWidth={1} />
              <g transform="translate(8, -8)">
                  <text className="font-mono text-[8px] font-bold fill-blue-400 uppercase tracking-widest">
                    HUB: {hub.id}
                  </text>
              </g>
            </Marker>
          ))}

          {/* Animated Transaction Arcs */}
          {flows.map((flow) => (
            <g key={flow.id}>
              <Line
                from={flow.src}
                to={flow.dst}
                stroke={flow.isSuspicious ? '#fb7185' : '#10b981'}
                strokeWidth={1}
                strokeLinecap="round"
                style={{ opacity: 0.2 }}
              />
              <motion.path
                d={`M ${flow.src[0]} ${flow.src[1]} Q ${(flow.src[0] + flow.dst[0]) / 2} ${(flow.src[1] + flow.dst[1]) / 2 - 20} ${flow.dst[0]} ${flow.dst[1]}`}
                fill="none"
                stroke={flow.isSuspicious ? '#f43f5e' : '#10b981'}
                strokeWidth={2}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: [0, 1, 0] }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
                style={{ filter: flow.isSuspicious ? 'drop-shadow(0 0 4px #f43f5e)' : 'none' }}
              />
              {flow.isSuspicious && (
                <Marker coordinates={flow.src}>
                    <motion.circle
                        initial={{ r: 0 }}
                        animate={{ r: 12 }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="fill-rose-500/20"
                    />
                    <text transform="translate(10, 5)" className="font-mono text-[6px] fill-rose-500 font-bold uppercase">
                        RISK DETECTED
                    </text>
                </Marker>
              )}
            </g>
          ))}
        </ZoomableGroup>
      </ComposableMap>
    </div>
  )
}
