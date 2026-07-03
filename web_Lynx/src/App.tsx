import { useEffect } from 'react'
import Lenis from 'lenis'
import Navbar from './sections/Navbar'
import Hero from './sections/Hero'
import Features from './sections/Features'

export default function App() {
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

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
    }
  }, [])

  return (
    <div className="relative">
      <Navbar />
      <Hero />
      <Features />
    </div>
  )
}
