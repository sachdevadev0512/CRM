import { useState } from 'react';
import './Navbar.css';

// "Insights" is in the Figma nav but this design has no Insights section yet, so it is left out.
const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/#about', label: 'About' },
  { href: '/#sectors', label: 'Sectors' },
  { href: '/#portfolio', label: 'Portfolio' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#team', label: 'Team' },
  { href: '/#initiative', label: 'Our Initiative' },
  { href: '/#faq', label: 'FAQs' },
];

// The header CTA opens the full multi-step application form.
const APPLY_URL = '/applynow';

function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="navbar">
      <div className="navbar__inner container">
        <a href="/" className="navbar__brand" aria-label="Middha Ventures home">
          <img src="/assets/figma/logo.svg" alt="Middha Ventures" width="167" height="36" />
        </a>

        <button
          type="button"
          className={`navbar__toggle ${open ? 'navbar__toggle--open' : ''}`}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="navbar-links"
          onClick={() => setOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav id="navbar-links" className={`navbar__links ${open ? 'navbar__links--open' : ''}`}>
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
          <a href={APPLY_URL} className="btn btn--primary navbar__cta" onClick={() => setOpen(false)}>
            Pitch to Us
            <svg className="navbar__cta-icon" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
              <path d="M4 10 H15 M10.5 5.5 L15 10 L10.5 14.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
