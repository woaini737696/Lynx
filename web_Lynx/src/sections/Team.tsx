import { useEffect, useRef, useState } from 'react'

const professions = [
  'PM', '设计', '前端', '后端', '数据', '运营', '市场', 'HR', '财务', '项目', '创作者', '创始人',
]

const features = [
  { title: '12 岗位工作空间', desc: '每岗位独立技能白名单、System Prompt、模型限制、快捷指令。' },
  { title: '35 项细粒度权限', desc: 'admin / editor / viewer 内置角色 + 自定义角色，权限按 key 数组配置。' },
  { title: '权限缓存版本号', desc: 'User.permissionVersion 角色变更递增，多实例缓存自动失效，避免脏读。' },
  { title: '词元统计看板', desc: '今日 / 昨日 / 近 7 天 / 累计四卡，按 provider 柱状图 + 用户消耗排行榜。' },
]

export default function Team() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold: 0.1 }
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      id="team"
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
            团队版：AI 员工团队，快速搭建
          </h2>
          <p
            className="mt-4 max-w-[560px] mx-auto"
            style={{ fontSize: '16px', lineHeight: 1.75, color: 'rgba(240, 244, 248, 0.45)' }}
          >
            解决企业 AI 化焦虑。购买后按岗位部署 AI 员工，开箱即用。
          </p>
        </div>

        <div
          className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-3 mb-10"
          style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity 0.6s ease, transform 0.6s ease' }}
        >
          {professions.map((p, i) => (
            <div
              key={p}
              className="ios-glass flex items-center justify-center text-[12px] font-medium"
              style={{
                padding: '12px 4px',
                color: '#F0F4F8',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(10px)',
                transition: `opacity 0.4s ease ${i * 0.03}s, transform 0.4s ease ${i * 0.03}s`,
              }}
            >
              {p}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="ios-glass"
              style={{
                padding: 'clamp(22px, 3vw, 28px)',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(40px)',
                transition: `opacity 0.6s ease ${0.2 + i * 0.1}s, transform 0.6s ease ${0.2 + i * 0.1}s`,
              }}
            >
              <h3 className="font-semibold mb-2" style={{ fontSize: '16px', color: '#F0F4F8' }}>{f.title}</h3>
              <p style={{ fontSize: '13px', lineHeight: 1.7, color: 'rgba(240, 244, 248, 0.5)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
