import './Team.css';

// "photo" cards are the new Option2 (121:280) portraits, shown full-bleed.
// "cutout" cards are the cut-out portraits from Option2 (104:27), on a white card; their photo placement is
// relative to a 397×558 card (x, y, width in px).
const CARD_W = 397.333;
const CARD_H = 558;
const MEMBERS = [
  {
    id: 'abhishek',
    variant: 'cutout',
    name: 'Abhishek Middha',
    role: 'Founding Partner',
    photo: { src: '/assets/figma/team-abhishek-middha.png', x: -81.3, y: -81, w: 507 },
  },
  {
    id: 'chirag',
    variant: 'cutout',
    name: 'Chirag Thakker',
    role: 'Managing Partner',
    photo: { src: '/assets/figma/team-chirag-thakker.png', x: -92, y: -52, w: 556 },
  },
  { id: 'sujal', variant: 'photo', name: 'Sujal Shewale', role: 'Investment Analyst', photo: { src: '/assets/figma/team-new-1.jpg' } },
  { id: 'ved', variant: 'photo', name: 'Ved Kulkarni', role: 'Investment Analyst', photo: { src: '/assets/figma/team-new-2.jpg' } },
];

const place = ({ x, y, w }) => ({
  left: `${(x / CARD_W) * 100}%`,
  top: `${(y / CARD_H) * 100}%`,
  width: `${(w / CARD_W) * 100}%`,
});

function Team() {
  return (
    <section className="team" id="team">
      <div className="team__inner container">
        <h2 className="section-title team__title">Meet the Team</h2>
        <ul className="team__grid">
          {MEMBERS.map((m) => (
            <li key={m.id} className={`team__card team__card--${m.variant}`}>
              <img
                className="team__photo"
                src={m.photo.src}
                alt={m.name}
                style={m.variant === 'cutout' ? place(m.photo) : undefined}
                loading="lazy"
              />
              <div className="team__caption">
                <h3>{m.name}</h3>
                <p>{m.role}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default Team;
