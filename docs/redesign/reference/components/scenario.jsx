// Sample scenario JSON used across variants

const SAMPLE_SCENARIO = `{
  "schema": "fieldcraft.scenario",
  "schemaVersion": 6,
  "title": "Untitled Fieldcraft Scenario",
  "space": {
    "type": "square-grid",
    "width": 8,
    "height": 8,
    "tileSize": 48,
    "scale": {
      "distancePerTile": 1,
      "unit": "tile"
    },
    "grid": {
      "lineColor": "#53657a",
      "lineOpacity": 1
    },
    "background": {
      "asset": "checkerboard-32",
      "fit": "contain"
    }
  },
  "sides": [
    { "id": "fed", "label": "Federation",     "color": "#5ea7e0" },
    { "id": "kli", "label": "Klingon Empire", "color": "#e06a5e" }
  ],
  "markers": [
    { "id": "m-1", "x": 2, "y": 3, "kind": "marker", "sideId": "fed", "facingDegrees": 0,
      "style": { "shape": "circle", "fillColor": "#5ea7e0", "strokeColor": "#1f5d83" },
      "properties": [{ "key": "role", "type": "text", "value": "Scout" }] },
    { "id": "m-2", "x": 5, "y": 4, "kind": "marker", "sideId": "kli", "facingDegrees": 180,
      "style": { "shape": "diamond", "fillColor": "#e06a5e", "strokeColor": "#82362f" },
      "properties": [{ "key": "strength", "type": "number", "value": 4 }] }
  ],
  "assets": [
    { "id": "checkerboard-32", "kind": "image",
      "path": "assets/checkerboard-32-3.png" }
  ]
}`;

// Syntax-highlight a tiny slice of JSON (display only)
function JsonBlock({ text, height = '100%', lineNumbers = true }) {
  const T = window.FC_TOKENS;
  const lines = text.split('\n');
  return (
    <div style={{
      height, display: 'flex',
      background: T.bg0, border: `1px solid ${T.line}`, borderRadius: 3,
      fontFamily: T.fontMono, fontSize: 11, lineHeight: '18px',
      overflow: 'auto',
    }}>
      {lineNumbers && (
        <div style={{
          flex: '0 0 auto', padding: '8px 8px 8px 10px',
          color: '#3a4a58', textAlign: 'right', userSelect: 'none',
          borderRight: `1px solid ${T.line}`, background: '#050709',
        }}>
          {lines.map((_, i) => <div key={i}>{i + 1}</div>)}
        </div>
      )}
      <div style={{ padding: '8px 12px', color: T.ink, whiteSpace: 'pre', minWidth: 0 }}>
        {lines.map((line, i) => (
          <div key={i} dangerouslySetInnerHTML={{ __html: hl(line) }} />
        ))}
      </div>
    </div>
  );
}

function hl(line) {
  const T = window.FC_TOKENS;
  return line
    .replace(/("(?:\\.|[^"\\])*")(\s*:)/g, `<span style="color:${T.accent}">$1</span>$2`)
    .replace(/: ("(?:\\.|[^"\\])*")/g, `: <span style="color:#c5e4d8">$1</span>`)
    .replace(/: (-?\d+\.?\d*)/g, `: <span style="color:#e9b572">$1</span>`)
    .replace(/: (true|false|null)/g, `: <span style="color:#d085e5">$1</span>`);
}

Object.assign(window, { SAMPLE_SCENARIO, JsonBlock });
