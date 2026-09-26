// Views whose workspace deserves the longer, deeper reveal.
const DEEP_VIEWS = new Set(['network', 'map', 'analytics', 'ledger'])

// Direction-aware page transition host (Level 3 / system motion).
//
// `key` is supplied by the caller so React remounts the subtree on every
// navigation and the entrance choreography replays. `direction` is computed by
// `useDirectionalView` in the unkeyed shell.
export default function PageTransition({ viewKey, direction = '', className = '', children }) {
  const classes = [
    'ax-page-transition',
    direction ? `ax-page-transition--${direction}` : '',
    DEEP_VIEWS.has(viewKey) ? 'ax-page-transition--deep' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return <div className={classes}>{children}</div>
}
