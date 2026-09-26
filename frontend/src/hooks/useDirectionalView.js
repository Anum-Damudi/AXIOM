import { useLayoutEffect, useRef, useState } from 'react'

// Derives a forward/back flavour by comparing the previous view's position in
// the navigation order. Lives in the unkeyed shell so the value survives the
// remount that the keyed page-transition host performs on every navigation.
// Runs as a layout effect so the direction class is in place on the very first
// paint — the entrance choreography never restarts mid-flight.
// Purely cosmetic — it never gates what renders.
export default function useDirectionalView(viewKey, order = []) {
  const previousRef = useRef(null)
  const [direction, setDirection] = useState('')

  useLayoutEffect(() => {
    const previous = previousRef.current
    if (previous !== null && previous !== viewKey && order.length > 1) {
      const from = order.indexOf(previous)
      const to = order.indexOf(viewKey)
      if (from !== -1 && to !== -1) {
        const next = to > from ? 'forward' : 'back'
        setDirection((current) => (current === next ? current : next))
      }
    }
    previousRef.current = viewKey
  }, [viewKey, order])

  return direction
}
