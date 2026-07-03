import { useEffect, useRef, useState } from 'react'

// 5 块高价值核心功能（豆包风格：左文右图卡片）
const FEATURES = [
  {
    id: 'agent',
    title: 'Lynx Agent 本地操控',
    desc: 'AI 直接操控你的电脑——桌面控制、Shell 命令、浏览器自动化。所有操作在本地执行，数据不出本机，安全可控。',
    highlight: '数据不出本机',
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=A%20sleek%20dark%20dashboard%20interface%20showing%20AI%20controlling%20a%20desktop%20computer%2C%20with%20terminal%20commands%20and%20browser%20automation%20panels%2C%20blue%20accent%20colors%2C%20modern%20UI%20design%2C%20clean%20layout&image_size=landscape_4_3',
    badge: '核心能力',
  },
  {
    id: 'memory',
    title: '记忆图谱',
    desc: '自动记录你的工作习惯、偏好和历史决策。语义搜索瞬间召回，越用越懂你，让 AI 真正拥有长期记忆。',
    highlight: '越用越懂你',
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=A%20futuristic%20neural%20network%20knowledge%20graph%20visualization%20with%20connected%20nodes%20and%20glowing%20blue%20connections%2C%20dark%20background%2C%20data%20visualization%2C%20modern%20minimal%20design&image_size=landscape_4_3',
    badge: '智能记忆',
  },
  {
    id: 'kanban',
    title: '灵感看板',
    desc: '将碎片化灵感结构化为可执行的看板任务。决策可视化，进度一目了然，让每一个想法都能落地。',
    highlight: '想法到落地',
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=A%20modern%20kanban%20board%20interface%20with%20multiple%20columns%20and%20cards%2C%20dark%20theme%20with%20blue%20accents%2C%20clean%20productivity%20app%20design%2C%20task%20management%20visualization&image_size=landscape_4_3',
    badge: '效率工具',
  },
  {
    id: 'ai-chat',
    title: '多模型 AI 对话',
    desc: '集成多家顶级大模型，Function Calling + 22 个内置工具智能调度。一个对话窗口，调度所有能力。',
    highlight: '22 个内置工具',
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=An%20AI%20chat%20interface%20with%20function%20calling%20visualization%2C%20showing%20multiple%20tool%20icons%20and%20smart%20scheduling%2C%20dark%20mode%20with%20blue%20gradient%2C%20modern%20chat%20app%20design&image_size=landscape_4_3',
    badge: '智能对话',
  },
  {
    id: 'cross-platform',
    title: '三端无缝互通',
    desc: 'Web、Windows 桌面、Android 三端数据实时同步。在电脑上开始，在手机上继续，随时随地不间断。',
    highlight: '数据实时同步',
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Three%20devices%20showing%20the%20same%20app%20interface%20synchronized%20-%20laptop%2C%20desktop%20monitor%2C%20and%20Android%20phone%2C%20with%20data%20sync%20visualization%20between%20them%2C%20dark%20blue%20theme%2C%20modern%20tech%20illustration&image_size=landscape_4_3',
    badge: '全平台',
  },
]

function FeatureCard({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // 交替布局：偶数左图右文，奇数左文右图（豆包风格交替展示）
  const isReversed = index % 2 === 1

  return (
    <div
      ref={ref}
      className="ios-glass relative overflow-hidden"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(40px)',
        transition: 'opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1), transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
        transitionDelay: `${index * 80}ms`,
      }}
    >
      <div
        className="flex flex-col md:flex-row items-stretch"
        style={{ minHeight: '320px' }}
      >
        {/* 文字区域 */}
        <div
          className={`flex-1 flex flex-col justify-center p-8 md:p-10 ${isReversed ? 'md:order-2' : 'md:order-1'}`}
        >
          {/* Badge */}
          <div
            className="inline-flex items-center gap-1.5 mb-3 self-start"
            style={{
              padding: '4px 12px',
              borderRadius: '100px',
              background: 'linear-gradient(135deg, rgba(15, 98, 254, 0.15) 0%, rgba(15, 98, 254, 0.05) 100%)',
              border: '1px solid rgba(15, 98, 254, 0.25)',
              fontSize: '11px',
              fontWeight: 600,
              color: '#4d8aff',
              letterSpacing: '0.02em',
            }}
          >
            {feature.badge}
          </div>

          {/* 标题 */}
          <h3
            className="font-semibold tracking-tight mb-3"
            style={{
              fontSize: 'clamp(22px, 2.5vw, 28px)',
              lineHeight: 1.2,
              color: '#F0F4F8',
              letterSpacing: '-0.01em',
            }}
          >
            {feature.title}
          </h3>

          {/* 介绍 */}
          <p
            style={{
              fontSize: '15px',
              lineHeight: 1.75,
              color: 'rgba(240, 244, 248, 0.6)',
              maxWidth: '420px',
            }}
          >
            {feature.desc}
          </p>

          {/* 高亮标签 */}
          <div
            className="mt-5 inline-flex items-center gap-2 self-start"
            style={{
              padding: '6px 14px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '13px',
              fontWeight: 500,
              color: 'rgba(240, 244, 248, 0.8)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4d8aff" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            {feature.highlight}
          </div>
        </div>

        {/* 图片演示区域 */}
        <div
          className={`flex-1 relative overflow-hidden ${isReversed ? 'md:order-1' : 'md:order-2'}`}
          style={{
            minHeight: '240px',
            background: 'linear-gradient(135deg, rgba(15, 98, 254, 0.08) 0%, rgba(8, 15, 40, 0.4) 100%)',
          }}
        >
          {/* 加载占位 */}
          {!imgLoaded && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(15, 98, 254, 0.06) 0%, rgba(8, 15, 40, 0.3) 100%)' }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.1)',
                  borderTopColor: '#4d8aff',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
            </div>
          )}
          <img
            src={feature.image}
            alt={feature.title}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: imgLoaded ? 1 : 0,
              transition: 'opacity 0.6s ease',
            }}
          />
          {/* 渐变遮罩（让图片与卡片融合） */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: isReversed
                ? 'linear-gradient(to right, transparent 60%, rgba(3, 8, 22, 0.6) 100%)'
                : 'linear-gradient(to left, transparent 60%, rgba(3, 8, 22, 0.6) 100%)',
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default function Features() {
  return (
    <section id="features" className="relative py-20 md:py-28 px-4" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* 标题 */}
      <div className="text-center mb-12 md:mb-16">
        <div
          className="inline-flex items-center gap-1.5 mb-4"
          style={{
            padding: '6px 16px',
            borderRadius: '100px',
            background: 'linear-gradient(135deg, rgba(15, 98, 254, 0.12) 0%, rgba(15, 98, 254, 0.04) 100%)',
            border: '1px solid rgba(15, 98, 254, 0.2)',
            fontSize: '12px',
            fontWeight: 600,
            color: '#4d8aff',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          核心功能
        </div>
        <h2
          className="font-semibold tracking-tight mb-4"
          style={{
            fontSize: 'clamp(28px, 4vw, 42px)',
            lineHeight: 1.15,
            color: '#F0F4F8',
            letterSpacing: '-0.02em',
          }}
        >
          五大核心能力，重新定义 AI 助理
        </h2>
        <p
          style={{
            fontSize: 'clamp(14px, 1.5vw, 17px)',
            lineHeight: 1.75,
            color: 'rgba(240, 244, 248, 0.5)',
            maxWidth: '560px',
            margin: '0 auto',
          }}
        >
          从本地操控到记忆图谱，从灵感看板到三端互通，奇思让 AI 真正成为你的超级助理
        </p>
      </div>

      {/* 5 块功能卡片 */}
      <div className="flex flex-col gap-6 md:gap-8">
        {FEATURES.map((feature, index) => (
          <FeatureCard key={feature.id} feature={feature} index={index} />
        ))}
      </div>

      {/* 最底部下载按钮 */}
      <div className="text-center mt-16 md:mt-20">
        <a
          href="https://www.lynxdo.com/download/Lynx-windows-setup.exe"
          className="btn-primary inline-flex"
          style={{ fontSize: '16px', padding: '14px 36px' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          下载奇思桌面端
        </a>
        <p
          className="mt-4"
          style={{
            fontSize: '13px',
            color: 'rgba(240, 244, 248, 0.4)',
          }}
        >
          Windows 10/11 · 69MB · v1.0.3
        </p>
      </div>
    </section>
  )
}
