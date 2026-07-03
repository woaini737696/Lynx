import { useState } from 'react'

export default function MobileBanner() {
  const [closed, setClosed] = useState(false)
  if (closed) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[60] px-4 py-3"
      style={{
        background: 'rgba(8, 15, 40, 0.92)',
        backdropFilter: 'saturate(180%) blur(24px)',
        WebkitBackdropFilter: 'saturate(180%) blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img src="/lynx-logo-black.png" alt="奇思" className="w-8 h-8 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-[14px] font-medium truncate" style={{ color: '#F0F4F8' }}>
              奇思安卓版
            </div>
            <div className="text-[12px] truncate" style={{ color: 'rgba(240, 244, 248, 0.45)' }}>
              下载 APP，随时随地使用 AI
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            className="text-[13px] font-medium px-4 py-2 rounded-lg"
            style={{ background: '#0F62FE', color: 'white' }}
          >
            立即下载
          </button>
          <button
            onClick={() => setClosed(true)}
            className="w-7 h-7 flex items-center justify-center rounded-full"
            style={{ color: 'rgba(240, 244, 248, 0.4)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
