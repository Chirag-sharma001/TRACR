'use client'

import React, { useEffect, useState, useRef } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'

const SOCKET_URL = 'http://localhost:5000'
const MAX_POINTS = 30

function makePoint(volume = 0, alerts = 0) {
  return {
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    volume,
    alerts,
  }
}

export default function ActivityChart() {
  const [data, setData] = useState<any[]>([])
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<any>(null)
  const pendingRef = useRef({ volume: 0, alerts: 0 })

  useEffect(() => {
    // Seed initial history with zeros (not fake data)
    const seed = []
    const now = Date.now()
    for (let i = MAX_POINTS - 1; i >= 0; i--) {
      seed.push({
        time: new Date(now - i * 3000).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        volume: 0,
        alerts: 0,
      })
    }
    setData(seed)

    // Dynamically load socket.io-client from the backend CDN to avoid bundling issues
    const script = document.createElement('script')
    script.src = `${SOCKET_URL}/socket.io/socket.io.js`
    script.async = true
    script.onload = () => {
      const io = (window as any).io
      if (!io) return

      const socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
      })

      socketRef.current = socket

      socket.on('connect', () => setConnected(true))
      socket.on('disconnect', () => setConnected(false))

      // Every incoming transaction adds to the pending volume accumulator
      socket.on('transaction:saved', (tx: any) => {
        pendingRef.current.volume += (tx.amount_usd || 0) / 1000 // scale to $K
      })

      // Every new alert increments the alert counter
      socket.on('alert:new', () => {
        pendingRef.current.alerts += 1
      })

      // Also listen to metrics push from the engine
      socket.on('metrics:update', (data: any) => {
        if (data.alertCounts) {
          const total = (data.alertCounts.LOW || 0) + (data.alertCounts.MEDIUM || 0) + (data.alertCounts.HIGH || 0)
          pendingRef.current.alerts = Math.max(pendingRef.current.alerts, 0)
        }
      })
    }
    document.head.appendChild(script)

    // Flush accumulated data every 3 seconds into the chart
    const flushInterval = setInterval(() => {
      const vol = Math.round(pendingRef.current.volume)
      const alerts = pendingRef.current.alerts

      // Reset pending accumulators
      pendingRef.current = { volume: 0, alerts: 0 }

      setData(prev => {
        const next = [...prev.slice(-(MAX_POINTS - 1)), makePoint(vol, alerts)]
        return next
      })
    }, 3000)

    return () => {
      clearInterval(flushInterval)
      socketRef.current?.disconnect()
      document.head.removeChild(script)
    }
  }, [])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{
        background: '#fff',
        border: 'none',
        borderRadius: 10,
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        padding: '10px 14px',
        fontSize: 12,
      }}>
        <p style={{ color: '#64748b', marginBottom: 4, fontWeight: 600 }}>{label}</p>
        <p style={{ color: '#10b981', margin: 0 }}>💰 Volume: <b>${payload[0]?.value || 0}K</b></p>
        <p style={{ color: '#ef4444', margin: 0 }}>🚨 Anomalies: <b>{payload[1]?.value || 0}</b></p>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100vh', background: 'transparent', overflow: 'hidden', position: 'relative' }}>
      {/* Connection indicator */}
      <div style={{
        position: 'absolute', top: 8, right: 12, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 5, fontSize: 10,
        color: connected ? '#10b981' : '#64748b',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: connected ? '#10b981' : '#94a3b8',
          display: 'inline-block',
          boxShadow: connected ? '0 0 6px #10b981' : 'none',
        }} />
        {connected ? 'LIVE' : 'CONNECTING…'}
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 18, right: 16, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="gVolume" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gAlerts" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

          <XAxis
            dataKey="time"
            tick={{ fontSize: 9, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 9, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `$${v}K`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 9, fill: '#ef4444' }}
            tickLine={false}
            axisLine={false}
            width={28}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
          />

          <Area
            yAxisId="left"
            type="monotone"
            dataKey="volume"
            name="Volume ($K)"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#gVolume)"
            isAnimationActive={false}
            dot={false}
          />
          <Area
            yAxisId="right"
            type="step"
            dataKey="alerts"
            name="Anomalies"
            stroke="#ef4444"
            strokeWidth={2}
            fill="url(#gAlerts)"
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      <style>{`
        body {
          background: transparent !important;
          margin: 0;
          padding: 0;
          overflow: hidden;
        }
      `}</style>
    </div>
  )
}
