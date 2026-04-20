// Board renderers for the 3 space models:
// - square grid (checker option)
// - pointy-top hex
// - free coordinate (empty rectangle with ruler ticks)

const TB = window.FC_TOKENS;

// Square grid board — rendered as SVG for crisp ticks
function SquareBoard({ w = 8, h = 8, tilePx = 48, checker = true, markers = [],
                      showGrid = true, onTileClick, highlight }) {
  const W = w * tilePx, H = h * tilePx;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}>
      {/* checker fill */}
      {checker && Array.from({ length: h }).map((_, y) =>
        Array.from({ length: w }).map((_, x) => {
          const dark = (x + y) % 2 === 1;
          return <rect key={`${x},${y}`} x={x * tilePx} y={y * tilePx}
            width={tilePx} height={tilePx}
            fill={dark ? TB.tileA : TB.tileB} opacity={0.9} />;
        })
      )}
      {!checker && <rect x={0} y={0} width={W} height={H} fill={TB.boardBg} />}

      {/* grid lines */}
      {showGrid && (
        <g stroke={checker ? 'rgba(0,0,0,0.25)' : TB.boardGrid} strokeWidth={1}>
          {Array.from({ length: w + 1 }).map((_, i) =>
            <line key={`v${i}`} x1={i * tilePx} y1={0} x2={i * tilePx} y2={H} />)}
          {Array.from({ length: h + 1 }).map((_, i) =>
            <line key={`h${i}`} x1={0} y1={i * tilePx} x2={W} y2={i * tilePx} />)}
        </g>
      )}

      {/* selection highlight */}
      {highlight && (
        <rect x={highlight.x * tilePx + 1.5} y={highlight.y * tilePx + 1.5}
          width={tilePx - 3} height={tilePx - 3}
          fill="none" stroke={TB.accent} strokeWidth={2} />
      )}

      {/* markers */}
      {markers.map((m, i) => (
        <g key={i} transform={`translate(${(m.x + 0.5) * tilePx}, ${(m.y + 0.5) * tilePx})`}>
          <circle r={tilePx * 0.32} fill={m.color || TB.marker}
            stroke={m.ring || TB.markerRing} strokeWidth={2.5} />
          {m.selected && (
            <circle r={tilePx * 0.42} fill="none" stroke={TB.accent} strokeWidth={1.6}
              strokeDasharray="3 3" />
          )}
          {m.label && (
            <text y={4} textAnchor="middle" fontFamily={TB.fontMono} fontSize={tilePx * 0.3}
              fontWeight="700" fill="#fff">{m.label}</text>
          )}
          {m.sideColor && (
            <g transform={`translate(${tilePx * 0.22}, ${-tilePx * 0.22})`}>
              <circle r={tilePx * 0.12} fill={m.sideColor}
                stroke={TB.bg0} strokeWidth={1.4} />
            </g>
          )}
        </g>
      ))}

      {/* corner registration marks */}
      <CornerMarks W={W} H={H} />
    </svg>
  );
}

function CornerMarks({ W, H, color = 'rgba(255,255,255,0.25)' }) {
  const m = 6, len = 10;
  return (
    <g stroke={color} strokeWidth={1} fill="none">
      {/* tl */}
      <path d={`M${-m} ${len - m}V${-m}H${len - m}`} />
      {/* tr */}
      <path d={`M${W - len + m} ${-m}H${W + m}V${len - m}`} />
      {/* bl */}
      <path d={`M${-m} ${H - len + m}V${H + m}H${len - m}`} />
      {/* br */}
      <path d={`M${W - len + m} ${H + m}H${W + m}V${H - len + m}`} />
    </g>
  );
}

// Pointy-top hex board
function HexBoard({ cols = 8, rows = 6, size = 28, markers = [] }) {
  // pointy-top: width = sqrt(3)*size, height = 2*size
  const hexW = Math.sqrt(3) * size;
  const hexH = 2 * size;
  const W = hexW * (cols + 0.5) + 4;
  const H = hexH * 0.75 * (rows - 1) + hexH + 4;
  const hexPath = (cx, cy) => {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 90);
      pts.push(`${cx + size * Math.cos(a)},${cy + size * Math.sin(a)}`);
    }
    return `M${pts.join('L')}Z`;
  };
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = hexW * (c + 0.5 + (r % 2 ? 0.5 : 0)) + 2;
      const cy = hexH * 0.75 * r + size + 2;
      cells.push({ c, r, cx, cy });
    }
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      {cells.map(({ c, r, cx, cy }) => (
        <path key={`${c},${r}`} d={hexPath(cx, cy)}
          fill={TB.bg2} stroke={TB.boardGridStrong} strokeWidth={1} />
      ))}
      {markers.map((m, i) => {
        const cell = cells.find(x => x.c === m.x && x.r === m.y);
        if (!cell) return null;
        return (
          <g key={i} transform={`translate(${cell.cx}, ${cell.cy})`}>
            <circle r={size * 0.45} fill={m.color || TB.marker}
              stroke={m.ring || TB.markerRing} strokeWidth={2.2} />
          </g>
        );
      })}
      <CornerMarks W={W} H={H} color={TB.lineStrong} />
    </svg>
  );
}

// Free-coordinate board — empty rect with ruler ticks every 10 units
function FreeBoard({ width = 600, height = 400, markers = [] }) {
  const W = width, H = height;
  const tick = 20;
  return (
    <svg viewBox={`-20 -20 ${W + 40} ${H + 40}`} width="100%" height="100%"
      preserveAspectRatio="xMidYMid meet">
      {/* world bg */}
      <rect x={0} y={0} width={W} height={H} fill={TB.bg2} stroke={TB.lineStrong} />

      {/* minor grid */}
      <g stroke={TB.boardGrid} strokeWidth={0.5}>
        {Array.from({ length: Math.floor(W / tick) + 1 }).map((_, i) =>
          <line key={`v${i}`} x1={i * tick} y1={0} x2={i * tick} y2={H} />)}
        {Array.from({ length: Math.floor(H / tick) + 1 }).map((_, i) =>
          <line key={`h${i}`} x1={0} y1={i * tick} x2={W} y2={i * tick} />)}
      </g>

      {/* ruler ticks — top + left */}
      <g stroke={TB.inkDim} strokeWidth={0.8} fontFamily={TB.fontMono} fontSize={8} fill={TB.inkDim}>
        {Array.from({ length: Math.floor(W / 100) + 1 }).map((_, i) => (
          <g key={`tt${i}`}>
            <line x1={i * 100} y1={-6} x2={i * 100} y2={0} />
            {i > 0 && <text x={i * 100 + 2} y={-8}>{i * 100}</text>}
          </g>
        ))}
        {Array.from({ length: Math.floor(H / 100) + 1 }).map((_, i) => (
          <g key={`ll${i}`}>
            <line x1={-6} y1={i * 100} x2={0} y2={i * 100} />
            {i > 0 && <text x={-18} y={i * 100 - 2}>{i * 100}</text>}
          </g>
        ))}
      </g>

      {/* markers */}
      {markers.map((m, i) => (
        <g key={i} transform={`translate(${m.x}, ${m.y})`}>
          <circle r={10} fill={m.color || TB.marker}
            stroke={m.ring || TB.markerRing} strokeWidth={2} />
          {m.bearing !== undefined && (
            <line x1={0} y1={0}
              x2={Math.sin(m.bearing * Math.PI / 180) * 26}
              y2={-Math.cos(m.bearing * Math.PI / 180) * 26}
              stroke={TB.accent} strokeWidth={1.5} markerEnd="url(#arrow)" />
          )}
        </g>
      ))}
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5"
          markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0L10 5L0 10z" fill={TB.accent} />
        </marker>
      </defs>

      <CornerMarks W={W} H={H} color={TB.lineStrong} />
    </svg>
  );
}

Object.assign(window, { SquareBoard, HexBoard, FreeBoard });
