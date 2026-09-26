import { useCountUp } from '../../hooks/useCountUp'

const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/

// Renders a metric value with an optional count-up. Only plain numbers are
// animated; anything already formatted (strings, ranges, labels) is shown
// verbatim, so displayed data always matches the underlying value.
export default function AnimatedNumber({ value, duration = 900, format, className = '' }) {
  const raw = value === null || value === undefined ? '' : String(value).trim()

  if (!PLAIN_NUMBER.test(raw)) {
    return <span className={className}>{raw}</span>
  }

  return <AnimatedNumeric value={raw} duration={duration} format={format} className={className} />
}

function AnimatedNumeric({ value, duration, format, className }) {
  const target = Number(value)
  const display = useCountUp(target, { duration })
  const decimals = (value.split('.')[1] || '').length

  const text = format ? format(display) : display.toFixed(decimals)

  return <span className={className}>{text}</span>
}
