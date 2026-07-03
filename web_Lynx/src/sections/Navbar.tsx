import { useEffect, useState } from 'react'

// 平台检测：PC → 下载桌面客户端，移动 → 下载安卓 APK
function detectPlatform(): 'desktop' | 'mobile' {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent.toLowerCase()
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua) ? 'mobile' : 'desktop'
}

const DESKTOP_DOWNLOAD_URL = 'https://www.lynxdo.com/download/Lynx-windows-setup.exe'
const MOBILE_DOWNLOAD_URL = 'https://www.lynxdo.com/download/Lynx-android.apk'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [platform, setPlatform] = useState<'desktop' | 'mobile'>('desktop')

  useEffect(() => {
    setPlatform(detectPlatform())
    let rafId = 0
    const onScroll = () => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        setScrolled(window.scrollY > 40)
        rafId = 0
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const downloadUrl = platform === 'mobile' ? MOBILE_DOWNLOAD_URL : DESKTOP_DOWNLOAD_URL
  const downloadLabel = platform === 'mobile' ? '下载 APK' : '下载桌面端'

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center" style={{ padding: '12px clamp(16px, 4vw, 48px)' }}>
      <nav
        className="w-full flex items-center justify-between transition-all duration-500"
        style={{
          maxWidth: '1200px',
          height: '56px',
          padding: '0 20px',
          borderRadius: '18px',
          // 豆包风格液态玻璃：悬浮、圆角、半透明、高斯模糊
          background: scrolled
            ? 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)'
            : 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
          backdropFilter: 'saturate(200%) blur(24px)',
          WebkitBackdropFilter: 'saturate(200%) blur(24px)',
          border: scrolled ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.06)',
          boxShadow: scrolled
            ? 'inset 0 1px 1px rgba(255,255,255,0.15), 0 8px 32px rgba(0,0,0,0.3)'
            : 'inset 0 0.5px 1px rgba(255,255,255,0.08), 0 2px 12px rgba(0,0,0,0.15)',
        }}
      >
        {/* Brand Logo */}
        <button
          onClick={() => scrollTo('hero')}
          className="flex items-center gap-2.5 cursor-pointer relative group"
        >
          <div
            className="rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
            style={{
              width: '36px',
              height: '36px',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <img src="/lynx-logo-black.png" alt="Lynx" style={{ width: '24px', height: '24px', borderRadius: '6px' }} />
          </div>
          <span
            className="text-lg font-semibold tracking-tight hidden sm:block"
            style={{ color: '#F0F4F8', letterSpacing: '-0.01em' }}
          >
            Lynx奇思
          </span>
        </button>

        {/* Center nav：5 个导航对应 5 大功能卡片 id */}
        <div className="hidden md:flex items-center gap-7">
          {[
            { label: '本地操控', id: 'agent' },
            { label: '记忆图谱', id: 'memory' },
            { label: '灵感看板', id: 'kanban' },
            { label: 'AI 对话', id: 'ai-chat' },
            { label: '三端互通', id: 'cross-platform' },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => scrollTo(item.id)}
              className="font-medium transition-all duration-200 cursor-pointer"
              style={{ fontSize: '14px', color: 'rgba(240, 244, 248, 0.6)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#F0F4F8'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(240, 244, 248, 0.6)'
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Right: 只保留一个下载按钮（PC→桌面客户端，移动→安卓APK） */}
        <a
          href={downloadUrl}
          className="btn-primary"
          style={{ fontSize: '13px', padding: '8px 18px' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          {downloadLabel}
        </a>
      </nav>
    </div>
  )
}
