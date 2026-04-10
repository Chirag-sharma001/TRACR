'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

const API_BASE = 'http://localhost:5000'
const TOKEN_KEY = 'tracr_auth_token'
const USER_KEY = 'tracr_auth_user'

export default function HomePage() {
  const [fraudActive, setFraudActive] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [GlobeComponent, setGlobeComponent] = useState<any>(null)

  // Auth form states
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authError, setAuthError] = useState('')
  const [isGuestLoading, setIsGuestLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Dynamic import to avoid SSR issues with Three.js
    import('../components/Globe3D').then(mod => {
      setGlobeComponent(() => mod.default)
    })
  }, [])

  const doLogin = async (u: string, p: string) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Invalid credentials')
    }
    return res.json()
  }

  const handleLogin = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setAuthError('Please enter your credentials.')
      return
    }
    setAuthError('')
    setIsAuthenticating(true)
    try {
      // Bypassed JWT token authentication
      localStorage.setItem(TOKEN_KEY, "mock-token")
      localStorage.setItem(USER_KEY, JSON.stringify({ user_id: "admin", role: "ADMIN" }))
      window.location.href = '/app.html'
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed.')
      setIsAuthenticating(false)
    }
  }

  const handleGuestAccess = async (e: React.MouseEvent) => {
    e.preventDefault()
    setAuthError('')
    setIsGuestLoading(true)
    try {
      // Bypassed guest access backend call
      localStorage.setItem(TOKEN_KEY, "mock-token")
      localStorage.setItem(USER_KEY, JSON.stringify({ user_id: "analyst", role: "ANALYST" }))
      window.location.href = '/app.html'
    } catch (err: any) {
      setAuthError('Guest access unavailable. Please use your credentials.')
      setIsGuestLoading(false)
    }
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#050505]">

      {/* Anti-gravity meshes */}
      <div className="absolute inset-0 mesh-bg opacity-70 pointer-events-none" />
      <div className="absolute inset-0 grid-overlay opacity-30 pointer-events-none" />

      {/* Global Context (Full Screen) */}
      <div className="absolute inset-0 z-0 opacity-100 mix-blend-screen">
        {GlobeComponent ? (
          <GlobeComponent onFraudDetected={setFraudActive} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="globe-loader"></div>
          </div>
        )}
      </div>

      {/* Vignette */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 50%, transparent 15%, rgba(5,5,5,0.6) 60%, rgba(5,5,5,0.95) 100%)',
        }}
      />

      {/* Status Badge (Bottom Left) */}
      <motion.div
        initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ delay: 0.4, duration: 0.8 }}
        className="absolute bottom-8 left-8 sm:bottom-12 sm:left-12 z-20 glass flex items-center gap-3 px-5 py-2.5 rounded-full pointer-events-none border border-white/[0.05] bg-white/[0.02] backdrop-blur-3xl"
      >
        <span
          className={`w-2.5 h-2.5 rounded-full ${fraudActive ? 'animate-blink' : ''}`}
          style={{
            background: fraudActive ? 'var(--accent-alert)' : 'var(--accent-safe)',
            boxShadow: fraudActive ? 'var(--glow-alert)' : '0 0 12px rgba(52, 211, 153, 0.4)',
          }}
        />
        <span className="text-[10px] font-mono tracking-[0.15em] uppercase font-bold text-gray-300">
          {fraudActive ? 'Threat Detected' : 'Global Network Sync'}
        </span>
      </motion.div>

      {/* ── Centralized HUD Overlay ── */}
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none">

        {/* Brand */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 1.2 }}
          className="flex flex-col items-center text-center mb-8 pointer-events-none select-none"
        >
          <h1
            className="font-semibold leading-none tracking-tight mb-2"
            style={{
              fontSize: 'clamp(3rem, 6vw, 4.5rem)',
              fontFamily: 'Metropolis, sans-serif',
              lineHeight: '1.25',
              background: 'linear-gradient(180deg, #FFFFFF 0%, #A1A1AA 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.04em',
            }}
          >
            SATYA FLOW
          </h1>
          <p className="text-gray-400 text-[10px] md:text-xs font-medium tracking-[0.2em] uppercase">
            Intelligent AML Defense Network
          </p>
        </motion.div>

        {/* Auth Box */}
        <motion.div
           initial={{ opacity: 0, scale: 0.95, y: 20 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           transition={{ delay: 0.2, duration: 1, ease: [0.16, 1, 0.3, 1] }}
           className="relative w-[90%] max-w-[400px] p-8 sm:p-10 rounded-[28px] border border-white/[0.08] backdrop-blur-[40px] bg-white/[0.02] shadow-[0_24px_80px_rgba(0,0,0,0.7)] pointer-events-auto"
        >
          <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-tr from-transparent via-white/[0.02] to-transparent pointer-events-none rounded-[28px] z-0" />

          {/* Auth Form */}
          <div className="relative space-y-5 z-10 mt-2">
            <div className="space-y-1.5 flex flex-col">
              <label className="text-[11px] font-semibold tracking-wider text-gray-300 uppercase drop-shadow-sm">Analyst ID</label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setAuthError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin(e as any)}
                suppressHydrationWarning
                placeholder="username"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3.5 text-[15px] text-white focus:outline-none focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-400/50 transition-all font-mono placeholder:text-gray-500 shadow-inner"
              />
            </div>

            <div className="space-y-1.5 flex flex-col">
              <label className="text-[11px] font-semibold tracking-wider text-gray-300 uppercase drop-shadow-sm">Clearance Key</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setAuthError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin(e as any)}
                suppressHydrationWarning
                placeholder="••••••••••••"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3.5 text-[15px] text-white focus:outline-none focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-400/50 transition-all font-mono tracking-widest shadow-inner"
              />
            </div>

            {/* Error message */}
            {authError && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[12px] text-rose-400 font-medium px-1"
              >
                ⚠ {authError}
              </motion.p>
            )}



            <div className="pt-3 flex flex-col gap-3">
              <button
                id="btn-sign-in"
                onClick={handleLogin}
                disabled={isAuthenticating}
                className="w-full relative overflow-hidden rounded-xl px-4 py-3.5 flex items-center justify-center gap-2 group transition-all duration-300 bg-white text-black font-semibold text-[15px] hover:shadow-[0_0_24px_rgba(255,255,255,0.2)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isAuthenticating ? (
                  <span className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:translate-x-1 duration-300"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                  </>
                )}
              </button>

              <button
                id="btn-guest-access"
                onClick={handleGuestAccess}
                disabled={isGuestLoading}
                suppressHydrationWarning
                className="w-full rounded-xl px-4 py-3.5 border border-white/5 bg-transparent text-gray-300 font-medium text-[14px] hover:bg-white/[0.06] hover:text-white transition-all duration-300 active:scale-[0.98] disabled:opacity-50"
              >
                {isGuestLoading ? (
                  <span className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin inline-block" />
                ) : 'Request Guest Access'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>

    </div>
  )
}
