import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

const NUMERIC = /^-?\d+(\.\d+)?$/

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

// Eases a value up to whatever it is handed. The target is never invented or
// rewritten: it is returned verbatim when it is not a plain number, and when
// motion is disabled by the OS or by the in-app setting.
export function useCountUp(target, { duration = 900, enabled = true } = {}) {
  const reducedMotion = usePrefersReducedMotion()
  const shouldAnimate = enabled && !reducedMotion
  const numeric = NUMERIC.test(String(target))
  const parsed = numeric ? Number(target) : null

  const [value, setValue] = useState(() =>
    shouldAnimate && numeric ? 0 : target,
  )
  const valueRef = useRef(value)
  const rafRef = useRef(0)

  useEffect(() => {
    if (!shouldAnimate || !numeric) {
      // Keep the origin in sync so re-enabling motion resumes from the right
      // place instead of replaying from zero.
      valueRef.current = target
      return undefined
    }

    const from = valueRef.current
    const delta = parsed - from
    if (delta === 0) return undefined

    let start = 0
    const step = (now) => {
      if (!start) start = now
      const t = Math.min(1, (now - start) / duration)
      const next = t === 1 ? parsed : from + delta * easeOutCubic(t)
      valueRef.current = next
      setValue(next)
      if (t < 1) rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, parsed, numeric, duration, shouldAnimate])

  if (!shouldAnimate || !numeric) return target
  return value
}

export default useCountUp
