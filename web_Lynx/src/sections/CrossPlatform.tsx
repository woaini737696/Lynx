import { useEffect, useRef, useState } from 'react'

const platforms = [
  {
    title: 'Web 工作台',
    desc: 'Next.js 14 全功能控制台，PWA 可装主屏，端口 5176 即开即用。',
  },
  {
    title: 'Windows 桌面端',
    desc: 'Tauri 2.x + Rust，内置 Hermes Agent、RPA、自动更新、系统托盘、紧急停止。',
  },
  {
    title: 'Android APP',
    desc: 'uni-app 五 Tab 原生体验：聚焦 / 看板 / 助理 / 任务 / 我的。',
  },
]

export default function CrossPlatform() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold: 0.15 }
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      id="crossplatform"
      ref={sectionRef}
      className="relative w-full"
      style={{
        background: '#030816',
        paddingTop: 'clamp(80px, 12vw, 160px)',
        paddingBottom: 'clamp(80px, 12vw, 160px)',
      }}
    >
      <div className="max-w-[1280px] mx-auto px-4 md:px-6">
        <div className="text-center mb-12 md:mb-16">
          <h2
            className="font-semibold tracking-tight"
            style={{
              fontSize: 'clamp(24px, 4vw, 48px)',
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              color: '#F0F4F8',
            }}
          >
            三端互通，互相操控
          </h2>
          <p
            className="mt-4 max-w-[520px] mx-auto"
            style={{ fontSize: '16px', lineHeight: 1.75, color: 'rgba(240, 244, 248, 0.45)' }}
          >
            同一套数据、同一个助理、三种入口。手机一句话，PC 上的 Hermes 帮你把活干了。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {platforms.map((p, i) => (
            <div
              key={p.title}
              className="ios-glass text-center"
              style={{
                padding: 'clamp(28px, 3vw, 40px)',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(40px)',
                transition: `opacity 0.6s ease ${i * 0.12}s, transform 0.6s ease ${i * 0.12}s`,
              }}
            >
              <h3 className="font-semibold mb-2" style={{ fontSize: '17px', color: '#F0F4F8' }}>{p.title}</h3>
              <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'rgba(240, 244, 248, 0.5)' }}>{p.desc}</p>
            </div>
          ))}
        </div>

        <div
          className="mt-8 md:mt-12 ios-glass"
          style={{
            padding: 'clamp(20px, 3vw, 32px)',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(30px)',
            transition: 'opacity 0.8s ease 0.4s, transform 0.8s ease 0.4s',
          }}
        >
          <p className="text-center" style={{ fontSize: '14px', lineHeight: 1.7, color: 'rgba(240, 244, 248, 0.5)' }}>
            指令流：手机 / Web 下发 → WS 网关（3001）转发 → 目标 PC 执行 → 流式回传进度 → 多端同步完成通知
          </p>
        </div>
      </div>
    </section>
  )
}
