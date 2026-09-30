import { useEffect, useRef, useState } from 'react';
import useReducedMotion from '../hooks/useReducedMotion';
import { SCENES } from './HowWeWorkScenes';
import './HowWeWork.css';

const STEP_MS = 4500;

const STEPS = [
  { title: 'Fill the form', text: 'Understand the business, founders, and vision.' },
  {
    title: 'Pitch Call if and when shortlisted in the screening process',
    text: 'Review market opportunity, business fundamentals, traction, and team.',
  },
  { title: 'Call with the Partner', text: 'Conduct due diligence and finalize investment terms.' },
  { title: 'Due Diligence if and when shortlisted', text: 'Work alongside founders to build enduring businesses.' },
  { title: 'Term Sheet, SHA & Wire Transfer', text: 'Work alongside founders to build enduring businesses.' },
];

function HowWeWork() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion();
  const body = useRef(null);
  const autoplay = !paused && !reducedMotion;

  // Walk through the steps on a timer; restarting on `active` gives a manual pick a full interval.
  useEffect(() => {
    if (!autoplay) return undefined;
    const timer = setInterval(() => {
      if (!document.hidden) setActive((i) => (i + 1) % STEPS.length);
    }, STEP_MS);
    return () => clearInterval(timer);
  }, [autoplay, active]);

  return (
    <section
      className={`how dark-panel ${autoplay ? 'how--playing' : ''}`}
      id="how-it-works"
      style={{ '--how-step-ms': `${STEP_MS}ms` }}
    >
      <div className="how__inner">
        <h2 className="section-title section-title--light">How We Work</h2>
        <div
          ref={body}
          className="how__body"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={(e) => {
            if (!body.current.contains(e.relatedTarget)) setPaused(false);
          }}
        >
          <div className="how__visual" aria-hidden="true">
            <div className="how__stage">
              {SCENES.map(({ name, Art }, i) => (
                <svg
                  key={name}
                  className={`how__scene ${i === active ? 'how__scene--active' : ''}`}
                  viewBox="0 0 400 320"
                  fill="none"
                >
                  <Art />
                </svg>
              ))}
            </div>
            <div className="how__caption">
              <div>
                <span key={active} className="how__caption-title">
                  {SCENES[active].name}
                </span>
              </div>
              <div className="how__dots">
                {STEPS.map((step, i) => (
                  <span key={step.title} className={i === active ? 'is-active' : ''} />
                ))}
              </div>
            </div>
          </div>
          <ol className="how__steps">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className={`how__step ${i === active ? 'how__step--active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                tabIndex={0}
              >
                <span className="how__label">Step {i + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export default HowWeWork;
