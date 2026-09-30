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
import DealSchool from './components/DealSchool';
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
        <DealSchool />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}

function NotFound() {
  return (
    <div className="app">
      <Navbar />
      <main className="app__main not-found container">
        <h1>Page not found</h1>
        <p>The page you're looking for doesn't exist.</p>
        <a href="/" className="not-found__link">
          Back to home
        </a>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  const pathname = window.location.pathname;

  if (pathname === '/') return <LandingPage />;
  return <NotFound />;
}

export default App;
