import './Sectors.css';

// Two balanced rows (4 + 3) on wider screens; on phones every chip wraps together.
const SECTOR_ROWS = [
  ['Technology & SaaS', 'Healthcare', 'FinTech', 'Consumer Brands'],
  ['Manufacturing', 'Logistics & Supply Chain', 'Enterprise Solutions'],
];

// Flat list of the sectors we invest in.
export const SECTORS = SECTOR_ROWS.flat();

function Sectors() {
  return (
    <section className="sectors dark-panel" id="sectors">
      <div className="sectors__inner container">
        <div className="sectors__header">
          <h2 className="section-title section-title--light">Investment Sectors</h2>
          <p>Middha Ventures is sector agnostic but actively explores opportunities across industries.</p>
        </div>
        <div className="sectors__rows">
          {SECTOR_ROWS.map((row, i) => (
            <ul key={i} className="sectors__row">
              {row.map((sector) => (
                <li key={sector} className="sectors__chip">
                  {sector}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Sectors;
