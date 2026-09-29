import ApplyNow from '../ApplyNow';
import './Pitch.css';

function Pitch() {
  return (
    <section className="pitch dark-panel" id="pitch">
      <div className="pitch__inner mv-container">
        <div className="pitch__intro">
          <div className="pitch__header">
            <h2 className="section-title section-title--light">Pitch to Us</h2>
            <p>
              We are sector agnostic and evaluate opportunities based on the quality of founders and business potential.
            </p>
          </div>
          <img
            className="pitch__image"
            src="/assets/figma/pitch-event.jpg"
            alt="A founder pitching on stage to a panel of Middha Ventures investors"
            width="1080"
            height="887"
            loading="lazy"
          />
        </div>

        <div className="pitch__form">
          <ApplyNow />
        </div>
      </div>
    </section>
  );
}

export default Pitch;
