import { useEffect, useRef } from 'react'

const cards = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00B8D4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
    title: 'AI 工作流',
    desc: '可视化编排触发器、LLM、条件分支、HTTP、Hermes 本地执行等 9 种节点。定时调度 + 图遍历执行，自动写入认知库、生成技能或推送通知。',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0F62FE" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    title: '自动蒸馏技能',
    desc: '不用手写提示词。Hermes 每完成一次任务就 /learn 沉淀为 YAML+MD 技能，重复两次后自动执行。7 类预置模板、技能市场、版本回滚一应俱全。',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00B8D4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
    title: '智能记忆图谱',
    desc: '灵感、对话、认知写入时自动生成 embedding 并与历史记忆连边。AI 向量优先，无 Key 时降级 TF-IDF。3D 力导向图谱，越用越密，记得越多。',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0F62FE" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    title: 'AGI 级 AI 能力',
    desc: '不止聊天：屏幕感知、桌面 RPA、浏览器自动化、Shell 执行、全双工语音、音色克隆、PDF 视觉降级。L1/L2/L3 分级授权，紧急停止一键生效。',
  },
]

export default function Capabilities() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const els = cardsRef.current.filter(Boolean) as HTMLDivElement[]
            els.forEach((el, i) => {
              setTimeout(() => {
                el.style.transition = 'opacity 0.6s ease, transform 0.6s ease'
                el.style.opacity = '1'
                el.style.transform = 'translateY(0)'
              }, i * 120)
            })
            observer.disconnect()
          }
        })
      },
      { threshold: 0.15 }
    )

    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      id="capabilities"
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
            四大核心能力
          </h2>
          <p
            className="mt-4 max-w-[480px] mx-auto"
            style={{ fontSize: '16px', lineHeight: 1.75, color: 'rgba(240, 244, 248, 0.45)' }}
          >
            不只是 AI 聊天框，而是一套能自动执行、自动学习、自动记忆的完整工作系统
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {cards.map((card, i) => (
            <div
              key={card.title}
              ref={(el) => { cardsRef.current[i] = el }}
              className="ios-glass cursor-default group"
              style={{
                padding: 'clamp(24px, 3vw, 32px)',
                opacity: 0,
                transform: 'translateY(40px)',
              }}
            >
              <div
                className="rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
                style={{
                  width: '48px',
                  height: '48px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                {card.icon}
              </div>
              <h3
                className="font-semibold mb-2"
                style={{ fontSize: '18px', letterSpacing: '-0.01em', color: '#F0F4F8' }}
              >
                {card.title}
              </h3>
              <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'rgba(240, 244, 248, 0.5)' }}>
                {card.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
