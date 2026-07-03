import { useEffect, useRef, useState } from 'react'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let rafId = 0
    const onScroll = () => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        setScrolled(window.scrollY > 60)
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

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setShowDownloadMenu(true)
  }

  const handleMouseLeave = () => {
    timerRef.current = setTimeout(() => setShowDownloadMenu(false), 180)
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center transition-all duration-500"
      style={{
        background: scrolled ? 'rgba(3, 8, 22, 0.65)' : 'transparent',
        backdropFilter: scrolled ? 'saturate(180%) blur(24px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'saturate(180%) blur(24px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
      }}
    >
      {/* Inner container with fixed proportional padding */}
      <div
        className="w-full flex items-center justify-between"
        style={{ padding: '0 clamp(16px, 4vw, 48px)' }}
      >
        {/* Brand Logo - flash effect */}
        <button
          onClick={() => scrollTo('hero')}
          className="logo-flash-container flex items-center gap-3 cursor-pointer relative"
        >
          {/* Flash overlay */}
          <span className="logo-flash-overlay" />

          <div
            className="logo-icon-inner rounded-xl flex items-center justify-center"
            style={{
              width: '48px',
              height: '48px',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
              backdropFilter: 'saturate(200%) blur(12px)',
              WebkitBackdropFilter: 'saturate(200%) blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: 'inset 0 0.5px 1px rgba(255,255,255,0.12), 0 4px 16px rgba(0,0,0,0.2)',
            }}
          >
            <img src="/lynx-logo-black.png" alt="" style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
          </div>
          <span
            className="text-xl font-semibold tracking-tight hidden sm:block"
            style={{ color: '#F0F4F8', letterSpacing: '-0.01em' }}
          >
            Lynx
          </span>
        </button>

        {/* Center nav */}
        <div className="hidden md:flex items-center gap-8">
          {[
            { label: '核心能力', id: 'capabilities' },
            { label: '超级助理', id: 'assistant' },
            { label: '三端互通', id: 'crossplatform' },
            { label: '团队版', id: 'team' },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => scrollTo(item.id)}
              className="font-medium transition-all duration-200 cursor-pointer"
              style={{ fontSize: '16px', color: 'rgba(240, 244, 248, 0.65)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#F0F4F8'
                e.currentTarget.style.transform = 'scale(1.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(240, 244, 248, 0.65)'
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {/* Download — hover dropdown */}
          <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            <button className="btn-primary text-[13px] py-2.5 px-5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              下载
            </button>

            <div
              className="absolute right-0 top-full z-50"
              style={{
                width: '224px',
                paddingTop: '10px',
                opacity: showDownloadMenu ? 1 : 0,
                visibility: showDownloadMenu ? 'visible' : 'hidden',
                pointerEvents: showDownloadMenu ? 'auto' : 'none',
                transform: showDownloadMenu ? 'translateY(0)' : 'translateY(-4px)',
                transition: 'opacity 0.2s ease, transform 0.2s ease, visibility 0.2s',
              }}
            >
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: 'rgba(8, 15, 40, 0.95)',
                  backdropFilter: 'saturate(180%) blur(24px)',
                  WebkitBackdropFilter: 'saturate(180%) blur(24px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
                }}
              >
                {[
                  { label: 'Web 版', desc: '浏览器直接使用', href: 'https://ai.lynxdo.com/' },
                  { label: 'Windows 桌面版', desc: '下载安装包', href: 'https://gitee.com/shenzhens-emotions-are-booming_0/lynn-hub-release/releases/download/v1.0.2/Lynx_1.0.2_x64-setup.exe' },
                  { label: '安卓 APP', desc: '下载 APK', href: 'https://gitee.com/shenzhens-emotions-are-booming_0/lynn-hub-release/releases/download/v1.0.2/Lynx-android.apk' },
                ].map((opt) => (
                  <a
                    key={opt.label}
                    href={opt.href}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors"
                    style={{ color: '#F0F4F8' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <div>
                      <div className="text-[13px] font-medium">{opt.label}</div>
                      <div className="text-[11px]" style={{ color: 'rgba(240, 244, 248, 0.4)' }}>{opt.desc}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Login */}
          <a href="https://ai.lynxdo.com/" className="ios-pill hidden sm:inline-flex">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            登录 / 注册
          </a>
        </div>
      </div>
    </nav>
  )
}
