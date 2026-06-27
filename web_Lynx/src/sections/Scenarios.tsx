import { useEffect, useRef, useState } from 'react'

const scenarios = [
  {
    title: '个人认知复利',
    role: '知识工作者 / 独立开发者 / 终身学习者',
    value: '灵感不丢失、决策有依据、记忆可检索、认知可复利',
    usage: '闪电输入捕获灵感 → 看板聚焦执行 → AI 自动提取认知 → 记忆图谱自动连边',
  },
  {
    title: '团队 AI 化',
    role: '中小企业 / 创业团队 / 部门负责人',
    value: '解决"AI 不知道怎么用"的焦虑，12 岗位开箱即用，权限隔离',
    usage: 'admin 配岗位工作空间 → 成员按角色登录 → 各自用专属技能 → 词元统计控成本',
  },
  {
    title: '知识工作者',
    role: '产品经理 / 研究员 / 内容创作者',
    value: '对话资产捕获 → AI 提取结论待办 → 沉淀认知库',
    usage: '粘贴 Kimi/Claude/Codex 对话 → AI 自动提炼方法论 / 经验 / 提示词 → 关联记忆图谱',
  },
  {
    title: '研发团队',
    role: '前端 / 后端 / 全栈工程师',
    value: '代码审查蒸馏模板、Hermes 跑 Shell 批处理、工作流自动生成周报',
    usage: '用代码审查模板审 PR → Hermes 批量重命名文件 → 工作流定时跑构建检查',
  },
]

export default function Scenarios() {
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
      id="scenarios"
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
            谁在用 Lynx
          </h2>
          <p
            className="mt-4 max-w-[480px] mx-auto"
            style={{ fontSize: '16px', lineHeight: 1.75, color: 'rgba(240, 244, 248, 0.45)' }}
          >
            从个人认知复利到团队 AI 化，覆盖四类典型用户。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {scenarios.map((s, i) => (
            <div
              key={s.title}
              className="ios-glass"
              style={{
                padding: 'clamp(24px, 3vw, 32px)',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(40px)',
                transition: `opacity 0.6s ease ${i * 0.12}s, transform 0.6s ease ${i * 0.12}s`,
              }}
            >
              <h3 className="font-semibold mb-1" style={{ fontSize: '17px', color: '#F0F4F8' }}>{s.title}</h3>
              <div className="text-[12px] mb-3" style={{ color: 'rgba(240, 244, 248, 0.35)' }}>{s.role}</div>
              <p className="mb-3" style={{ fontSize: '14px', lineHeight: 1.7, color: 'rgba(240, 244, 248, 0.6)' }}>{s.value}</p>
              <p style={{ fontSize: '13px', lineHeight: 1.7, color: 'rgba(240, 244, 248, 0.4)' }}>典型用法：{s.usage}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
