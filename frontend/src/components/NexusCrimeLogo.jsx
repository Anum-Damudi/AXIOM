export default function NexusCrimeLogo({ size = 40, className = '' }) {
  return (
    <img
      src="/nexus-crime-logo.png"
      alt="NEXUS-CRIME logo"
      className={`nexus-crime-logo ${className}`.trim()}
      width={size}
      height={size}
      draggable="false"
    />
  )
}
