// Ported from DealSchool's StaircaseIllustration: an isometric staircase leading to a lit boardroom table,
// with a gold investment line drawn up the steps. The motion library's float and path-draw are CSS here (DealSchool.css).
function StaircaseArt() {
  return (
    <div className="dealschool__art" aria-hidden="true">
      <svg viewBox="0 0 800 500" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Background engineering grid */}
        <g stroke="#0D3B8E" strokeOpacity="0.08" strokeWidth="1">
          <line x1="50" y1="250" x2="750" y2="250" />
          <line x1="100" y1="50" x2="100" y2="450" />
          <line x1="250" y1="50" x2="250" y2="410" />
          <line x1="400" y1="50" x2="400" y2="450" />
          <line x1="550" y1="50" x2="550" y2="450" />
          <line x1="50" y1="150" x2="750" y2="380" strokeDasharray="4 4" />
          <line x1="50" y1="350" x2="750" y2="120" strokeDasharray="4 4" />
        </g>

        {/* Boardroom table, lit from within */}
        <g transform="translate(420, -45)">
          <polygon points="0,150 160,80 320,150 160,220" fill="#0D3B8E" fillOpacity="0.04" />
          <line x1="40" y1="170" x2="40" y2="230" stroke="#0D3B8E" strokeWidth="6" strokeLinecap="round" />
          <line x1="280" y1="170" x2="280" y2="230" stroke="#0D3B8E" strokeWidth="6" strokeLinecap="round" />
          <line x1="160" y1="200" x2="160" y2="250" stroke="#0D3B8E" strokeOpacity="0.3" strokeWidth="4" />
          <polygon points="10,140 160,70 310,140 160,210" fill="#082C6C" stroke="#0D3B8E" strokeWidth="2" />
          <polygon points="60,140 160,95 260,140 160,185" fill="#FFEAA7" fillOpacity="0.15" />
          <polygon points="90,140 160,110 230,140 160,170" fill="#FFF" stroke="#FFEAA7" strokeWidth="3" />
        </g>

        {/* Isometric staircase: front, top and side faces per step */}
        <g transform="translate(100, 220)" fill="#0D3B8E">
          <polygon points="50,220 120,220 120,250 50,250" fillOpacity="0.08" />
          <polygon points="50,220 120,220 160,195 90,195" fillOpacity="0.18" />
          <polygon points="120,220 160,195 160,225 120,250" fillOpacity="0.25" />

          <polygon points="90,170 160,170 160,200 90,200" fillOpacity="0.12" />
          <polygon points="90,170 160,170 200,145 130,145" fillOpacity="0.2" />
          <polygon points="160,170 200,145 200,175 160,200" fillOpacity="0.28" />

          <polygon points="130,120 200,120 200,150 130,150" fillOpacity="0.14" />
          <polygon points="130,120 200,120 240,95 170,95" fillOpacity="0.22" />
          <polygon points="200,120 240,95 240,125 200,150" fillOpacity="0.32" />

          <polygon points="170,70 240,70 240,100 170,100" fillOpacity="0.16" />
          <polygon points="170,70 240,70 280,45 210,45" fillOpacity="0.24" />
          <polygon points="240,70 280,45 280,75 240,100" fillOpacity="0.35" />

          <polygon points="210,20 280,20 280,50 210,50" fillOpacity="0.18" />
          <polygon points="210,20 280,20 320,0 250,0" fillOpacity="0.26" />
          <polygon points="280,20 320,0 320,30 280,50" fillOpacity="0.38" />
        </g>

        {/* Gold path up the stairs to the table */}
        <path
          className="dealschool__path"
          pathLength="1"
          d="M 50 490 L 150 430 L 190 405 L 230 355 L 270 305 L 310 255 L 350 195 C 410 155, 480 125, 580 95"
          stroke="#D4A62A"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Pulse where the path meets the table */}
        <circle cx="580" cy="95" r="7" fill="#D4A62A" />
        <circle cx="580" cy="95" r="16" stroke="#D4A62A" strokeOpacity="0.3" strokeWidth="2">
          <animate attributeName="r" values="7;25;7" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;0;1" dur="2.5s" repeatCount="indefinite" />
        </circle>

        <g fontFamily="Helvetica, Arial, sans-serif" fontSize="13" fontWeight="bold" letterSpacing="0.06em">
          <text x="70" y="475" fill="#2D3748">ENTRY: AMBITIOUS THINKING</text>
          <text x="240" y="325" fill="#2D3748">ANALYSIS &amp; METRICS</text>
          <text x="580" y="20" fill="#D4A62A" fontWeight="900" textAnchor="middle">
            DESTINATION: VC BOARDROOM
          </text>
        </g>
      </svg>
    </div>
  );
}

export default StaircaseArt;
