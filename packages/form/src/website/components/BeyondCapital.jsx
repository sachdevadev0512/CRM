import './BeyondCapital.css';

const PILLARS = [
  {
    icon: '/assets/figma/icon-strategic-guidance.svg',
    title: 'Strategic Guidance',
    text: 'Helping founders make better long-term decisions.',
  },
  {
    icon: '/assets/figma/icon-industry-network.svg',
    title: 'Industry Network',
    text: 'Access to investors, operators, partners, and advisors.',
  },
  {
    icon: '/assets/figma/icon-growth-support.svg',
    title: 'Growth Support',
    text: 'Hiring, scaling, partnerships, and business development.',
  },
  {
    icon: '/assets/figma/icon-governance.svg',
    title: 'Governance',
    text: 'Helping companies build institutional processes for long-term success.',
  },
];

function BeyondCapital() {
  return (
    <section className="beyond">
      <div className="beyond__inner container">
        <h2 className="section-title">Beyond Capital</h2>
        <ul className="beyond__grid">
          {PILLARS.map((pillar) => (
            <li key={pillar.title} className="beyond__card">
              <img src={pillar.icon} alt="" width="60" height="60" />
              <h3>{pillar.title}</h3>
              <p>{pillar.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default BeyondCapital;
