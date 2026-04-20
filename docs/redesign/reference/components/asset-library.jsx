// Asset library view — grid of thumbnails with filter, used for the library subview.

const TAL = window.FC_TOKENS;

const SAMPLE_ASSETS = [
  { id: 'checkerboard-32', label: 'Checkerboard',     kind: 'image', size: '512×512',  bytes: '12 KB',  path: 'assets/checkerboard-32-3.png', used: 'Board background' },
  { id: 'hex-paper-01',    label: 'Hex paper',        kind: 'image', size: '1024×768', bytes: '84 KB',  path: 'assets/hex-paper-01.png',      used: null },
  { id: 'terrain-fog',     label: 'Fog of war',       kind: 'image', size: '800×800',  bytes: '96 KB',  path: 'assets/terrain-fog.png',       used: null },
  { id: 'token-red',       label: 'Red token',        kind: 'image', size: '128×128',  bytes: '4 KB',   path: 'assets/token-red.png',         used: 'Marker style' },
  { id: 'token-blue',      label: 'Blue token',       kind: 'image', size: '128×128',  bytes: '4 KB',   path: 'assets/token-blue.png',        used: null },
  { id: 'alert-ping',      label: 'Alert ping',       kind: 'audio', size: '0:01.4',   bytes: '18 KB',  path: 'assets/alert-ping.wav',        used: null },
  { id: 'thunder-roll',    label: 'Thunder roll',     kind: 'audio', size: '0:03.2',   bytes: '52 KB',  path: 'assets/thunder-roll.wav',      used: null },
  { id: 'field-ambient',   label: 'Field ambient',    kind: 'audio', size: '2:41',     bytes: '2.4 MB', path: 'assets/field-ambient.mp3',     used: null },
];

window.SAMPLE_ASSETS = SAMPLE_ASSETS;

function AssetLibraryScreen({ onClose }) {
  const [filter, setFilter] = React.useState('all');
  const [selected, setSelected] = React.useState('checkerboard-32');
  const filtered = SAMPLE_ASSETS.filter(a => filter === 'all' || a.kind === filter);
  const sel = SAMPLE_ASSETS.find(a => a.id === selected);

  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
      background: TAL.bg0,
    }}>
      {/* Header bar */}
      <div style={{
        padding: '14px 20px', borderBottom: `1px solid ${TAL.line}`,
        display: 'flex', alignItems: 'center', gap: 14, background: TAL.bg1,
      }}>
        <div>
          <div style={{
            fontFamily: TAL.fontMono, fontSize: 9, color: TAL.accent, letterSpacing: 1.4,
            textTransform: 'uppercase', marginBottom: 2,
          }}>Package · assets/</div>
          <div style={{
            fontFamily: TAL.fontUi, fontSize: 16, fontWeight: 600, color: TAL.inkBright,
          }}>Asset library</div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Seg
            options={[
              { value: 'all', label: `All · ${SAMPLE_ASSETS.length}` },
              { value: 'image', label: `Image · ${SAMPLE_ASSETS.filter(a => a.kind === 'image').length}` },
              { value: 'audio', label: `Audio · ${SAMPLE_ASSETS.filter(a => a.kind === 'audio').length}` },
            ]}
            value={filter} onChange={setFilter}
          />
          <CmdBtn icon={<Icons.Image s={11} />} label="Import Image" />
          <CmdBtn icon={<Icons.Audio s={11} />} label="Import Audio" />
          <CmdBtn icon={<Icons.Close s={10} />} label="Back to editor" onClick={onClose} />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 320px' }}>
        {/* Grid */}
        <div style={{
          overflow: 'auto', padding: 20,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 12, alignContent: 'flex-start',
        }}>
          {filtered.map(a => (
            <AssetTile key={a.id} asset={a} selected={a.id === selected}
              onClick={() => setSelected(a.id)} />
          ))}
        </div>

        {/* Inspector */}
        <div style={{
          borderLeft: `1px solid ${TAL.line}`, background: TAL.bg1,
          display: 'flex', flexDirection: 'column',
        }}>
          <RailHeader>Asset Details</RailHeader>
          {sel && (
            <>
              <div style={{
                padding: 16, background: TAL.bg0, borderBottom: `1px solid ${TAL.line}`,
                display: 'grid', placeItems: 'center', height: 180,
              }}>
                {sel.kind === 'image' ? (
                  <div style={{
                    width: '100%', height: '100%',
                    background: sel.id === 'checkerboard-32'
                      ? `repeating-conic-gradient(${TAL.tileA} 0 25%, ${TAL.tileB} 0 50%) 50% 50%/32px 32px`
                      : `repeating-linear-gradient(45deg, ${TAL.bg2} 0 8px, ${TAL.bg3} 8px 16px)`,
                    border: `1px solid ${TAL.line}`,
                  }} />
                ) : (
                  <AudioWaveform />
                )}
              </div>
              <div style={{
                padding: '10px 12px 6px', borderBottom: `1px solid ${TAL.line}`,
              }}>
                <input
                  key={sel.id}
                  defaultValue={sel.label || sel.id}
                  onFocus={(e) => e.target.select()}
                  style={{
                    display: 'block', width: '100%',
                    fontFamily: TAL.fontUi, fontSize: 14, fontWeight: 600, color: TAL.inkBright,
                    background: 'transparent', border: 0, outline: 0, padding: 0,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                  title="Click to rename the display label"
                />
                <div style={{
                  fontFamily: TAL.fontMono, fontSize: 10, color: TAL.inkDim, marginTop: 2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', direction: 'rtl',
                }} title={sel.path}>{sel.path}</div>
              </div>
              <div style={{ padding: '6px 0' }}>
                <KV k="ID" v={sel.id} mono accent={TAL.accent} />
                <KV k="Kind" v={sel.kind} mono />
                <KV k="Size" v={sel.size} mono />
                <KV k="Bytes" v={sel.bytes} mono />
                <KV k="Used" v={sel.used || <span style={{ color: TAL.inkDim }}>unreferenced</span>} />
              </div>
              <div style={{ padding: 12, display: 'grid', gap: 6 }}>
                {sel.kind === 'image' && (
                  <button style={{ ...miniBtn, height: 30, borderColor: TAL.accent, color: TAL.accent }}>
                    Set as board background
                  </button>
                )}
                <button style={{ ...miniBtn, height: 30 }}>Rename…</button>
                <button style={{ ...miniBtn, height: 30 }}>Reveal in file manager</button>
                <button style={{ ...miniBtn, height: 30, color: TAL.red, borderColor: TAL.red }}>
                  Remove from package
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AssetTile({ asset, selected, onClick }) {
  const T = window.FC_TOKENS;
  return (
    <button onClick={onClick} style={{
      border: `1px solid ${selected ? T.accent : T.line}`, borderRadius: 3,
      background: selected ? T.accentWash : T.bg1,
      padding: 0, overflow: 'hidden', cursor: 'pointer', textAlign: 'left',
      boxShadow: selected ? `0 0 0 2px ${T.accentWash}` : 'none',
    }}>
      <div style={{
        aspectRatio: '1/1', background: T.bg0, borderBottom: `1px solid ${T.line}`,
        display: 'grid', placeItems: 'center',
      }}>
        {asset.kind === 'image' ? (
          <div style={{
            width: '80%', height: '80%',
            background: asset.id === 'checkerboard-32'
              ? `repeating-conic-gradient(${T.tileA} 0 25%, ${T.tileB} 0 50%) 50% 50%/16px 16px`
              : `repeating-linear-gradient(45deg, ${T.bg2} 0 6px, ${T.bg3} 6px 12px)`,
            border: `1px solid ${T.line}`,
          }} />
        ) : (
          <Icons.Audio s={30} c={T.amber} />
        )}
      </div>
      <div style={{ padding: 8 }}>
        <div style={{
          fontFamily: T.fontUi, fontSize: 11, color: T.ink, fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{asset.label || asset.id}</div>
        <div style={{
          fontFamily: T.fontMono, fontSize: 9, color: T.inkDim,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1,
        }}>{asset.id}</div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', marginTop: 4,
          fontFamily: T.fontMono, fontSize: 9, color: T.inkDim,
        }}>
          <span style={{
            textTransform: 'uppercase', letterSpacing: 0.6,
            color: asset.kind === 'image' ? T.accent : T.amber,
          }}>{asset.kind}</span>
          <span>{asset.bytes}</span>
        </div>
      </div>
    </button>
  );
}

function AudioWaveform() {
  const T = window.FC_TOKENS;
  return (
    <svg width="100%" height="100%" viewBox="0 0 300 150" preserveAspectRatio="none">
      {Array.from({ length: 80 }).map((_, i) => {
        const h = 10 + Math.abs(Math.sin(i * 0.3) + Math.sin(i * 0.11) * 0.7) * 55;
        return <rect key={i} x={i * 3.7} y={75 - h / 2} width={2.4} height={h}
          fill={T.amber} opacity={0.75} />;
      })}
      <line x1={0} y1={75} x2={300} y2={75} stroke={T.line} strokeWidth={0.5} />
    </svg>
  );
}

Object.assign(window, { AssetLibraryScreen });
