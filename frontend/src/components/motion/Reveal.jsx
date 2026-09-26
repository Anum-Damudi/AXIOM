// AXIOM staggered entrance helpers. Purely presentational: they add a class
// and a delay index, and never change what the children render.
//
//   <RevealGroup as="ul" step="sm" className="grid gap-3">
//     <StaggerItem index={0} as="li">…</StaggerItem>
//   </RevealGroup>
//
// `step` sets the cadence for the whole group; the individual `index` values
// derive their delay from the shared --ax-stagger-step token so every reveal
// in the app follows the same rhythm.

const STEP_MS = { sm: 34, md: 55, lg: 80 }

export function RevealGroup({ as: Tag = 'div', step = 'md', className = '', style, children, ...rest }) {
  const stepMs = STEP_MS[step] ?? STEP_MS.md
  return (
    <Tag
      className={`ax-stagger ${className}`.trim()}
      style={{ '--ax-stagger-step': `${stepMs}ms`, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export function Reveal({ as: Tag = 'div', variant = '', index, className = '', style, children, ...rest }) {
  const classes = ['ax-reveal', variant ? `ax-reveal--${variant}` : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <Tag
      className={classes}
      style={index === undefined ? style : { ...style, '--ax-i': index }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export function StaggerItem({ as: Tag = 'div', index = 0, className = '', style, children, ...rest }) {
  return (
    <Tag
      className={`ax-stagger-item ${className}`.trim()}
      style={{ ...style, '--ax-i': index }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
