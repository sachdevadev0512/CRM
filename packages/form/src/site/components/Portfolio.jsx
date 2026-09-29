import './Portfolio.css';

// Positions come from Figma: each photo and logo is placed relative to a 424×424 card (x, y, width in px).
// Cards alternate between raised and lowered by 86px.
const CARD = 424;
const COMPANIES = [
  {
    name: 'Sai Surya',
    role: 'COO & Co-Founder',
    photo: { src: '/assets/figma/portfolio-sai-surya.jpg', x: 0, y: 0, w: 448 },
    logo: { src: '/assets/figma/logo-44.png', x: 338, y: 28, w: 64 },
  },
  {
    name: 'Deepti Gupta',
    role: 'Co-founder & CEO',
    photo: { src: '/assets/figma/founder-deepti-gupta.png', x: -82, y: -53, w: 506 },
    logo: { src: '/assets/figma/logo-fitrek.png', x: 262, y: 24, w: 140 },
  },
  {
    name: 'Vivas Nandhakumar',
    role: 'CMO & Co-founder',
    photo: { src: '/assets/figma/portfolio-vivas-nandhakumar.png', x: -50, y: -95, w: 525 },
    logo: { src: '/assets/figma/logo-44.png', x: 339, y: 30, w: 64 },
  },
  {
    name: 'Arth Gupta',
    role: 'Co-founder & COO',
    photo: { src: '/assets/figma/founder-arth-gupta.png', x: -181.5, y: -202, w: 949, rotate: 7.78 },
    logo: { src: '/assets/figma/logo-fitrek.png', x: 262, y: 24, w: 140 },
  },
  {
    name: 'Chetan Vohra',
    role: 'Founder & CEO',
    photo: { src: '/assets/figma/portfolio-chetan-vohra.jpg', x: -49, y: 0, w: 546 },
    logo: { src: '/assets/figma/logo-cordiform.png', x: 258, y: 29, w: 137 },
  },
];

const pct = (px) => `${(px / CARD) * 100}%`;
const place = ({ x, y, w, rotate }) => ({
  left: pct(x),
  top: pct(y),
  width: pct(w),
  ...(rotate && { transform: `rotate(${rotate}deg)`, transformOrigin: 'top left' }),
});

// The marquee track is two identical halves, so sliding it by -50% loops seamlessly. Each half holds
// the list twice: 5 is odd, and an even half keeps the raised/lowered rhythm unbroken at the seam.
const LOOP = [...COMPANIES, ...COMPANIES];
const TRACK = [...LOOP, ...LOOP];

function Portfolio() {
  return (
    <section className="portfolio" id="portfolio">
      <div className="mv-container">
        <h2 className="section-title">Our Portfolio</h2>
      </div>
      <div className="portfolio__viewport">
        <ul className="portfolio__track">
          {TRACK.map((c, i) => (
            <li
              key={`${c.name}-${i}`}
              className={`portfolio__card ${i % 2 ? 'portfolio__card--low' : ''}`}
              aria-hidden={i >= COMPANIES.length || undefined}
            >
              <img className="portfolio__photo" src={c.photo.src} alt="" style={place(c.photo)} />
              <img className="portfolio__logo" src={c.logo.src} alt="" style={place(c.logo)} />
              <div className="portfolio__caption">
                <h3>{c.name}</h3>
                <p>{c.role}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default Portfolio;
