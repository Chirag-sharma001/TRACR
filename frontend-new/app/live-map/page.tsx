'use client'
import LiveGlobe from '@/components/LiveGlobe'

export default function LiveMapPage() {
  return (
    <div className="w-full h-screen bg-[#020617] m-0 p-0 overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.05)_0%,transparent_70%)] pointer-events-none" />
      <LiveGlobe />
      
      {/* Decorative border to match glassmorphism in main dashboard */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
    </div>
  )
}
