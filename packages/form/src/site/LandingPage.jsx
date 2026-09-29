import './tokens.css';
import './App.css';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import About from './components/About';
import Sectors from './components/Sectors';
import BeyondCapital from './components/BeyondCapital';
import Portfolio from './components/Portfolio';
import HowWeWork from './components/HowWeWork';
import Team from './components/Team';
import Faq from './components/Faq';
import Pitch from './components/Pitch';
import Footer from './components/Footer';

function LandingPage() {
  return (
    <div className="app">
      <Navbar />
      <main className="app__main">
        <Hero />
        <About />
        <Sectors />
        <BeyondCapital />
        <Portfolio />
        <HowWeWork />
        <Team />
        <Faq />
        <Pitch />
      </main>
      <Footer />
    </div>
  );
}

export default LandingPage;
