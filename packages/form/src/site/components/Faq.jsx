import { useState } from 'react';
import './Faq.css';

// TODO: Figma only has the first answer. The other three are neutral placeholders until real copy is supplied.
const FAQS = [
  {
    q: 'Do you only invest in sectors listed above?',
    a: 'No. We are sector-agnostic at heart. The categories above are where we have the deepest networks and the most conviction, but an exceptional founder anywhere will get a fair and fast look.',
  },
  {
    q: 'What stage do you typically invest at?',
    a: "We back founders who've moved past the idea stage, with a working product and early validation, and support them through to institutional round-readiness.",
  },
  {
    q: 'How long does a decision take?',
    a: 'Timelines depend on each opportunity. Submit your pitch below and we will keep you updated at every step.',
  },
  {
    q: 'How much does Middha Ventures invest?',
    a: 'Cheque sizes depend on the stage and needs of each business. Submit your pitch below and we will discuss specifics with you.',
  },
];

function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section className="faq" id="faq">
      <div className="faq__inner mv-container">
        <h2 className="section-title faq__title">Frequently Asked Questions</h2>
        <ul className="faq__list">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <li key={item.q} className="faq__item">
                <button
                  type="button"
                  className="faq__question"
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${i}`}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                >
                  <span>{item.q}</span>
                  <span className={`faq__icon ${isOpen ? 'faq__icon--open' : ''}`} aria-hidden="true" />
                </button>
                <div
                  id={`faq-answer-${i}`}
                  className={`faq__panel ${isOpen ? 'faq__panel--open' : ''}`}
                  aria-hidden={!isOpen}
                  inert={isOpen ? undefined : ''}
                >
                  <div className="faq__panel-inner">
                    <p className="faq__answer">{item.a}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export default Faq;
