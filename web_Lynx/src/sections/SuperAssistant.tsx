import { useEffect, useRef, useState } from 'react'

const mechanisms = [
  {
    title: 'Hermes 学习管道',
    desc: '每次任务带 --learn 执行，自动生成 YAML+MD 技能并回写数据库。2-4 周，技能库从 0 长到几十个。',
  },
  {
    title: 'bad 标注反馈学习',
    desc: '对不满意回复标 bad → 写入 feedback-learning.jsonl → 下次对话注入历史反馈上下文，避免重复犯错。',
  },
  {
    title: '巡检自动发现模式',
    desc: 'PatrolRule 按 cron 定时跑，自动检查灵感去重、Graveyard 复活、积压预警，发现问题主动推送。',
  },
]

const milestones = [
  { label: '记忆条数', week: '10-20', month: '50+' },
  { label: '已学习技能', week: '3-5', month: '15+' },
  { label: '任务模式', week: '2-3', month: '10+' },
  { label: '自动执行', week: '0', month: '5+' },
]

export default function SuperAssistant() {
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
      id="assistant"
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
            一个会自主学习、成长、进化的超级助理
          </h2>
          <p
            className="mt-4 max-w-[560px] mx-auto"
            style={{ fontSize: '16px', lineHeight: 1.75, color: 'rgba(240, 244, 248, 0.45)' }}
          >
            普通助理是"工具"，Lynx 是"会成长的同事"。它有记忆、会学习、能主动找你。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-12">
          {mechanisms.map((m, i) => (
            <div
              key={m.title}
              className="ios-glass"
              style={{
                padding: 'clamp(24px, 3vw, 32px)',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(40px)',
                transition: `opacity 0.6s ease ${i * 0.12}s, transform 0.6s ease ${i * 0.12}s`,
              }}
            >
              <h3 className="font-semibold mb-2" style={{ fontSize: '17px', color: '#F0F4F8' }}>{m.title}</h3>
              <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'rgba(240, 244, 248, 0.5)' }}>{m.desc}</p>
            </div>
          ))}
        </div>

        <div
          className="ios-glass"
          style={{
            padding: 'clamp(24px, 3vw, 40px)',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(30px)',
            transition: 'opacity 0.8s ease 0.4s, transform 0.8s ease 0.4s',
          }}
        >
          <h3 className="font-semibold mb-6 text-center" style={{ fontSize: '17px', color: '#F0F4F8' }}>进化里程碑</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {milestones.map((m) => (
              <div key={m.label} className="text-center">
                <div className="text-[12px] mb-2" style={{ color: 'rgba(240, 244, 248, 0.4)' }}>{m.label}</div>
                <div className="flex items-center justify-center gap-3">
                  <div>
                    <div className="font-semibold" style={{ fontSize: 'clamp(20px, 3vw, 28px)', color: '#F0F4F8' }}>{m.week}</div>
                    <div className="text-[11px]" style={{ color: 'rgba(240, 244, 248, 0.35)' }}>1 周</div>
                  </div>
                  <div style={{ color: 'rgba(240, 244, 248, 0.2)' }}>→</div>
                  <div>
                    <div className="font-semibold" style={{ fontSize: 'clamp(20px, 3vw, 28px)', color: '#f59e0b' }}>{m.month}</div>
                    <div className="text-[11px]" style={{ color: 'rgba(240, 244, 248, 0.35)' }}>1 月</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
