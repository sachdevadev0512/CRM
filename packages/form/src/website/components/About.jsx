import { useEffect, useRef, useState } from 'react';
import './About.css';

// Chart geometry lives in a 560×280 box; HTML labels are placed with the same coordinates as percentages.
const W = 560;
const H = 280;
const BASELINE = 236;
const GAP = { from: 200, to: 420 };
const CURVE = 'M24 222 C 90 234, 140 236, 200 212 S 360 150, 420 112 S 510 50, 540 28';

const STAGES = [
  { label: 'Idea', x: 60 },
  { label: 'MVP', x: GAP.from },
  { label: 'Traction', x: 310 },
  { label: 'Series A', x: GAP.to },
  { label: 'Scale', x: 520 },
];

const MARKERS = [
  { label: 'First cheque', x: GAP.from, y: 212 },
  { label: 'Round-ready', x: GAP.to, y: 112 },
];

const PILLARS = [
  { value: 'Post-MVP', label: 'First meaningful cheque' },
  { value: 'Hands-on', label: 'Operator-led execution' },
  { value: 'Agnostic', label: 'Capital-efficient sectors' },
];

const pct = (v, total) => `${(v / total) * 100}%`;

function About() {
  const card = useRef(null);
  const [visible, setVisible] = useState(false);

  // Draw the curve once the card scrolls into view; show it immediately where observers are unavailable.
  useEffect(() => {
    if (!('IntersectionObserver' in window)) {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    observer.observe(card.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="about" id="about">
      <img className="about__decor" src="/assets/figma/about-decor.svg" alt="" aria-hidden="true" />
      <div className="about__inner container">
        <div className="about__text">
          <h2 className="section-title about__title">WHO WE ARE</h2>
          <p>
            We back founders who've moved past the idea stage, with a working product and early validation. We invest
            in the gap between post-MVP traction and an institutional round-readiness, providing the first meaningful
            cheque and hands-on execution support to get startups there.
            <br />
            Sector-agnostic, we focus on capital-efficient businesses where disciplined execution drives long-term
            value. As operators ourselves, we don't just write cheques, we roll up our sleeves when founders need us.
          </p>
        </div>

        <figure ref={card} className={`about__card dark-panel ${visible ? 'about__card--visible' : ''}`}>
          <figcaption className="about__eyebrow">Where we invest</figcaption>

          <div
            className="about__chart"
            role="img"
            aria-label="Growth curve from idea to scale; Middha Ventures invests in the gap between MVP and Series A readiness"
          >
            <svg viewBox={`0 0 ${W} ${H}`} fill="none" aria-hidden="true">
              <defs>
                <linearGradient id="about-gap-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#65a4c5" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#65a4c5" stopOpacity="0.02" />
                </linearGradient>
                <clipPath id="about-gap-clip">
                  <rect x={GAP.from} y="0" width={GAP.to - GAP.from} height={H} />
                </clipPath>
              </defs>

              <rect
                className="about__gap"
                x={GAP.from}
                y="12"
                width={GAP.to - GAP.from}
                height={BASELINE - 12}
                fill="url(#about-gap-fill)"
              />
              <line className="about__gap-edge" x1={GAP.from} y1="12" x2={GAP.from} y2={BASELINE} />
              <line className="about__gap-edge" x1={GAP.to} y1="12" x2={GAP.to} y2={BASELINE} />

              <line className="about__axis" x1="24" y1={BASELINE} x2="540" y2={BASELINE} />
              {STAGES.map(({ label, x }) => (
                <line key={label} className="about__tick" x1={x} y1={BASELINE - 4} x2={x} y2={BASELINE + 4} />
              ))}

              <g className="about__reveal">
                <path className="about__curve" d={CURVE} />
                <path className="about__curve about__curve--gap" d={CURVE} clipPath="url(#about-gap-clip)" />
              </g>

              {MARKERS.map(({ label, x, y }, i) => (
                <g key={label} className="about__marker" style={{ '--about-delay': `${0.7 + i * 0.5}s` }}>
                  <circle cx={x} cy={y} r="11" className="about__marker-halo" />
                  <circle cx={x} cy={y} r="5" className="about__marker-dot" />
                </g>
              ))}
            </svg>

            <span className="about__gap-label" style={{ left: pct((GAP.from + GAP.to) / 2, W), top: pct(12, H) }}>
              The gap we fill
            </span>
            {MARKERS.map(({ label, x, y }, i) => (
              <span
                key={label}
                className="about__marker-label"
                style={{ left: pct(x, W), top: pct(y, H), '--about-delay': `${0.7 + i * 0.5}s` }}
              >
                {label}
              </span>
            ))}
            {STAGES.map(({ label, x }) => (
              <span
                key={label}
                className={`about__stage ${x >= GAP.from && x <= GAP.to ? 'about__stage--gap' : ''}`}
                style={{ left: pct(x, W), top: pct(BASELINE, H) }}
              >
                {label}
              </span>
            ))}
          </div>

          <dl className="about__pillars">
            {PILLARS.map(({ value, label }) => (
              <div key={value} className="about__pillar">
                <dt>{value}</dt>
                <dd>{label}</dd>
              </div>
            ))}
          </dl>
        </figure>
      </div>
    </section>
  );
}

export default About;
