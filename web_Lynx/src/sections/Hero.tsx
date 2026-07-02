import { useEffect, useRef, useState } from 'react'
import PerspectiveGridWarp from './PerspectiveGridWarp'
import VideoModal from './VideoModal'

export default function Hero() {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)

  useEffect(() => {
    const tl = titleRef.current, st = subtitleRef.current, ct = ctaRef.current
    if (!tl || !st || !ct) return
    tl.style.opacity = '0'; tl.style.transform = 'translateY(30px)'
    st.style.opacity = '0'; st.style.transform = 'translateY(30px)'
    ct.style.opacity = '0'; ct.style.transform = 'translateY(30px)'

    const t1 = setTimeout(() => {
      tl.style.transition = 'opacity 1s cubic-bezier(0.22, 1, 0.36, 1), transform 1s cubic-bezier(0.22, 1, 0.36, 1)'
      tl.style.opacity = '1'; tl.style.transform = 'translateY(0)'
    }, 300)
    const t2 = setTimeout(() => {
      st.style.transition = 'opacity 1s ease 0.15s, transform 1s ease 0.15s'
      st.style.opacity = '1'; st.style.transform = 'translateY(0)'
    }, 500)
    const t3 = setTimeout(() => {
      ct.style.transition = 'opacity 1s ease 0.3s, transform 1s ease 0.3s'
      ct.style.opacity = '1'; ct.style.transform = 'translateY(0)'
    }, 700)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  return (
    <>
      <section id="hero" className="relative w-full" style={{ height: '100vh', minHeight: '600px' }}>
        <PerspectiveGridWarp />

        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-4 md:px-6" style={{ pointerEvents: 'none' }}>
          <h1
            ref={titleRef}
            className="text-center font-semibold tracking-tight"
            style={{
              fontSize: 'clamp(28px, 5vw, 64px)',
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              color: '#F0F4F8',
              textShadow: '0 2px 40px rgba(0,0,0,0.6)',
              textWrap: 'balance',
            }}
          >
            Lynx AI 超级助理
          </h1>

          <p
            ref={subtitleRef}
            className="text-center mt-4 md:mt-6 max-w-[560px]"
            style={{
              fontSize: 'clamp(14px, 1.6vw, 18px)',
              lineHeight: 1.75,
              color: 'rgba(240, 244, 248, 0.55)',
              textShadow: '0 1px 10px rgba(0,0,0,0.4)',
              textWrap: 'pretty',
              padding: '0 16px',
            }}
          >
            不用学，直接干。一个会自主学习、成长、进化的超级助理，住在你的 Web、Windows 桌面与 Android 三端工作台里。
          </p>

          <div ref={ctaRef} className="mt-8 md:mt-10 flex flex-col sm:flex-row items-center gap-3 md:gap-4" style={{ pointerEvents: 'auto' }}>
            {/* Download with hover dropdown + bridge gap */}
            <div
              className="relative"
              onMouseEnter={() => setShowMenu(true)}
              onMouseLeave={() => setShowMenu(false)}
            >
              <button className="btn-primary" style={{ fontSize: '15px', padding: '12px 28px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                免费下载
              </button>

              {/* Dropdown with bridge padding-top */}
              <div
                className="absolute left-1/2 -translate-x-1/2 top-full z-50"
                style={{
                  width: '220px',
                  paddingTop: '10px',
                  opacity: showMenu ? 1 : 0,
                  visibility: showMenu ? 'visible' : 'hidden',
                  pointerEvents: showMenu ? 'auto' : 'none',
                  transform: showMenu ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(-6px)',
                  transition: 'opacity 0.2s ease, transform 0.2s ease, visibility 0.2s',
                }}
              >
                <div
                  style={{
                    background: 'rgba(8, 15, 40, 0.95)',
                    backdropFilter: 'saturate(180%) blur(24px)',
                    WebkitBackdropFilter: 'saturate(180%) blur(24px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.08)',
                  }}
                >
                  {[
                    { label: 'Web 版', desc: '浏览器直接使用', href: 'https://ai.lynxdo.com/' },
                    { label: 'Windows 桌面版', desc: '下载安装包', href: 'https://www.lynxdo.com/download/Lynx-windows-setup.exe' },
                    { label: '安卓 APP', desc: '下载 APK', href: 'https://www.lynxdo.com/download/Lynx-android.apk' },
                  ].map((p) => (
                    <a
                      key={p.label}
                      href={p.href}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors"
                      style={{ color: '#F0F4F8' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <div>
                        <div className="text-[13px] font-medium">{p.label}</div>
                        <div className="text-[11px]" style={{ color: 'rgba(240, 244, 248, 0.4)' }}>{p.desc}</div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Watch demo - opens video modal */}
            <button
              className="btn-glass"
              style={{ fontSize: '15px', padding: '12px 28px' }}
              onClick={() => setVideoOpen(true)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              观看演示
            </button>
          </div>
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 z-10"
          style={{
            height: 'clamp(120px, 20vw, 200px)',
            background: 'linear-gradient(to bottom, transparent, #030816)',
            pointerEvents: 'none',
          }}
        />
      </section>

      <VideoModal isOpen={videoOpen} onClose={() => setVideoOpen(false)} />
    </>
  )
}
