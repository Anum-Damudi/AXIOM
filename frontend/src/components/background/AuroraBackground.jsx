import { useEffect, useRef } from 'react'

// AXIOM palette (rgb tuples) governing the aurora streams.
const STREAMS = [
  // { r, g, b, alphaPeak, baseYFactor, heightFactor, freq, speed }
  { r: 194, g: 232, b: 255, alphaPeak: 0.09, baseYFactor: 0.2, heightFactor: 170, freq: 0.0008, speed: 0.3 },  // Ice #C2E8FF
  { r: 0, g: 70, b: 113, alphaPeak: 0.16, baseYFactor: 0.24, heightFactor: 150, freq: 0.0012, speed: 0.5 },   // Deep #004671
  { r: 54, g: 92, b: 115, alphaPeak: 0.16, baseYFactor: 0.3, heightFactor: 140, freq: 0.001, speed: 0.4 },    // Steel #365C73
  { r: 4, g: 42, b: 65, alphaPeak: 0.2, baseYFactor: 0.36, heightFactor: 120, freq: 0.0018, speed: 0.85 },    // Navy #042A41
  { r: 114, g: 152, b: 175, alphaPeak: 0.12, baseYFactor: 0.44, heightFactor: 100, freq: 0.0015, speed: 0.7 },// Muted #7298AF
  { r: 234, g: 255, b: 255, alphaPeak: 0.05, baseYFactor: 0.52, heightFactor: 90, freq: 0.0022, speed: 1.0 }, // Near-white #EAFFFF
]


export default function AuroraBackground() {
  const canvasRef = useRef(null)
  const reducedMotionRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')

    let width = 0
    let height = 0
    let time = 0
    let rafId = 0

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const prefersReducedMotion = mq.matches
    reducedMotionRef.current = prefersReducedMotion

    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    function resize() {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const stars = Array.from({ length: prefersReducedMotion ? 40 : 120 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight * 0.85,
      size: Math.random() * 1.4 + 0.4,
      alpha: Math.random() * 0.5 + 0.15,
      pulseSpeed: Math.random() * 0.015 + 0.003,
      pulseOffset: Math.random() * Math.PI * 2,
    }))

    let mouseX = 0
    let mouseY = 0
    let targetMouseX = 0
    let targetMouseY = 0

    const onMouseMove = (e) => {
      targetMouseX = (e.clientX / width - 0.5) * 36
      targetMouseY = (e.clientY / height - 0.5) * 18
    }
    const onTouchMove = (e) => {
      if (e.touches.length > 0) {
        targetMouseX = (e.touches[0].clientX / width - 0.5) * 36
        targetMouseY = (e.touches[0].clientY / height - 0.5) * 18
      }
    }

    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    resize()

    function drawFrame() {
      mouseX += (targetMouseX - mouseX) * 0.04
      mouseY += (targetMouseY - mouseY) * 0.04

      ctx.clearRect(0, 0, width, height)

      const bgGradient = ctx.createLinearGradient(0, 0, 0, height)
      bgGradient.addColorStop(0, '#042A41')
      bgGradient.addColorStop(0.5, '#004671')
      bgGradient.addColorStop(1, '#042A41')
      ctx.fillStyle = bgGradient
      ctx.fillRect(0, 0, width, height)

      stars.forEach((star) => {
        const pulse = prefersReducedMotion
          ? 1
          : 0.5 + 0.5 * Math.sin(time * star.pulseSpeed * 60 + star.pulseOffset)
        ctx.fillStyle = `rgba(194, 232, 255, ${(star.alpha * pulse).toFixed(3)})`
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
        ctx.fill()
      })

      STREAMS.forEach((stream, i) => {
        ctx.save()
        ctx.globalCompositeOperation = 'screen'

        const streamBaseY = height * stream.baseYFactor
        const waveHeight = stream.heightFactor
        const frequency = stream.freq
        const speed = stream.speed

        const gradient = ctx.createLinearGradient(
          0,
          streamBaseY - waveHeight,
          0,
          streamBaseY + waveHeight * 2.2,
        )
        gradient.addColorStop(0, `rgba(${stream.r}, ${stream.g}, ${stream.b}, 0)`)
        gradient.addColorStop(0.25, `rgba(${stream.r}, ${stream.g}, ${stream.b}, ${stream.alphaPeak})`)
        gradient.addColorStop(0.65, `rgba(${stream.r}, ${stream.g}, ${stream.b}, ${stream.alphaPeak * 0.5})`)
        gradient.addColorStop(1, `rgba(${stream.r}, ${stream.g}, ${stream.b}, 0)`)

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.moveTo(0, height)

        const step = Math.max(8, Math.floor(width / 160))
        for (let x = 0; x <= width + step; x += step) {
          const wave1 = Math.sin(x * frequency + time * speed + mouseX * 0.015) * waveHeight
          const wave2 = Math.cos(x * frequency * 1.6 - time * speed * 1.2 + mouseY * 0.02) * (waveHeight * 0.45)
          const wave3 = Math.sin(x * frequency * 0.4 + time * speed * 0.4) * (waveHeight * 0.7)
          const y = streamBaseY + wave1 + wave2 + wave3 + mouseY * (i + 1) * 0.15
          ctx.lineTo(x, y)
        }

        ctx.lineTo(width, height)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      })

      if (!prefersReducedMotion) {
        time += 0.016
        rafId = requestAnimationFrame(drawFrame)
      }
    }

    drawFrame()

    const onMotionChange = (e) => {
      const nowReduced = e.matches
      if (nowReduced && !prefersReducedMotion) {
        cancelAnimationFrame(rafId)
      }
    }
    mq.addEventListener?.('change', onMotionChange)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('touchmove', onTouchMove)
      mq.removeEventListener?.('change', onMotionChange)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="aurora-canvas"
      aria-hidden="true"
      style={{ background: '#042A41' }}
    />
  )
}