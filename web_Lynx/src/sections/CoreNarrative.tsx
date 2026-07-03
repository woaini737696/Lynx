import { useEffect, useRef, useState } from 'react'

const stats = [
  { value: '3', label: '端互通', desc: 'Web / Windows / Android' },
  { value: '60+', label: '预置技能', desc: '覆盖 12 岗位工作空间' },
  { value: '35', label: '细粒度权限', desc: 'admin / editor / viewer + 自定义' },
]

export default function CoreNarrative() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold: 0.2 }
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      id="narrative"
      ref={sectionRef}
      className="relative w-full"
      style={{ background: '#030816', paddingTop: 'clamp(40px, 6vw, 80px)', paddingBottom: 'clamp(40px, 6vw, 80px)' }}
    >
      <div className="max-w-[1280px] mx-auto px-4 md:px-6">
        <div
          className="ios-glass flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12"
          style={{ padding: 'clamp(28px, 4vw, 48px)' }}
        >
          <div className="flex-1" style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity 0.8s ease, transform 0.8s ease' }}>
            <h2
              className="font-semibold tracking-tight mb-3"
              style={{ fontSize: 'clamp(18px, 2.4vw, 28px)', lineHeight: 1.3, color: '#F0F4F8' }}
            >
              奇思是你的认知操作系统
            </h2>
            <p style={{ fontSize: '15px', lineHeight: 1.75, color: 'rgba(240, 244, 248, 0.5)' }}>
              不是又一个 AI 聊天框，而是一个会自主学习、成长、进化的超级助理——它住在你的工作流里，三端互通，开箱即用。
            </p>
          </div>

          <div className="flex-1 w-full">
            <div className="grid grid-cols-3 gap-4">
              {stats.map((s, i) => (
                <div
                  key={s.label}
                  className="text-center"
                  style={{
                    opacity: visible ? 1 : 0,
                    transform: visible ? 'translateY(0)' : 'translateY(20px)',
                    transition: `opacity 0.6s ease ${i * 0.12}s, transform 0.6s ease ${i * 0.12}s`,
                  }}
                >
                  <div className="font-semibold" style={{ fontSize: 'clamp(28px, 4vw, 44px)', color: '#F0F4F8' }}>{s.value}</div>
                  <div className="text-[13px] font-medium mt-1" style={{ color: '#F0F4F8' }}>{s.label}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: 'rgba(240, 244, 248, 0.35)' }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
