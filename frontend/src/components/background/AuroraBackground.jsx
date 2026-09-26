import { useEffect, useRef } from 'react'

const MAX_PARTICLES = 70
const LINK_DISTANCE = 140

export default function AuroraBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const ctx = canvas.getContext('2d')
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let width = 0
    let height = 0
    let dpr = 1
    let particles = []
    let animationFrame = 0
    let time = 0
    let mouseX = 0
    let mouseY = 0
    let targetMouseX = 0
    let targetMouseY = 0
    let prefersReducedMotion = motionQuery.matches

    const createParticles = () => {
      const responsiveCount = Math.floor(width / 15)
      const count = prefersReducedMotion
        ? Math.min(32, Math.max(18, responsiveCount))
        : Math.min(MAX_PARTICLES, Math.max(28, responsiveCount))

      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        velocityX: (Math.random() - 0.5) * 0.6,
        velocityY: (Math.random() - 0.5) * 0.6,
        radius: Math.random() * 1.5 + 1,
        pulseSpeed: Math.random() * 0.012 + 0.003,
        pulseOffset: Math.random() * Math.PI * 2,
      }))
    }

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      const pixelBudgetDpr = Math.sqrt(2_500_000 / Math.max(width * height, 1))
      dpr = Math.min(window.devicePixelRatio || 1, 1.25, Math.max(0.75, pixelBudgetDpr))
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      createParticles()
    }

    const onMouseMove = (event) => {
      targetMouseX = (event.clientX / width - 0.5) * 18
      targetMouseY = (event.clientY / height - 0.5) * 12
    }

    const onTouchMove = (event) => {
      if (!event.touches.length) return
      targetMouseX = (event.touches[0].clientX / width - 0.5) * 18
      targetMouseY = (event.touches[0].clientY / height - 0.5) * 12
    }

    const drawParticle = (particle) => {
      const pulse = prefersReducedMotion
        ? 1
        : 0.72 + Math.sin(time * particle.pulseSpeed * 60 + particle.pulseOffset) * 0.18
      ctx.fillStyle = `rgba(56, 189, 248, ${(0.28 * pulse).toFixed(3)})`
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
      ctx.fill()
    }

    const draw = () => {
      mouseX += (targetMouseX - mouseX) * 0.04
      mouseY += (targetMouseY - mouseY) * 0.04
      ctx.clearRect(0, 0, width, height)
      ctx.save()
      ctx.globalCompositeOperation = 'screen'

      particles.forEach((particle) => {
        if (!prefersReducedMotion) {
          particle.x += particle.velocityX + mouseX * 0.002
          particle.y += particle.velocityY + mouseY * 0.002

          if (particle.x < -8) particle.x = width + 8
          if (particle.x > width + 8) particle.x = -8
          if (particle.y < -8) particle.y = height + 8
          if (particle.y > height + 8) particle.y = -8
        }

        drawParticle(particle)
      })

      for (let firstIndex = 0; firstIndex < particles.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < particles.length; secondIndex += 1) {
          const first = particles[firstIndex]
          const second = particles[secondIndex]
          const deltaX = first.x - second.x
          const deltaY = first.y - second.y
          const distanceSquared = deltaX * deltaX + deltaY * deltaY

          if (distanceSquared < LINK_DISTANCE * LINK_DISTANCE) {
            const distance = Math.sqrt(distanceSquared)
            ctx.strokeStyle = `rgba(56, 189, 248, ${(0.15 * (1 - distance / LINK_DISTANCE)).toFixed(3)})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(first.x, first.y)
            ctx.lineTo(second.x, second.y)
            ctx.stroke()
          }
        }
      }

      ctx.restore()
      if (!prefersReducedMotion) {
        time += 0.016
        animationFrame = window.requestAnimationFrame(draw)
      }
    }

    const onMotionChange = (event) => {
      prefersReducedMotion = event.matches
      window.cancelAnimationFrame(animationFrame)
      targetMouseX = 0
      targetMouseY = 0
      mouseX = 0
      mouseY = 0
      createParticles()
      draw()
    }

    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    motionQuery.addEventListener?.('change', onMotionChange)
    resize()
    draw()

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('touchmove', onTouchMove)
      motionQuery.removeEventListener?.('change', onMotionChange)
    }
  }, [])

  return <canvas ref={canvasRef} className="aurora-canvas" aria-hidden="true" />
}
