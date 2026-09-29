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
  { href: '/#faq', label: 'FAQs' },
];

function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="navbar">
      <div className="navbar__inner mv-container">
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
          <a href="/#pitch" className="btn btn--primary navbar__cta" onClick={() => setOpen(false)}>
            Contact Us
          </a>
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
