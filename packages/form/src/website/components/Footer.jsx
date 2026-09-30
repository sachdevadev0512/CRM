import './Footer.css';

// "Insights" is in the Figma footer but has no section yet, so it is left out.
const COMPANY = [
  { href: '/#about', label: 'About Us' },
  { href: '/#portfolio', label: 'Portfolio' },
  { href: '/#team', label: 'Team' },
];

const RESOURCES = [
  { href: '/#faq', label: 'FAQ' },
  { href: '/applynow', label: 'Pitch to Us' },
];

const SOCIALS = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/middha-ventures/', icon: '/assets/figma/social-linkedin.svg' },
  { label: 'Instagram', href: 'https://www.instagram.com/middhaventures/', icon: '/assets/figma/social-instagram.svg' },
];

function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer__inner container">
        <div className="footer__top">
          <div className="footer__brand">
            <a href="/" aria-label="Middha Ventures home">
              <img src="/assets/figma/logo.svg" alt="Middha Ventures" width="167" height="36" />
            </a>
            <p className="footer__tagline">Backing ambitious founders building enduring businesses.</p>
            <ul className="footer__socials">
              {SOCIALS.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={`Middha Ventures on ${s.label}`}>
                    <img src={s.icon} alt="" width="40" height="40" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer__columns">
            <nav className="footer__col" aria-label="Company">
              <h2 className="footer__heading">Company</h2>
              {COMPANY.map((l) => (
                <a key={l.label} href={l.href}>
                  {l.label}
                </a>
              ))}
            </nav>

            <nav className="footer__col" aria-label="Resources">
              <h2 className="footer__heading">Resources</h2>
              {RESOURCES.map((l) => (
                <a key={l.label} href={l.href}>
                  {l.label}
                </a>
              ))}
            </nav>

            <div className="footer__col footer__col--contact">
              <h2 className="footer__heading footer__heading--system">Contact Information</h2>
              <span className="footer__contact-item">
                <img src="/assets/figma/icon-location.svg" alt="" width="24" height="24" />
                Vashi, Maharashtra
              </span>
              <a className="footer__contact-item" href="mailto:chirag@middhaventures.com">
                <img src="/assets/figma/icon-mail.svg" alt="" width="24" height="24" />
                chirag@middhaventures.com
              </a>
            </div>
          </div>
        </div>

        <div className="footer__bottom">
          <p>© {year} Middha Ventures. All rights reserved.</p>
          {/* TODO: link these once the pages exist */}
          <div className="footer__legal">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
