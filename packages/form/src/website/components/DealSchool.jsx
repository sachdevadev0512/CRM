import StaircaseArt from './StaircaseArt';
import './DealSchool.css';

export const APPLY_URL = 'https://dealschool.in/applynow';
export const PROGRAM_URL = 'https://dealschool.in/program';

// DealSchool fellowship section, ported from the DealSchool site's hero. The header's "Our Initiative" link points here.
function DealSchool() {
  return (
    <section className="dealschool" id="initiative">
      <div className="dealschool__visual">
        <StaircaseArt />
      </div>

      <div className="dealschool__inner container">
        <div className="dealschool__content">
          <h2 className="section-title dealschool__heading">An Initiative by Middha Ventures</h2>

          <h3 className="dealschool__title">
            Built for those who want a <span className="dealschool__accent">seat at the table</span>,{' '}
            <span className="dealschool__title-line">not a seat in the classroom.</span>
          </h3>

          <p className="dealschool__text">
            DealSchool is a 10-week, cohort-based VC fellowship built around the actual venture capital workflow.
            You&apos;ll observe live pitch calls, evaluate startups, practice due diligence, analyze investment
            opportunities, and see how experienced investors think before every investment decision. No case studies. No
            simulations. Just real venture capital.
          </p>

          <div className="dealschool__actions">
            <a href={APPLY_URL} className="dealschool__btn dealschool__btn--primary" target="_blank" rel="noopener noreferrer">
              Apply for Cohort 1
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
            <a href={PROGRAM_URL} className="dealschool__btn dealschool__btn--outline" target="_blank" rel="noopener noreferrer">
              See the Program
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default DealSchool;
