// New scenario setup screen — replaces the dashed-border in-viewport form
// with a proper modal-style setup page showing all 3 space models as cards.

const TN = window.FC_TOKENS;

function NewScenarioScreen({ onCancel, onCreate }) {
  const [space, setSpace] = React.useState('square');
  const [title, setTitle] = React.useState('Untitled Fieldcraft Scenario');
  const [w, setW] = React.useState(8);
  const [h, setH] = React.useState(8);
  const [tile, setTile] = React.useState(48);

  return (
    <div style={{
      flex: 1, minHeight: 0, overflow: 'auto',
      background: window.FC_TOKENS.stageGradient,
      padding: '48px 32px',
    }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontFamily: TN.fontMono, fontSize: 10, color: TN.accent,
            letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 6,
          }}>New scenario</div>
          <h1 style={{
            margin: 0, fontFamily: TN.fontUi, fontSize: 28, fontWeight: 600,
            color: TN.inkBright, letterSpacing: -0.4,
          }}>Choose a space model</h1>
          <p style={{
            margin: '8px 0 0', fontFamily: TN.fontUi, fontSize: 13,
            color: TN.inkMuted, lineHeight: 1.5, maxWidth: 560,
          }}>
            The space model is fixed once the scenario is ready to play-test or export.
            You can leave it unset while sketching, but every published scenario declares exactly one.
          </p>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32,
        }}>
          <SpaceCard id="square" active={space === 'square'} onClick={() => setSpace('square')}
            title="Square grid"
            desc="Integer coords. Discrete neighbors. Four- or eight-way adjacency."
            preview={<SquareBoard w={6} h={5} tilePx={18} showGrid
              markers={[{ x: 2, y: 2 }, { x: 4, y: 3 }]} />} />
          <SpaceCard id="hex" active={space === 'hex'} onClick={() => setSpace('hex')}
            title="Pointy-top hex"
            desc="Offset coords. Six-way adjacency. The wargame default."
            preview={<HexBoard cols={6} rows={5} size={12}
              markers={[{ x: 2, y: 1 }, { x: 3, y: 3 }]} />} />
          <SpaceCard id="free" active={space === 'free'} onClick={() => setSpace('free')}
            title="Free coordinate"
            desc="Floats, bearings, continuous distance. For miniatures-style play."
            preview={<FreeBoard width={240} height={180}
              markers={[{ x: 80, y: 90, bearing: 45 }, { x: 160, y: 60 }]} />} />
        </div>

        <div style={{
          border: `1px solid ${TN.line}`, borderRadius: 4,
          background: TN.bg1, padding: 20,
        }}>
          <div style={{
            fontFamily: TN.fontMono, fontSize: 10, color: TN.inkDim,
            letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
          }}>Scenario details</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Title">
              <Input value={title} onChange={setTitle} />
            </Field>
            <Field label="File">
              <Input value="atester1.fieldcraft.json" mono />
            </Field>
            {space !== 'free' && <>
              <Field label="Width"><NumInput value={w} onChange={setW} suffix="tiles" /></Field>
              <Field label="Height"><NumInput value={h} onChange={setH} suffix="tiles" /></Field>
              <Field label="Tile size"><NumInput value={tile} onChange={setTile} suffix="px" /></Field>
              <Field label="Distance per tile"><Input value="1 tile" mono /></Field>
            </>}
            {space === 'free' && <>
              <Field label="World width"><NumInput value={600} suffix="units" /></Field>
              <Field label="World height"><NumInput value={400} suffix="units" /></Field>
              <Field label="Distance unit"><Input value="meter" /></Field>
              <Field label="Bearing convention"><Input value="compass (0° = north)" /></Field>
            </>}
          </div>

          <div style={{
            marginTop: 18, paddingTop: 16, borderTop: `1px solid ${TN.line}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{
              fontFamily: TN.fontUi, fontSize: 12, color: TN.inkDim,
              display: 'flex', flexDirection: 'column', gap: 3,
            }}>
              <span>
                Assets will be imported to <span style={{ fontFamily: TN.fontMono, color: TN.inkMuted }}>
                assets/</span> beside the scenario file.
              </span>
              <span>
                Sides can be added later from the inspector's Scenario tab.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onCancel} style={{
                height: 32, padding: '0 16px', border: `1px solid ${TN.line}`, borderRadius: 3,
                background: 'transparent', color: TN.ink,
                fontFamily: TN.fontUi, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={onCreate} style={{
                height: 32, padding: '0 18px', border: `1px solid ${TN.accent}`, borderRadius: 3,
                background: TN.accent, color: TN.accentInk,
                fontFamily: TN.fontUi, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>Create scenario</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpaceCard({ active, onClick, title, desc, preview }) {
  const T = window.FC_TOKENS;
  return (
    <button onClick={onClick} style={{
      textAlign: 'left', border: `1px solid ${active ? T.accent : T.line}`, borderRadius: 4,
      background: active ? T.accentWash : T.bg1,
      padding: 0, cursor: 'pointer', overflow: 'hidden',
      boxShadow: active ? `0 0 0 3px ${T.accentWash}` : 'none',
      transition: 'all 120ms ease',
    }}>
      <div style={{
        height: 140, background: T.bg0, borderBottom: `1px solid ${T.line}`,
        display: 'grid', placeItems: 'center', padding: 16,
      }}>
        <div style={{ width: '100%', height: '100%' }}>{preview}</div>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
        }}>
          <span style={{
            fontFamily: T.fontUi, fontSize: 13, fontWeight: 600,
            color: active ? T.accent : T.inkBright,
          }}>{title}</span>
          {active && <Icons.Dot s={6} c={T.accent} />}
        </div>
        <div style={{
          fontFamily: T.fontUi, fontSize: 11, color: T.inkMuted, lineHeight: 1.45,
        }}>{desc}</div>
      </div>
    </button>
  );
}

function Field({ label, children }) {
  const T = window.FC_TOKENS;
  return (
    <div>
      <label style={{
        display: 'block', fontFamily: T.fontMono, fontSize: 9,
        letterSpacing: 1.2, textTransform: 'uppercase', color: T.inkDim,
        marginBottom: 6,
      }}>{label}</label>
      {children}
    </div>
  );
}

function NumInput({ value, onChange, suffix }) {
  const T = window.FC_TOKENS;
  return (
    <div style={{
      height: 28, display: 'flex', alignItems: 'center',
      border: `1px solid ${T.line}`, borderRadius: 3, background: T.bg0, overflow: 'hidden',
    }}>
      <input type="number" value={value} onChange={e => onChange && onChange(+e.target.value)}
        style={{
          flex: 1, minWidth: 0, height: '100%', border: 0, padding: '0 10px',
          background: 'transparent', color: T.ink,
          fontFamily: T.fontMono, fontSize: 11, outline: 'none',
        }} />
      {suffix && <span style={{
        padding: '0 10px', color: T.inkDim, fontFamily: T.fontMono, fontSize: 10,
        borderLeft: `1px solid ${T.line}`, height: '100%', display: 'grid', placeItems: 'center',
      }}>{suffix}</span>}
    </div>
  );
}

Object.assign(window, { NewScenarioScreen });
