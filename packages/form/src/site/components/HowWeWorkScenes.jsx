// Line-art scenes for the How We Work panel, one per step (viewBox 400×320).
// Animation classes (ill-*) live in HowWeWork.css and only run on the active scene;
// `--d` staggers each element's entrance.

const d = (s) => ({ '--d': `${s}s` });

const Check = ({ x, y }) => <path className="ill-tick" d={`M${x - 4} ${y} l3 3 l6 -6`} />;

function ApplicationScene() {
  const fields = [70, 92, 56, 80];
  return (
    <>
      <rect className="ill-panel" x="110" y="36" width="180" height="248" rx="16" />
      <rect className="ill-accent ill-grow-x" style={d(0.1)} x="134" y="60" width="64" height="8" rx="4" />
      <rect className="ill-muted ill-grow-x" style={d(0.2)} x="134" y="76" width="104" height="6" rx="3" />
      {fields.map((w, i) => {
        const y = 100 + i * 36;
        const t = 0.4 + i * 0.45;
        return (
          <g key={y}>
            <rect className="ill-field" x="134" y={y} width="132" height="26" rx="7" />
            <rect className="ill-soft-strong ill-grow-x" style={d(t)} x="144" y={y + 10} width={w} height="6" rx="3" />
            <g className="ill-pop" style={d(t + 0.35)}>
              <circle className="ill-accent" cx="252" cy={y + 13} r="7" />
              <Check x={252} y={y + 13} />
            </g>
          </g>
        );
      })}
      <rect className="ill-accent ill-pop" style={d(2.3)} x="134" y="250" width="72" height="18" rx="9" />
      <g className="ill-fly" style={d(2.6)}>
        <g transform="translate(304 56)">
          <path className="ill-line" d="M0 14 L34 0 L22 32 L16 19 Z" />
          <path className="ill-line" d="M16 19 L34 0" />
        </g>
      </g>
    </>
  );
}

function PitchCallScene() {
  const bars = [
    [224, 20],
    [246, 34],
    [268, 28],
    [290, 48],
  ];
  return (
    <>
      <rect className="ill-panel" x="60" y="62" width="280" height="196" rx="16" />
      {[80, 92, 104].map((x) => (
        <circle key={x} className="ill-muted" cx={x} cy="80" r="3.5" />
      ))}
      {/* Founder tile, with a "speaking" ring */}
      <rect className="ill-tile" x="76" y="96" width="120" height="110" rx="10" />
      <rect className="ill-ring" x="76" y="96" width="120" height="110" rx="10" />
      <circle className="ill-avatar" cx="136" cy="138" r="16" />
      <path className="ill-avatar" d="M108 194 q28 -40 56 0 z" />
      {[88, 94, 100].map((x, i) => (
        <rect key={x} className="ill-accent ill-wave" style={d(i * 0.18)} x={x} y="180" width="3" height="16" rx="1.5" />
      ))}
      {/* Deck tile: the numbers being pitched */}
      <rect className="ill-tile" x="204" y="96" width="120" height="110" rx="10" />
      {bars.map(([x, h], i) => (
        <rect
          key={x}
          className="ill-accent ill-grow-y"
          style={d(0.3 + i * 0.2)}
          x={x}
          y={190 - h}
          width="12"
          height={h}
          rx="3"
        />
      ))}
      <path className="ill-line ill-draw" style={d(1.2)} pathLength="1" d="M222 158 L248 140 L270 148 L300 120" />
      {/* Call controls */}
      <circle className="ill-muted" cx="170" cy="234" r="10" />
      <circle className="ill-accent" cx="200" cy="234" r="10" />
      <circle className="ill-muted" cx="230" cy="234" r="10" />
      {/* Live chip */}
      <g className="ill-pop ill-float" style={d(0.6)}>
        <rect className="ill-panel" x="276" y="36" width="88" height="28" rx="14" />
        <circle className="ill-live" cx="293" cy="50" r="4" />
        <rect className="ill-muted" x="304" y="47" width="46" height="6" rx="3" />
      </g>
    </>
  );
}

function PartnerCallScene() {
  const person = (cx) => (
    <>
      <circle className="ill-tile" cx={cx} cy="186" r="44" />
      <circle className="ill-avatar" cx={cx} cy="176" r="14" />
      <path className="ill-avatar" d={`M${cx - 24} 214 q24 -34 48 0 z`} />
    </>
  );
  return (
    <>
      {person(116)}
      {person(284)}
      <path className="ill-line ill-dash" d="M166 186 H234" />
      <g className="ill-pop" style={d(1.9)}>
        <circle className="ill-accent" cx="316" cy="152" r="11" />
        <Check x={316} y={152} />
      </g>
      <g className="ill-pop" style={d(0.3)}>
        <rect className="ill-panel" x="56" y="66" width="112" height="46" rx="12" />
        <path className="ill-panel" d="M96 112 l10 12 l6 -12" />
        <rect className="ill-muted ill-grow-x" style={d(0.6)} x="72" y="80" width="80" height="6" rx="3" />
        <rect className="ill-muted ill-grow-x" style={d(0.75)} x="72" y="93" width="52" height="6" rx="3" />
      </g>
      <g className="ill-pop" style={d(1.1)}>
        <rect className="ill-panel ill-panel--accent" x="228" y="52" width="120" height="52" rx="12" />
        <path className="ill-panel ill-panel--accent" d="M292 104 l-6 12 l-8 -12" />
        <rect className="ill-soft-strong ill-grow-x" style={d(1.4)} x="244" y="67" width="88" height="6" rx="3" />
        <rect className="ill-soft-strong ill-grow-x" style={d(1.55)} x="244" y="80" width="60" height="6" rx="3" />
      </g>
      <g className="ill-typing">
        {[188, 200, 212].map((x, i) => (
          <circle key={x} className="ill-accent ill-bounce" style={d(2.2 + i * 0.15)} cx={x} cy="258" r="4" />
        ))}
      </g>
    </>
  );
}

function DiligenceScene() {
  const bars = [40, 64, 52, 86, 100];
  return (
    <>
      <rect className="ill-panel" x="64" y="48" width="208" height="224" rx="16" />
      <rect className="ill-accent" x="86" y="70" width="56" height="8" rx="4" />
      <path className="ill-axis" d="M86 204 H250" />
      {bars.map((h, i) => (
        <rect
          key={i}
          className="ill-soft-strong ill-grow-y"
          style={d(0.2 + i * 0.15)}
          x={94 + i * 32}
          y={204 - h}
          width="20"
          height={h}
          rx="4"
        />
      ))}
      <path className="ill-line ill-draw" style={d(1)} pathLength="1" d="M104 160 L136 136 L168 146 L200 112 L232 96" />
      <rect className="ill-muted ill-grow-x" style={d(0.9)} x="86" y="222" width="140" height="6" rx="3" />
      <rect className="ill-muted ill-grow-x" style={d(1)} x="86" y="238" width="96" height="6" rx="3" />
      {/* Checklist */}
      <rect className="ill-panel" x="286" y="86" width="80" height="128" rx="12" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect className="ill-muted" x="318" y={109 + i * 34} width="34" height="6" rx="3" />
          <g className="ill-pop" style={d(1.4 + i * 0.5)}>
            <circle className="ill-accent" cx="304" cy={112 + i * 34} r="8" />
            <Check x={304} y={112 + i * 34} />
          </g>
        </g>
      ))}
      {/* Magnifier sweeping the numbers */}
      <g className="ill-sweep">
        <circle className="ill-lens" cx="150" cy="150" r="30" />
        <path className="ill-handle" d="M172 172 L196 196" />
      </g>
    </>
  );
}

function ClosingScene() {
  return (
    <>
      <rect className="ill-panel" x="92" y="40" width="172" height="240" rx="16" />
      <rect className="ill-accent" x="114" y="64" width="72" height="8" rx="4" />
      {[88, 102, 116, 136, 150, 164].map((y, i) => (
        <rect
          key={y}
          className="ill-muted ill-grow-x"
          style={d(0.1 + i * 0.08)}
          x="114"
          y={y}
          width={i % 3 === 2 ? 84 : 128}
          height="5"
          rx="2.5"
        />
      ))}
      <path className="ill-axis" d="M114 236 H242" />
      <path
        className="ill-line ill-draw ill-draw--slow"
        style={d(0.6)}
        pathLength="1"
        d="M118 226 c8 -20 18 -20 14 0 s12 -18 18 -4 s8 8 16 -6 s12 -4 20 2 s10 4 24 -10"
      />
      <g className="ill-pop" style={d(2)}>
        <circle className="ill-accent" cx="258" cy="62" r="22" />
        <circle className="ill-seal" cx="258" cy="62" r="16" />
        <path className="ill-tick ill-tick--lg" d="M249 62 l6 6 l12 -13" />
      </g>
      {/* Wire transfer */}
      <path className="ill-line ill-dash" d="M272 206 H318" />
      <g className="ill-pop" style={d(2.4)}>
        <g className="ill-float">
          <circle className="ill-soft-strong" cx="344" cy="206" r="24" />
          <circle className="ill-seal" cx="344" cy="206" r="15" />
          <Check x={344} y={206} />
        </g>
      </g>
    </>
  );
}

export const SCENES = [
  { name: 'Application', Art: ApplicationScene },
  { name: 'Pitch call', Art: PitchCallScene },
  { name: 'Partner call', Art: PartnerCallScene },
  { name: 'Due diligence', Art: DiligenceScene },
  { name: 'Closing', Art: ClosingScene },
];
