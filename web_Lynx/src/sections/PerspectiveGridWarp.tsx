import { useRef, useEffect } from 'react'
import * as THREE from 'three'

const vertexShader = `
  varying vec2 vUv;
  uniform vec2 uMouse;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // --- GLOBAL PERSPECTIVE BEND ---
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(uv, center);
    float perspective = dist * 3.5;
    pos.z -= perspective * 0.35;

    // --- MOUSE GRAVITY WELL ---
    // Clamp mouse to avoid edge artifacts
    vec2 mouseClamped = clamp(uMouse, vec2(0.02), vec2(0.98));
    float md = distance(uv, mouseClamped);
    float falloff = smoothstep(0.38, 0.0, md);
    float depression = falloff * 0.6;
    pos.z -= depression;

    // UV pull toward mouse for visible warping
    vec2 toMouse = mouseClamped - uv;
    float uvPull = falloff * 0.04;
    vUv += toMouse * uvPull;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const fragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform float iTime;
  uniform vec2 uMouse;

  vec3 grid(vec2 p, vec3 col) {
    vec2 u = gl_FragCoord.xy;
    float d = 8.0 * p.y;
    float gridX = step(0.9, fract(u.x / d));
    float gridY = step(0.9, fract(u.y / 4.0));
    float gridVal = max(gridX, gridY);
    return mix(vec3(0.0), col, gridVal);
  }

  vec3 trapeze(vec2 uv, float yTop, float yBot, float xTop, float xBot) {
    float y = (uv.y - yTop) / (yBot - yTop);
    float xMix = mix(xTop, xBot, y);
    if (uv.y > yTop && uv.y < yBot && abs(uv.x - 0.5) < xMix) {
      return vec3(uv.x, y, 1.0);
    }
    return vec3(0.0, 0.0, 0.0);
  }

  void main() {
    vec2 uv = clamp(vUv, 0.0, 1.0);

    // Mouse glow - separate from ray fade to avoid edge artifacts
    vec2 mouseClamped = clamp(uMouse, vec2(0.02), vec2(0.98));
    float mouseDist = distance(uv, mouseClamped);
    float mouseGlow = 1.0 - smoothstep(0.0, 0.28, mouseDist);

    // Depth traversal
    float depth = sin(iTime * 0.3) * 3.0 + 6.0;
    float z = 4.0 / (uv.y * depth + 1.0);

    // Main perspective grid
    vec2 p = vec2((uv.x - 0.5) * z + 0.5, z);
    float d = 0.25 * z;
    p = floor(p / d) * d + d * 0.5;
    vec3 gridVal = grid(p, vec3(0.2, 0.8, 1.0));
    vec4 col = vec4(gridVal * uv.y, 1.0);

    // Upper trapezoid
    vec3 topTrap = trapeze(uv, 0.08, 0.32, 0.24, 0.4);
    topTrap.y = (topTrap.y - 0.5) * z + 0.5;
    topTrap.x = (topTrap.x - 0.5) * z + 0.5;
    col += vec4(grid(topTrap.xy, vec3(1.0)) * topTrap.z, topTrap.z);

    // Lower trapezoid
    vec3 botTrap = trapeze(uv, 0.68, 0.96, 0.4, 0.6);
    botTrap.y = (botTrap.y - 0.5) * z + 0.5;
    botTrap.x = (botTrap.x - 0.5) * z + 0.5;
    col += vec4(grid(botTrap.xy, vec3(1.0)) * botTrap.z, botTrap.z);

    // --- SAFE EDGE FADE: smooth falloff at all edges ---
    // Use smoothstep on all four edges instead of pow(abs(x-0.5))
    float edgeX = smoothstep(0.0, 0.08, uv.x) * smoothstep(1.0, 0.92, uv.x);
    float edgeY = smoothstep(0.0, 0.05, uv.y) * smoothstep(1.0, 0.85, uv.y);
    float edgeFade = edgeX * edgeY;
    col.rgb *= edgeFade;

    // Center boost (replace ray fade)
    float centerDist = distance(uv, vec2(0.5, 0.55));
    float centerBoost = 1.0 - smoothstep(0.0, 0.5, centerDist);
    col.rgb *= 0.5 + centerBoost * 0.5;

    // Vertical gradient
    col.rgb *= 0.5 + uv.y * 0.5;

    // Mouse glow - additive only, no multiplicative edge interaction
    col.rgb += vec3(0.12, 0.35, 0.65) * mouseGlow * 0.4;

    gl_FragColor = col;
  }
`

export default function PerspectiveGridWarp() {
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const isActiveRef = useRef(true)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setSize(container.offsetWidth, container.offsetHeight)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    container.appendChild(renderer.domElement)

    const uniforms = {
      iTime: { value: 0 },
      iResolution: { value: new THREE.Vector2(container.offsetWidth, container.offsetHeight) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    }

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      depthWrite: false,
    })

    const geometry = new THREE.PlaneGeometry(2, 2)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const mouseCurrent = new THREE.Vector2(0.5, 0.5)
    const mouseTarget = new THREE.Vector2(0.5, 0.5)
    let timeOffset = 0

    // Track mouse globally for the "global depression" effect
    const onMouseMove = (e: MouseEvent) => {
      mouseTarget.x = e.clientX / window.innerWidth
      mouseTarget.y = 1.0 - e.clientY / window.innerHeight
    }

    const onWheel = (e: WheelEvent) => {
      timeOffset += e.deltaY * 0.0005
    }

    const onResize = () => {
      const w = container.offsetWidth
      const h = container.offsetHeight
      renderer.setSize(w, h)
      uniforms.iResolution.value.set(w, h)
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('resize', onResize)

    const clock = new THREE.Clock()

    const onVisibility = () => {
      isActiveRef.current = document.visibilityState === 'visible'
    }
    document.addEventListener('visibilitychange', onVisibility)

    // Full 60fps
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate)
      if (!isActiveRef.current) return

      const elapsed = clock.getElapsedTime()
      uniforms.iTime.value = elapsed + timeOffset
      mouseCurrent.lerp(mouseTarget, 0.1)
      uniforms.uMouse.value.copy(mouseCurrent)
      renderer.render(scene, camera)
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      renderer.dispose()
      geometry.dispose()
      material.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 1,
      }}
    />
  )
}
