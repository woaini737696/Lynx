import { lazy, Suspense, useEffect, useState } from 'react'
import Lenis from 'lenis'
import Navbar from './sections/Navbar'
import Hero from './sections/Hero'

// 首屏以下 sections 懒加载，降低 TTFB/FCP 体积
const CoreNarrative = lazy(() => import('./sections/CoreNarrative'))
const Capabilities = lazy(() => import('./sections/Capabilities'))
const SuperAssistant = lazy(() => import('./sections/SuperAssistant'))
const CrossPlatform = lazy(() => import('./sections/CrossPlatform'))
const OutOfBox = lazy(() => import('./sections/OutOfBox'))
const Team = lazy(() => import('./sections/Team'))
const Scenarios = lazy(() => import('./sections/Scenarios'))
const Terminal = lazy(() => import('./sections/Terminal'))
const Footer = lazy(() => import('./sections/Footer'))
const MobileBanner = lazy(() => import('./sections/MobileBanner'))

// 简易占位（避免懒加载 sections 在网络抖动时出现空白闪烁）
function SectionFallback() {
  return <div style={{ minHeight: '60vh' }} />
}

export default function App() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.08,
      smoothWheel: true,
      wheelMultiplier: 1,
    })

    let rafId = 0
    function raf(time: number) {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)

    const checkMobile = () => {
      const ua = navigator.userAgent.toLowerCase()
      setIsMobile(/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua))
    }
    checkMobile()

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
    }
  }, [])

  return (
    <div className="relative">
      <Suspense fallback={null}>
        {isMobile && <MobileBanner />}
      </Suspense>
      <Navbar />
      <Hero />
      <Suspense fallback={<SectionFallback />}>
        <CoreNarrative />
        <Capabilities />
        <SuperAssistant />
        <CrossPlatform />
        <OutOfBox />
        <Team />
        <Scenarios />
        <Terminal />
        <Footer />
      </Suspense>
    </div>
  )
}
