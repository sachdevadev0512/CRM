import { useEffect, useState } from 'react';
import './Hero.css';

const SLIDE_MS = 3500;

// Founder showcase slides, exported from Figma (bars, photo and logo pre-composed; the glass cards are
// stripped out) and aligned to one 765×608 frame so the bars stay put between slides.
const FOUNDERS = [
  { name: 'Sai Surya', role: 'COO & Co-Founder', company: 'Ruskle', slide: '/assets/figma/hero-slide-sai-surya.svg' },
  { name: 'Deepti Gupta', role: 'Co-Founder & CEO', company: 'Fitreak', slide: '/assets/figma/hero-slide-deepti-gupta.svg' },
  {
    name: 'Vivas Nandhakumar',
    role: 'CMO & Co-Founder',
    company: 'Ruskle',
    slide: '/assets/figma/hero-slide-vivas-nandhakumar.svg',
  },
  { name: 'Arth Gupta', role: 'COO & Co-Founder', company: 'Fitreak', slide: '/assets/figma/hero-slide-arth-gupta.svg' },
  { name: 'Chetan Vohra', role: 'Founder & CEO', company: 'Cordiform', slide: '/assets/figma/hero-slide-chetan-vohra.svg' },
];

function Hero() {
  const [active, setActive] = useState(0);
  const [announce, setAnnounce] = useState(false);

  // Always running: a fresh timeout per slide, so a click restarts the countdown and nothing can leave it paused.
  useEffect(() => {
    const timer = setTimeout(() => setActive((i) => (i + 1) % FOUNDERS.length), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [active]);

  const goTo = (i) => {
    setActive(i);
    setAnnounce(true);
  };

  const current = FOUNDERS[active];

  return (
    <section className="hero">
      <div className="hero__inner mv-container">
        <div className="hero__content">
          <h1 className="hero__title">
            <span className="hero__title-soft">Backing ambitious founders</span> building enduring businesses.
          </h1>
          <p className="hero__subtitle">
            Middha Ventures invests across industries and stages, partnering with founders with long-term vision. We
            provide strategic capital, operational support, and access to an extensive network to help companies scale
            sustainably.
          </p>
          <div className="hero__actions">
            <a href="/#pitch" className="btn btn--primary">
              Pitch Your Startup
            </a>
            <a href="/#about" className="btn btn--outline">
              Learn More
            </a>
          </div>
        </div>

        <section className="showcase" aria-roledescription="carousel" aria-label="Founders we back">
          <div className="showcase__stage">
            {FOUNDERS.map((f, i) => (
              <img
                key={f.name}
                className={`showcase__slide ${i === active ? 'is-active' : ''}`}
                src={f.slide}
                alt={i === active ? `${f.name}, ${f.role} at ${f.company}` : ''}
                aria-hidden={i !== active}
              />
            ))}
          </div>

          <div className="showcase__footer">
            <div className="showcase__caption" aria-live={announce ? 'polite' : 'off'}>
              <p key={current.name} className="showcase__name">
                {current.name}
              </p>
              <p key={`${current.name}-role`} className="showcase__role">
                {current.role} <span aria-hidden="true">·</span> {current.company}
              </p>
            </div>

            <div className="showcase__progress">
              {FOUNDERS.map((f, i) => (
                <button
                  key={`${f.name}-dot`}
                  type="button"
                  className={`showcase__segment ${i === active ? 'is-active' : ''} ${i < active ? 'is-done' : ''}`}
                  aria-label={`Show ${f.name}`}
                  aria-current={i === active}
                  onClick={() => goTo(i)}
                  style={{ '--slide-ms': `${SLIDE_MS}ms` }}
                >
                  <span key={i === active ? `run-${active}` : 'idle'} className="showcase__segment-fill" />
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

export default Hero;
