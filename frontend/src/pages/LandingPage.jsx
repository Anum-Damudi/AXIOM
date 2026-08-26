import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { CASES, SUSPECTS } from '../data/mockData'
import NexusCrimeLogo from '../components/NexusCrimeLogo'

function HeroNetworkCanvas() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId
    let w, h
    const nodes = []

    const resize = () => {
      w = canvas.width = canvas.offsetWidth * 2
      h = canvas.height = canvas.offsetHeight * 2
      ctx.scale(1, 1)
    }
    resize()
    window.addEventListener('resize', resize)

    for (let i = 0; i < 40; i++) {
      nodes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        r: Math.random() * 2.5 + 1.5,
      })
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      nodes.forEach((n) => {
        n.x += n.vx
        n.y += n.vy
        if (n.x < 0 || n.x > w) n.vx *= -1
        if (n.y < 0 || n.y > h) n.vy *= -1
      })

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 220) {
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.strokeStyle = `rgba(0,212,255,${0.12 * (1 - dist / 220)})`
            ctx.lineWidth = 1
            ctx.stroke()
          }
        }
      }

      nodes.forEach((n) => {
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,212,255,0.45)'
        ctx.fill()
      })

      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])
  return <canvas ref={canvasRef} className="landing-hero__canvas" aria-hidden="true" />
}

const CAPABILITIES = [
  { icon: 'network', title: 'Network Intelligence', desc: 'Visualize relationships between persons, organizations, vehicles, locations and other entities.' },
  { icon: 'globe', title: 'Geospatial Intelligence', desc: 'Analyze locations and geographic relationships associated with investigations.' },
  { icon: 'barChart', title: 'Case Analytics', desc: 'Identify patterns, trends, risk indicators and investigation metrics.' },
  { icon: 'file', title: 'Intelligence Reporting', desc: 'Generate structured investigation reports and export them for review.' },
  { icon: 'search', title: 'Evidence & Entity Analysis', desc: 'Organize important entities, evidence and findings into an investigator-friendly interface.' },
  { icon: 'shield', title: 'Risk Assessment', desc: 'Highlight high-risk entities and suspicious relationships across your investigations.' },
]

const STEPS = [
  { num: '01', title: 'Ingest', desc: 'Bring investigation information together from multiple sources.' },
  { num: '02', title: 'Connect', desc: 'Discover relationships between entities, evidence and events.' },
  { num: '03', title: 'Analyze', desc: 'Identify patterns, risks and hidden connections within the network.' },
  { num: '04', title: 'Act', desc: 'Generate intelligence reports and drive investigation outcomes.' },
]

const TRUST_ITEMS = [
  'Investigator-focused workflows',
  'Structured intelligence',
  'Relationship visualization',
  'Evidence-driven analysis',
  'Controlled access',
  'Audit-ready reporting',
]

const NAV_LINKS = [
  { label: 'Home', href: '#hero' },
  { label: 'Platform', href: '#capabilities' },
  { label: 'Capabilities', href: '#how-it-works' },
  { label: 'Intelligence', href: '#preview' },
  { label: 'About', href: '#why' },
]

export default function LandingPage() {
  const { navigateTo } = useApp()
  const [scrolled, setScrolled] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (href) => {
    setMobileNavOpen(false)
    const el = document.querySelector(href)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  const topCases = CASES.slice(0, 3)
  const riskCounts = { HIGH: 0, MEDIUM: 0, LOW: 0 }
  CASES.forEach((c) => { riskCounts[c.risk] = (riskCounts[c.risk] || 0) + 1 })

  return (
    <div className="landing">
      <header className={`landing-header ${scrolled ? 'landing-header--scrolled' : ''}`}>
        <div className="landing-header__inner">
          <button className="landing-brand" onClick={() => scrollTo('#hero')} type="button">
            <NexusCrimeLogo size={32} className="landing-brand__logo-component" />
            <span className="landing-brand__name">NEXUS-CRIME</span>
          </button>

          <nav className={`landing-nav ${mobileNavOpen ? 'landing-nav--open' : ''}`}>
            {NAV_LINKS.map((l) => (
              <button key={l.label} className="landing-nav__link" onClick={() => scrollTo(l.href)} type="button">
                {l.label}
              </button>
            ))}
            <button className="landing-nav__cta" onClick={() => navigateTo('login')} type="button">
              Sign In
            </button>
          </nav>

          <button
            className="landing-hamburger"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            type="button"
            aria-label="Toggle navigation"
          >
            <span /><span /><span />
          </button>
        </div>
      </header>

      <section id="hero" className="landing-hero">
        <HeroNetworkCanvas />
        <div className="landing-hero__content">
          <div className="landing-hero__badge">Criminal Network Intelligence Platform</div>
          <h1 className="landing-hero__title">
            <span className="landing-hero__title-line">NEXUS</span>
            <span className="landing-hero__title-accent">CRIME</span>
          </h1>
          <p className="landing-hero__tagline">
            Connect the evidence.<br />
            Reveal the network.<br />
            Drive the investigation.
          </p>
          <p className="landing-hero__desc">
            NEXUS-CRIME provides investigators with an integrated environment for network analysis,
            geographic intelligence, case analytics and intelligence report generation.
          </p>
          <div className="landing-hero__actions">
            <button className="landing-btn landing-btn--primary" onClick={() => navigateTo('login')} type="button">
              Enter Investigation Portal
            </button>
            <button className="landing-btn landing-btn--ghost" onClick={() => scrollTo('#capabilities')} type="button">
              Explore Platform
            </button>
          </div>
        </div>
        <div className="landing-hero__grid-overlay" aria-hidden="true" />
      </section>

      <section id="capabilities" className="landing-section">
        <div className="landing-section__inner">
          <div className="landing-section__header">
            <span className="landing-section__label">Platform Capabilities</span>
            <h2 className="landing-section__title">Intelligence-Grade Investigation Tools</h2>
            <p className="landing-section__desc">
              A comprehensive suite of analytical modules designed for professional criminal intelligence work.
            </p>
          </div>
          <div className="landing-capabilities">
            {CAPABILITIES.map((c) => (
              <div key={c.title} className="landing-cap-card">
                <div className="landing-cap-card__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    {c.icon === 'network' && <><circle cx="12" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" /><path d="M12 7v4M8.5 17.5L10.5 13M15.5 17.5L13.5 13" /></>}
                    {c.icon === 'globe' && <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></>}
                    {c.icon === 'barChart' && <path d="M12 20V10M18 20V4M6 20v-4" />}
                    {c.icon === 'file' && <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" /><path d="M14 2v6h6" /></>}
                    {c.icon === 'search' && <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3-3" /></>}
                    {c.icon === 'shield' && <path d="M12 3l8 4v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" />}
                  </svg>
                </div>
                <h3 className="landing-cap-card__title">{c.title}</h3>
                <p className="landing-cap-card__desc">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="landing-section landing-section--alt">
        <div className="landing-section__inner">
          <div className="landing-section__header">
            <span className="landing-section__label">Workflow</span>
            <h2 className="landing-section__title">How It Works</h2>
          </div>
          <div className="landing-steps">
            {STEPS.map((s, i) => (
              <div key={s.num} className="landing-step">
                <div className="landing-step__num">{s.num}</div>
                <div className="landing-step__content">
                  <h3 className="landing-step__title">{s.title}</h3>
                  <p className="landing-step__desc">{s.desc}</p>
                </div>
                {i < STEPS.length - 1 && <div className="landing-step__connector" aria-hidden="true" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="preview" className="landing-section">
        <div className="landing-section__inner">
          <div className="landing-section__header">
            <span className="landing-section__label">Platform Preview</span>
            <h2 className="landing-section__title">Intelligence Dashboard</h2>
            <p className="landing-section__desc">A preview of the NEXUS-CRIME investigation environment.</p>
          </div>
          <div className="landing-preview">
            <div className="landing-preview__header">
              <div className="landing-preview__dots">
                <span /><span /><span />
              </div>
              <span className="landing-preview__title">NEXUS-CRIME Dashboard</span>
              <div className="landing-preview__actions">
                <span className="landing-preview__minimize" />
              </div>
            </div>
            <div className="landing-preview__body">
              <div className="landing-preview__kpis">
                <div className="landing-preview__kpi">
                  <span className="landing-preview__kpi-label">Active Cases</span>
                  <span className="landing-preview__kpi-value">{CASES.length}</span>
                </div>
                <div className="landing-preview__kpi">
                  <span className="landing-preview__kpi-label">Network Nodes</span>
                  <span className="landing-preview__kpi-value">{SUSPECTS.length * 3}</span>
                </div>
                <div className="landing-preview__kpi landing-preview__kpi--red">
                  <span className="landing-preview__kpi-label">High Risk</span>
                  <span className="landing-preview__kpi-value">{riskCounts.HIGH || 0}</span>
                </div>
                <div className="landing-preview__kpi">
                  <span className="landing-preview__kpi-label">Connections</span>
                  <span className="landing-preview__kpi-value">127</span>
                </div>
              </div>
              <div className="landing-preview__grid">
                <div className="landing-preview__graph">
                  <svg viewBox="0 0 400 200" className="landing-preview__graph-svg">
                    <line x1="60" y1="80" x2="160" y2="40" stroke="var(--accent)" strokeWidth="1.5" opacity="0.5" />
                    <line x1="160" y1="40" x2="280" y2="70" stroke="var(--accent)" strokeWidth="1.5" opacity="0.5" />
                    <line x1="160" y1="40" x2="200" y2="150" stroke="var(--accent)" strokeWidth="1.5" opacity="0.5" />
                    <line x1="280" y1="70" x2="340" y2="140" stroke="var(--accent)" strokeWidth="1.5" opacity="0.4" />
                    <line x1="200" y1="150" x2="340" y2="140" stroke="var(--accent)" strokeWidth="1.5" opacity="0.4" />
                    <line x1="60" y1="80" x2="200" y2="150" stroke="var(--accent)" strokeWidth="1" opacity="0.3" />
                    <line x1="340" y1="140" x2="60" y2="80" stroke="var(--accent)" strokeWidth="1" opacity="0.2" />
                    <circle cx="60" cy="80" r="8" fill="var(--accent)" opacity="0.8" />
                    <circle cx="160" cy="40" r="10" fill="var(--danger)" opacity="0.8" />
                    <circle cx="280" cy="70" r="7" fill="var(--accent)" opacity="0.7" />
                    <circle cx="200" cy="150" r="9" fill="var(--warning)" opacity="0.7" />
                    <circle cx="340" cy="140" r="6" fill="var(--accent)" opacity="0.6" />
                    <text x="60" y="60" fill="var(--text-secondary)" fontSize="8" textAnchor="middle">Alpha</text>
                    <text x="160" y="25" fill="var(--text-secondary)" fontSize="8" textAnchor="middle">Beta</text>
                    <text x="280" y="55" fill="var(--text-secondary)" fontSize="8" textAnchor="middle">Gamma</text>
                    <text x="200" y="172" fill="var(--text-secondary)" fontSize="8" textAnchor="middle">Delta</text>
                    <text x="340" y="162" fill="var(--text-secondary)" fontSize="8" textAnchor="middle">Echo</text>
                  </svg>
                </div>
                <div className="landing-preview__cases">
                  <h4 className="landing-preview__cases-title">Active Cases</h4>
                  {topCases.map((c) => (
                    <div key={c.id} className="landing-preview__case">
                      <span className="landing-preview__case-title">{c.title}</span>
                      <span className={`landing-preview__case-risk landing-preview__case-risk--${c.risk.toLowerCase()}`}>{c.risk}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="why" className="landing-section landing-section--alt">
        <div className="landing-section__inner">
          <div className="landing-section__header">
            <span className="landing-section__label">Why NEXUS-CRIME</span>
            <h2 className="landing-section__title">From Data to Action</h2>
          </div>
          <div className="landing-flow">
            <div className="landing-flow__item">
              <div className="landing-flow__icon">01</div>
              <h3>Data</h3>
              <p>Collect and organize information from multiple investigation sources.</p>
            </div>
            <div className="landing-flow__arrow" aria-hidden="true">&rarr;</div>
            <div className="landing-flow__item">
              <div className="landing-flow__icon">02</div>
              <h3>Connections</h3>
              <p>Discover hidden relationships and map entity networks.</p>
            </div>
            <div className="landing-flow__arrow" aria-hidden="true">&rarr;</div>
            <div className="landing-flow__item">
              <div className="landing-flow__icon">03</div>
              <h3>Intelligence</h3>
              <p>Analyze patterns and generate actionable intelligence.</p>
            </div>
            <div className="landing-flow__arrow" aria-hidden="true">&rarr;</div>
            <div className="landing-flow__item">
              <div className="landing-flow__icon">04</div>
              <h3>Action</h3>
              <p>Drive investigation outcomes with evidence-based decisions.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-trust">
        <div className="landing-section__inner">
          <div className="landing-section__header">
            <span className="landing-section__label">Security & Trust</span>
            <h2 className="landing-section__title">Built for Professional Investigation</h2>
          </div>
          <div className="landing-trust__grid">
            {TRUST_ITEMS.map((item) => (
              <div key={item} className="landing-trust__item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="landing-trust__check">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-cta">
        <div className="landing-section__inner landing-cta__inner">
          <h2 className="landing-cta__title">Ready to Investigate the Network?</h2>
          <p className="landing-cta__desc">Enter the NEXUS-CRIME investigation environment.</p>
          <button className="landing-btn landing-btn--primary landing-btn--lg" onClick={() => navigateTo('login')} type="button">
            Enter Investigation Portal
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer__inner">
          <div className="landing-footer__top">
              <div className="landing-footer__brand">
              <NexusCrimeLogo size={32} className="landing-brand__logo-component" />
              <div>
                <div className="landing-footer__brand-name">NEXUS-CRIME</div>
                <p className="landing-footer__brand-desc">Criminal Network Intelligence &amp; Investigation Platform</p>
              </div>
            </div>
            <div className="landing-footer__links">
              <div className="landing-footer__col">
                <h4>Navigation</h4>
                {NAV_LINKS.map((l) => (
                  <button key={l.label} className="landing-footer__link" onClick={() => scrollTo(l.href)} type="button">{l.label}</button>
                ))}
                <button className="landing-footer__link" onClick={() => navigateTo('login')} type="button">Sign In</button>
              </div>
              <div className="landing-footer__col">
                <h4>Platform</h4>
                <span className="landing-footer__link">Network Intelligence</span>
                <span className="landing-footer__link">Geospatial Intelligence</span>
                <span className="landing-footer__link">Case Analytics</span>
                <span className="landing-footer__link">Report Generation</span>
              </div>
            </div>
          </div>
          <div className="landing-footer__bottom">
            <span>&copy; 2026 NEXUS-CRIME</span>
            <span>Investigation Intelligence Platform</span>
            <span>Confidential Investigation Environment</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
