import './Portfolio.css';

// Logos live in public/assets/logos. A company without a `url` renders as a plain, unlinked card.
const COMPANIES = [
  { name: 'Ruskle', logo: '/assets/logos/ruskle.svg', w: 64, h: 64, url: 'https://www.ruskle.in/' },
  { name: 'Fitreak', logo: '/assets/logos/fitreak.svg', w: 140, h: 48, url: 'https://fitreak.com/' },
  { name: 'Cordiform', logo: '/assets/logos/cordiform.svg', w: 138, h: 32, url: 'https://sochu.in/' },
];

const domain = (url) => new URL(url).hostname.replace(/^www\./, '');

function ArrowIcon() {
  return (
    <svg className="portfolio__arrow" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <path d="M6 14 L14 6 M7 6 H14 V13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CardBody({ company }) {
  return (
    <>
      <div className="portfolio__logo-wrap">
        <img
          className="portfolio__logo"
          src={company.logo}
          alt={`${company.name} logo`}
          width={company.w}
          height={company.h}
          style={{ '--logo-w': company.w }}
          loading="lazy"
        />
      </div>
      <div className="portfolio__meta">
        <div>
          <h3>{company.name}</h3>
          <p>{company.url ? domain(company.url) : 'Website coming soon'}</p>
        </div>
        {company.url && <ArrowIcon />}
      </div>
    </>
  );
}

function Portfolio() {
  return (
    <section className="portfolio" id="portfolio">
      <div className="portfolio__inner container">
        <h2 className="section-title">Our Portfolio</h2>
        <ul className="portfolio__grid">
          {COMPANIES.map((c) => (
            <li key={c.name}>
              {c.url ? (
                <a
                  className="portfolio__card portfolio__card--link"
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${c.name}: visit website (opens in a new tab)`}
                >
                  <CardBody company={c} />
                </a>
              ) : (
                <div className="portfolio__card">
                  <CardBody company={c} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default Portfolio;
