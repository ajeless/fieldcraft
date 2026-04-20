// Bottom asset strip — the "placement surface".
// Always-visible shelf of asset thumbnails. Drag to place, click to arm.
// Collapses to a 28px rail. Filters contextually when a placement tool is held.

const TAS = window.FC_TOKENS;

function AssetStrip({ tool, activeAssetId, onPick, onOpenLibrary }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [kindFilter, setKindFilter] = React.useState('all');
  const [query, setQuery] = React.useState('');
  const [hoverId, setHoverId] = React.useState(null);

  // Contextual filter: when Marker tool is held, image-only
  const effectiveKind = tool === 'marker' ? 'image' : kindFilter;

  // Mock "recent / pinned" ordering — in a real app this would be persisted
  const pinnedIds = ['token-red', 'token-blue', 'checkerboard-32'];
  const list = window.SAMPLE_ASSETS
    .filter(a => effectiveKind === 'all' || a.kind === effectiveKind)
    .filter(a => !query || a.id.toLowerCase().includes(query.toLowerCase()));
  // Pinned first, then the rest
  const ordered = [
    ...list.filter(a => pinnedIds.includes(a.id)),
    ...list.filter(a => !pinnedIds.includes(a.id)),
  ];

  const T = TAS;
  const H_COLLAPSED = 28;
  const H_EXPANDED = 128;

  return (
    <div style={{
      flex: '0 0 auto', height: collapsed ? H_COLLAPSED : H_EXPANDED,
      background: T.bg1, borderTop: `1px solid ${T.line}`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      transition: 'height 120ms ease',
    }}>
      {/* Header */}
      <div style={{
        height: H_COLLAPSED, flex: '0 0 auto',
        borderBottom: collapsed ? 'none' : `1px solid ${T.line}`,
        display: 'flex', alignItems: 'center', padding: '0 8px 0 10px', gap: 10,
      }}>
        <button onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand asset strip' : 'Collapse asset strip'}
          style={{
            width: 18, height: 18, border: 0, background: 'transparent',
            color: T.inkMuted, cursor: 'pointer', display: 'grid', placeItems: 'center',
            transform: collapsed ? 'rotate(-90deg)' : 'none',
            transition: 'transform 120ms ease',
          }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3">
            <path d="M2 3.5l3 3 3-3" />
          </svg>
        </button>
        <span style={{
          fontFamily: T.fontMono, fontSize: 9, fontWeight: 600,
          letterSpacing: 1.4, textTransform: 'uppercase', color: T.inkMuted,
        }}>Assets</span>
        <span style={{
          fontFamily: T.fontMono, fontSize: 9, color: T.inkDim,
          padding: '1px 6px', border: `1px solid ${T.line}`, borderRadius: 2,
        }}>{ordered.length}</span>

        {tool === 'marker' && (
          <span style={{
            fontFamily: T.fontMono, fontSize: 9, color: T.accent,
            padding: '1px 6px', border: `1px solid ${T.accent}`, borderRadius: 2,
            letterSpacing: 0.6, textTransform: 'uppercase',
          }}>Filtered · Marker</span>
        )}

        {!collapsed && tool !== 'marker' && (
          <div style={{ display: 'inline-flex', border: `1px solid ${T.line}`, borderRadius: 3, overflow: 'hidden' }}>
            {['all', 'image', 'audio'].map((k, i) => (
              <button key={k} onClick={() => setKindFilter(k)} style={{
                height: 20, padding: '0 8px', border: 0,
                borderLeft: i === 0 ? 0 : `1px solid ${T.line}`,
                background: kindFilter === k ? T.accentWash : 'transparent',
                color: kindFilter === k ? T.accent : T.inkMuted,
                fontFamily: T.fontMono, fontSize: 9, fontWeight: 600,
                letterSpacing: 0.6, textTransform: 'uppercase', cursor: 'pointer',
              }}>{k}</button>
            ))}
          </div>
        )}

        {!collapsed && (
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter…"
            style={{
              height: 20, width: 140, padding: '0 8px',
              border: `1px solid ${T.line}`, borderRadius: 3,
              background: T.bg0, color: T.ink, outline: 'none',
              fontFamily: T.fontUi, fontSize: 11,
            }}
          />
        )}

        <div style={{ flex: 1 }} />

        {!collapsed && activeAssetId && (
          <span style={{
            fontFamily: T.fontMono, fontSize: 9, color: T.accent,
            letterSpacing: 0.6, textTransform: 'uppercase',
          }}>
            Armed · {activeAssetId}
          </span>
        )}

        {!collapsed && (
          <>
            <button onClick={onOpenLibrary} style={{
              height: 20, padding: '0 8px', border: `1px solid ${T.line}`, borderRadius: 3,
              background: 'transparent', color: T.inkMuted, cursor: 'pointer',
              fontFamily: T.fontUi, fontSize: 11,
            }}>Open library →</button>
          </>
        )}
      </div>

      {/* Body */}
      {!collapsed && (
        <div style={{
          flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'hidden',
          padding: '8px 10px', display: 'flex', gap: 6,
        }}>
          {ordered.map(a => (
            <AssetCard
              key={a.id}
              asset={a}
              pinned={pinnedIds.includes(a.id)}
              armed={activeAssetId === a.id}
              hovered={hoverId === a.id}
              onHover={() => setHoverId(a.id)}
              onLeave={() => setHoverId(h => (h === a.id ? null : h))}
              onClick={() => onPick(activeAssetId === a.id ? null : a.id)}
            />
          ))}
          <ImportCard />
        </div>
      )}
    </div>
  );
}

function AssetCard({ asset, pinned, armed, hovered, onHover, onLeave, onClick }) {
  const T = TAS;
  const isAudio = asset.kind === 'audio';
  return (
    <button
      draggable="true"
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      title={`${asset.id}  ·  ${asset.size}  ·  ${asset.bytes}\nClick to arm, drag to place`}
      style={{
        flex: '0 0 auto', width: 72, height: 96,
        padding: 0, border: `1px solid ${armed ? T.accent : (hovered ? T.lineStrong : T.line)}`,
        background: armed ? T.accentWash : T.bg2, borderRadius: 3,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        cursor: 'grab', position: 'relative',
        boxShadow: armed ? `0 0 0 2px ${T.accentWash}` : 'none',
        transition: 'border-color 80ms ease, background 80ms ease',
      }}
    >
      {/* thumbnail area */}
      <div style={{
        flex: 1, minHeight: 0,
        background: isAudio
          ? `linear-gradient(180deg, ${T.bg3} 0%, ${T.bg2} 100%)`
          : `repeating-conic-gradient(${T.tileA} 0 25%, ${T.tileB} 0 50%) 0 0 / 10px 10px`,
        borderBottom: `1px solid ${T.line}`,
        display: 'grid', placeItems: 'center',
        position: 'relative',
      }}>
        {isAudio && <AudioGlyph />}
        {pinned && (
          <div style={{
            position: 'absolute', top: 3, right: 3,
            width: 8, height: 8, borderRadius: 999, background: T.accent,
            boxShadow: `0 0 0 1px ${T.bg2}`,
          }} title="Pinned" />
        )}
      </div>
      {/* label */}
      <div style={{
        height: 22, padding: '0 6px',
        display: 'flex', alignItems: 'center',
        fontFamily: T.fontMono, fontSize: 9, color: armed ? T.accent : T.ink,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        letterSpacing: 0.2,
      }}>{asset.label || asset.id}</div>
    </button>
  );
}

function AudioGlyph() {
  const T = TAS;
  // Minimal waveform hint
  const bars = [4, 9, 6, 12, 14, 10, 16, 8, 11, 5, 13, 7, 4, 9, 6];
  return (
    <svg width="56" height="24" viewBox="0 0 56 24">
      {bars.map((h, i) => (
        <rect key={i} x={i * 3.6} y={12 - h / 2} width="2" height={h}
          fill={T.accent} opacity={0.75} />
      ))}
    </svg>
  );
}

function ImportCard() {
  const T = TAS;
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Drop files here or click to browse"
      style={{
        flex: '0 0 auto', width: 72, height: 96,
        padding: 0, border: `1px dashed ${hover ? T.accent : T.lineStrong}`,
        background: hover ? T.accentWash : 'transparent', borderRadius: 3,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 6,
        color: hover ? T.accent : T.inkMuted, cursor: 'pointer',
        fontFamily: T.fontMono, fontSize: 9, letterSpacing: 0.4,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
        <path d="M9 3v9M5 7l4-4 4 4" />
        <path d="M3 13v2h12v-2" />
      </svg>
      <span>IMPORT</span>
    </button>
  );
}

Object.assign(window, { AssetStrip });
