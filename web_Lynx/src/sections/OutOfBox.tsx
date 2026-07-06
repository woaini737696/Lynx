import { useEffect, useRef, useState } from 'react'

const features = [
  { title: '零配置启动', desc: 'npm install → 配 .env → prisma db push → seed 脚本一键初始化。' },
  { title: '本地优先', desc: 'MySQL 数据目录 D:\\LynnHub\\mysql_data，Hermes profile 项目内隔离，禁止 C 盘写项目数据。' },
  { title: '数据自主', desc: '本地文件操作不自动上传，仅返回摘要；用户可自配 AI Key。' },
  { title: '一键部署', desc: '桌面端「安装 Hermes Agent」按钮自动 pip install + 配置模型 + 测试连接。' },
  { title: '自动更新', desc: 'Tauri Updater 启动延迟 5s 检查，semver 比较，有更新弹窗引导。' },
]

export default function OutOfBox() {
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
      id="outofbox"
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
            开箱即用
          </h2>
          <p
            className="mt-4 max-w-[480px] mx-auto"
            style={{ fontSize: '16px', lineHeight: 1.75, color: 'rgba(240, 244, 248, 0.45)' }}
          >
            装上就能用，不用学AI，什么都能干。所有数据在你自己的机器上。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="ios-glass"
              style={{
                padding: 'clamp(22px, 3vw, 28px)',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(40px)',
                transition: `opacity 0.6s ease ${i * 0.1}s, transform 0.6s ease ${i * 0.1}s`,
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
