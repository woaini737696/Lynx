import { useEffect, useRef, useState } from 'react'
import ConvergenceRays from './ConvergenceRays'

export default function Footer() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold: 0.05 }
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      id="footer"
      ref={sectionRef}
      className="relative w-full overflow-hidden"
      style={{ minHeight: 'clamp(500px, 80vh, 700px)', background: '#030816' }}
    >
      {/* Transition gradient — rays fade in from above */}
      <div
        className="absolute top-0 left-0 right-0 z-10 pointer-events-none"
        style={{
          height: '200px',
          background: 'linear-gradient(to bottom, #030816, transparent)',
        }}
      />

      <ConvergenceRays />

      <div
        className="relative z-10 flex flex-col items-center justify-center px-4 md:px-6"
        style={{ minHeight: 'clamp(500px, 80vh, 700px)', paddingTop: 'clamp(60px, 10vw, 120px)', paddingBottom: 'clamp(60px, 10vw, 120px)' }}
      >
        <div
          className="text-center"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(30px)',
            transition: 'opacity 1.2s cubic-bezier(0.22, 1, 0.36, 1) 0.3s, transform 1.2s cubic-bezier(0.22, 1, 0.36, 1) 0.3s',
          }}
        >
          <h2
            className="font-semibold tracking-tight mb-4"
            style={{
              fontSize: 'clamp(28px, 4.5vw, 56px)',
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              color: '#F0F4F8',
              textShadow: '0 2px 30px rgba(0,0,0,0.4)',
              textWrap: 'balance',
            }}
          >准备好开启了吗？</h2>

          <p
            className="mb-8 md:mb-10 max-w-[420px] mx-auto"
            style={{ fontSize: '16px', lineHeight: 1.7, color: 'rgba(240, 244, 248, 0.45)' }}
          >
            选择适合你的平台，体验会自主学习、成长、进化的 AI 工作台
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4 mb-8 md:mb-10">
            {[
              { label: 'Web 版', desc: '浏览器直接使用', icon: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' },
              { label: 'Windows', desc: '桌面客户端', icon: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z' },
              { label: '安卓 APP', desc: '移动端应用', icon: 'M5 2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z M12 18h.01' },
            ].map((p) => (
              <button
                key={p.label}
                className="ios-glass group flex flex-col items-center gap-3 px-6 py-5 md:px-8 md:py-6 w-full sm:w-40 md:w-44"
                style={{ padding: '24px 16px' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(240,244,248,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={p.icon} />
                </svg>
                <div>
                  <div className="text-[14px] font-medium" style={{ color: '#F0F4F8' }}>{p.label}</div>
                  <div className="text-[12px]" style={{ color: 'rgba(240, 244, 248, 0.35)' }}>{p.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer bottom */}
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '20px 0' }}
        >
          <div className="max-w-[1280px] mx-auto px-4 md:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <img src="/lynx-logo-black.png" alt="Lynx" className="w-5 h-5" style={{ opacity: 0.5, borderRadius: '4px' }} />
              <span style={{ color: 'rgba(240, 244, 248, 0.25)', fontSize: '13px' }}>
                Lynx · Lynx AI工作台，不用学，直接干
              </span>
            </div>
            <div className="flex items-center gap-6">
              {['服务条款', '隐私政策', '联系我们'].map((item) => (
                <a
                  key={item}
                  href="#"
                  className="transition-colors"
                  style={{ color: 'rgba(240, 244, 248, 0.25)', fontSize: '13px' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(240,244,248,0.6)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(240,244,248,0.25)')}
                >
                  {item}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
