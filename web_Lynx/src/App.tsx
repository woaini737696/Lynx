import { useEffect, useState } from 'react'
import Lenis from 'lenis'
import Navbar from './sections/Navbar'
import Hero from './sections/Hero'
import CoreNarrative from './sections/CoreNarrative'
import Capabilities from './sections/Capabilities'
import SuperAssistant from './sections/SuperAssistant'
import CrossPlatform from './sections/CrossPlatform'
import OutOfBox from './sections/OutOfBox'
import Team from './sections/Team'
import Scenarios from './sections/Scenarios'
import Terminal from './sections/Terminal'
import Footer from './sections/Footer'
import MobileBanner from './sections/MobileBanner'

export default function App() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.08,
      smoothWheel: true,
      wheelMultiplier: 1,
    })

    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }
    const rafId = requestAnimationFrame(raf)

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
      {isMobile && <MobileBanner />}
      <Navbar />
      <Hero />
      <CoreNarrative />
      <Capabilities />
      <SuperAssistant />
      <CrossPlatform />
      <OutOfBox />
      <Team />
      <Scenarios />
      <Terminal />
      <Footer />
    </div>
  )
}
