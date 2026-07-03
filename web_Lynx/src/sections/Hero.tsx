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
            奇思 - AI工作台
          </h1>

          <p
            ref={subtitleRef}
            className="text-center mt-4 md:mt-6 max-w-[680px]"
            style={{
              fontSize: 'clamp(14px, 1.6vw, 18px)',
              lineHeight: 1.75,
              color: 'rgba(240, 244, 248, 0.55)',
              textShadow: '0 1px 10px rgba(0,0,0,0.4)',
              textWrap: 'pretty',
              padding: '0 16px',
            }}
          >
            不用学AI，什么都能干。一个入口，覆盖全职业所有AI能力。零门槛，开箱即用。
          </p>

          <div ref={ctaRef} className="mt-8 md:mt-10 flex flex-col sm:flex-row items-center gap-3 md:gap-4" style={{ pointerEvents: 'auto' }}>
            {/* "开始使用" with hover dropdown: 第一个下载桌面应用（高亮），第二个使用网页版 */}
            <div
              className="relative"
              onMouseEnter={() => setShowMenu(true)}
              onMouseLeave={() => setShowMenu(false)}
            >
              <button className="btn-primary" style={{ fontSize: '15px', padding: '12px 28px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                开始使用
              </button>

              {/* Dropdown with bridge padding-top */}
              <div
                className="absolute left-1/2 -translate-x-1/2 top-full z-50"
                style={{
                  width: '240px',
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
                  {/* 第一个：下载桌面应用（高亮显示） */}
                  <a
                    href="https://www.lynxdo.com/download/Lynx-windows-setup.exe"
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors"
                    style={{
                      color: '#F0F4F8',
                      background: 'linear-gradient(135deg, rgba(15, 98, 254, 0.15) 0%, rgba(15, 98, 254, 0.05) 100%)',
                      borderLeft: '3px solid #0F62FE',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(15, 98, 254, 0.25) 0%, rgba(15, 98, 254, 0.1) 100%)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(15, 98, 254, 0.15) 0%, rgba(15, 98, 254, 0.05) 100%)' }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4d8aff" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                    <div>
                      <div className="text-[13px] font-semibold" style={{ color: '#4d8aff' }}>下载桌面应用</div>
                      <div className="text-[11px]" style={{ color: 'rgba(240, 244, 248, 0.5)' }}>Windows 安装包 · 推荐</div>
                    </div>
                  </a>
                  {/* 第二个：使用网页版 */}
                  <a
                    href="https://ai.lynxdo.com/"
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors"
                    style={{ color: '#F0F4F8' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(240, 244, 248, 0.6)" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    <div>
                      <div className="text-[13px] font-medium">使用网页版</div>
                      <div className="text-[11px]" style={{ color: 'rgba(240, 244, 248, 0.4)' }}>浏览器直接使用</div>
                    </div>
                  </a>
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
