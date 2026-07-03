import { useEffect, useRef } from 'react'

interface VideoModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function VideoModal({ isOpen, onClose }: VideoModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      videoRef.current?.play()
    } else {
      document.body.style.overflow = ''
      videoRef.current?.pause()
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        background: 'rgba(3, 8, 22, 0.85)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        animation: 'fadeIn 0.3s ease',
      }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.92) } to { opacity: 1; transform: scale(1) } }
      `}</style>

      <div
        className="relative w-full mx-4"
        style={{
          maxWidth: '960px',
          animation: 'scaleIn 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 w-9 h-9 flex items-center justify-center rounded-full transition-all"
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(240,244,248,0.7)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.15)'
            e.currentTarget.style.color = '#F0F4F8'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
            e.currentTarget.style.color = 'rgba(240,244,248,0.7)'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Video container with liquid glass */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            backdropFilter: 'saturate(180%) blur(32px)',
            WebkitBackdropFilter: 'saturate(180%) blur(32px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.15), 0 32px 80px rgba(0,0,0,0.5)',
          }}
        >
          <video
            ref={videoRef}
            className="w-full"
            style={{ aspectRatio: '16/9', display: 'block' }}
            controls
            playsInline
            loop
          >
            <source src="/demo-video.mp4" type="video/mp4" />
          </video>
        </div>

        <p className="text-center mt-4 text-[14px]" style={{ color: 'rgba(240, 244, 248, 0.4)' }}>
          奇思AI工作台产品演示 — 按 ESC 或点击外部关闭
        </p>
      </div>
    </div>
  )
}
