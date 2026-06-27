import { useRef, useEffect } from 'react'
import * as THREE from 'three'

interface LineData {
  mesh: THREE.Line
  speeds: number[]
  positions: THREE.Vector3[]
  geometry: THREE.BufferGeometry
}

function createLine(): LineData {
  const numPoints = 30
  const radius = 4 + Math.random() * 5
  const y = -3 + Math.random() * 6
  let start: THREE.Vector3
  if (Math.random() > 0.5) {
    start = new THREE.Vector3(-radius, y, 18 - Math.random() * 6)
  } else {
    start = new THREE.Vector3(radius, y, 18 - Math.random() * 6)
  }
  const end = new THREE.Vector3(0, 0, 0)
  const control1 = new THREE.Vector3(0, y * 0.7, 12)
  const control2 = new THREE.Vector3(0, y * 0.3, 6)
  const curve = new THREE.CatmullRomCurve3([start, control1, control2, end])
  const points = curve.getPoints(numPoints)
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const material = new THREE.LineBasicMaterial({
    color: 0x0F62FE,
    transparent: true,
    opacity: 0.3 + Math.random() * 0.2,
  })
  const mesh = new THREE.Line(geometry, material)
  const positions: THREE.Vector3[] = []
  const speeds: number[] = []
  for (let i = 0; i < points.length; i++) {
    positions.push(new THREE.Vector3(points[i].x, points[i].y, points[i].z))
    speeds.push(0.015 + Math.random() * 0.025)
  }
  return { mesh, speeds, positions, geometry }
}

export default function ConvergenceRays() {
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const isActiveRef = useRef(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(55, container.offsetWidth / container.offsetHeight, 0.1, 100)
    camera.position.set(0, 0, 6)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setSize(container.offsetWidth, container.offsetHeight)
    renderer.setClearColor(0x000000, 0)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    container.appendChild(renderer.domElement)

    const lines: LineData[] = []
    for (let i = 0; i < 50; i++) {
      const line = createLine()
      scene.add(line.mesh)
      lines.push(line)
    }

    let time = 0
    const speed = 0.0005

    const observer = new IntersectionObserver(
      ([entry]) => { isActiveRef.current = entry.isIntersecting },
      { threshold: 0.01, rootMargin: '100px' }
    )
    observer.observe(container)

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') isActiveRef.current = false
    }
    document.addEventListener('visibilitychange', onVisibility)

    const onResize = () => {
      const w = container.offsetWidth
      const h = container.offsetHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    // 30fps — footer is decorative, doesn't need 60fps
    let lastFrame = 0
    const frameInterval = 1000 / 30

    const animate = (now: number) => {
      rafRef.current = requestAnimationFrame(animate)
      if (!isActiveRef.current) return
      if (now - lastFrame < frameInterval) return
      lastFrame = now

      time += speed
      for (let i = 0; i < lines.length; i++) {
        const { positions, speeds, geometry } = lines[i]
        const posAttr = geometry.attributes.position
        const arr = posAttr.array as Float32Array
        for (let j = 0; j < positions.length; j++) {
          positions[j].z += speeds[j]
          positions[j].x += Math.sin(time + j * 0.08 + i) * 0.005
          positions[j].y += Math.cos(time + j * 0.08 + i * 0.5) * 0.005
          if (positions[j].z > 12) {
            positions[j].z = 12
            speeds[j] = -Math.abs(speeds[j])
          }
          if (positions[j].z < 0) {
            positions[j].z = 16 - Math.random() * 5
            speeds[j] = Math.abs(speeds[j]) * 0.4
          }
          arr[j * 3] = positions[j].x
          arr[j * 3 + 1] = positions[j].y
          arr[j * 3 + 2] = positions[j].z
        }
        posAttr.needsUpdate = true
      }
      renderer.render(scene, camera)
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(rafRef.current)
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', onResize)
      lines.forEach((line) => {
        line.geometry.dispose()
        ;(line.mesh.material as THREE.Material).dispose()
      })
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}
    />
  )
}
