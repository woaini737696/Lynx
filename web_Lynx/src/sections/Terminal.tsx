import { useEffect, useRef, useState } from 'react'

const codeLines = [
  { text: '$ git clone git@gitee.com:Admin/Lynx.git', type: 'cmd' as const },
  { text: '[Lynx] 检出三端工作台源码...', type: 'info' as const },
  { text: '[Lynx] Web(Next.js) / Windows(Tauri) / Android(uni-app)', type: 'info' as const },
  { text: '$ npm install', type: 'cmd' as const },
  { text: '[Lynx] 安装依赖...', type: 'info' as const },
  { text: '  prisma@latest', type: 'ok' as const },
  { text: '  swr@latest', type: 'ok' as const },
  { text: '  framer-motion@latest', type: 'ok' as const },
  { text: '$ npx prisma db push', type: 'cmd' as const },
  { text: '[Lynx] 同步数据库 schema...', type: 'info' as const },
  { text: '$ npm run seed:all', type: 'cmd' as const },
  { text: '[Lynx] 初始化管理员 / 角色 / 60 技能 / 巡检规则', type: 'info' as const },
  { text: '$ npx next dev -p 5176', type: 'cmd' as const },
  { text: '  Local:   http://localhost:5176', type: 'ok' as const },
  { text: '  MySQL:   localhost:3306', type: 'ok' as const },
  { text: '[Lynx] Hermes Agent 已就绪，等待指令...', type: 'accent' as const },
  { text: '$ _', type: 'cursor' as const },
]

export default function Terminal() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [displayedLines, setDisplayedLines] = useState<number>(0)

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

  useEffect(() => {
    if (!visible) return
    let count = 0
    const interval = setInterval(() => {
      count++
      setDisplayedLines(count)
      if (count >= codeLines.length) clearInterval(interval)
    }, 180)
    return () => clearInterval(interval)
  }, [visible])

  const getLineColor = (type: string) => {
    switch (type) {
      case 'cmd': return '#00B8D4'
      case 'ok': return '#34D399'
      case 'accent': return '#0F62FE'
      case 'cursor': return '#F0F4F8'
      default: return 'rgba(240,244,248,0.5)'
    }
  }

  return (
    <section
      id="terminal"
      ref={sectionRef}
      className="relative w-full overflow-hidden"
      style={{
        background: '#030816',
        paddingTop: 'clamp(80px, 12vw, 160px)',
        paddingBottom: 'clamp(80px, 12vw, 160px)',
      }}
    >
      <div className="max-w-[1280px] mx-auto px-4 md:px-6">
        <div
          className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(40px)',
            transition: 'opacity 0.8s ease, transform 0.8s ease',
          }}
        >
          <div className="flex-1 max-w-[480px]">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
              style={{
                background: 'rgba(15, 98, 254, 0.08)',
                backdropFilter: 'saturate(180%) blur(12px)',
                WebkitBackdropFilter: 'saturate(180%) blur(12px)',
                border: '1px solid rgba(15, 98, 254, 0.15)',
              }}
            >
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#0F62FE' }} />
              <span className="text-[#0F62FE] text-[13px] font-medium">Terminal Environment</span>
            </div>

            <h2
              className="font-semibold tracking-tight mb-4"
              style={{
                fontSize: 'clamp(24px, 3.5vw, 42px)',
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
                color: '#F0F4F8',
                textWrap: 'balance',
              }}
            >
              技术架构：为 AGI 级工作台而生
            </h2>

            <p className="mb-8" style={{ fontSize: '15px', lineHeight: 1.75, color: 'rgba(240, 244, 248, 0.55)' }}>
              Next.js + Tauri + Android + Prisma，统一 API 信封、权限缓存版本号、SSE 断连恢复、本地化 Hermes Agent，支撑三端互通的完整能力链。
            </p>

            <div className="flex flex-col gap-3">
              {[
                { label: '统一 API 信封', desc: '{ success, data } / { success, error } 全端一致' },
                { label: '权限缓存版本号', desc: '角色变更自动失效多实例缓存' },
                { label: 'WS 网关独立进程', desc: '端口 3001，远程指令 + 心跳 + 流式回传' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="ios-glass-sm flex items-start gap-3 p-4"
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'rgba(15, 98, 254, 0.15)' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0F62FE" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[14px] font-medium" style={{ color: '#F0F4F8' }}>{item.label}</div>
                    <div className="text-[13px]" style={{ color: 'rgba(240,244,248,0.4)' }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 flex justify-center w-full">
            <div className="relative w-full" style={{ maxWidth: '560px' }}>
              <div
                className="rounded-2xl overflow-hidden w-full"
                style={{
                  background: 'rgba(3, 8, 22, 0.9)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 24px 80px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.1)',
                }}
              >
                <div
                  className="flex items-center gap-2 px-4 md:px-5 py-3"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="w-3 h-3 rounded-full" style={{ background: '#FF5F57' }} />
                  <div className="w-3 h-3 rounded-full" style={{ background: '#FFBD2E' }} />
                  <div className="w-3 h-3 rounded-full" style={{ background: '#28C840' }} />
                  <span className="ml-3 font-mono text-[12px]" style={{ color: 'rgba(240,244,248,0.3)' }}>lynx — bash</span>
                </div>

                <div
                  className="p-4 md:p-5 font-mono text-[12px] md:text-[13px] leading-relaxed overflow-hidden"
                  style={{ minHeight: '280px', color: 'rgba(240,244,248,0.5)' }}
                >
                  {codeLines.slice(0, displayedLines).map((line, i) => (
                    <div key={i} className="mb-1" style={{ color: getLineColor(line.type), opacity: line.type === 'cursor' ? 0.7 : 1 }}>
                      {line.type === 'cursor' ? (
                        <span className="animate-pulse">$ <span className="inline-block w-2 h-4 align-middle" style={{ background: '#F0F4F8' }} /></span>
                      ) : line.text}
                    </div>
                  ))}
                </div>
              </div>

              <div
                className="absolute -inset-4 rounded-3xl -z-10"
                style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(15,98,254,0.08), transparent)' }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
