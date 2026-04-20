// Command palette — ⌘K overlay
const TP = window.FC_TOKENS;
const KP = window.FC_KEYS;

function CommandPalette({ onClose }) {
  const [q, setQ] = React.useState('');
  const commands = [
    { section: 'File', items: [
      { label: 'New Scenario…', kbd: `${KP.MOD}N` },
      { label: 'Open…', kbd: `${KP.MOD}O` },
      { label: 'Save', kbd: `${KP.MOD}S` },
      { label: 'Save As…', kbd: `${KP.SHIFT_MOD}S` },
      { label: 'Export Browser Runtime…' },
    ]},
    { section: 'Edit', items: [
      { label: 'Undo', kbd: `${KP.MOD}Z` }, { label: 'Redo', kbd: `${KP.SHIFT_MOD}Z` },
      { label: 'Delete Selection', kbd: KP.IS_MAC ? '⌫' : 'Del' },
    ]},
    { section: 'View', items: [
      { label: 'Reset View', kbd: '0' },
      { label: 'Zoom to Selection' },
      { label: 'Toggle Grid' }, { label: 'Toggle Rulers' },
    ]},
    { section: 'Assets', items: [
      { label: 'Import Image…' }, { label: 'Import Audio…' },
      { label: 'Open Asset Library' },
    ]},
  ];
  const filtered = commands
    .map(s => ({ ...s, items: s.items.filter(i => i.label.toLowerCase().includes(q.toLowerCase())) }))
    .filter(s => s.items.length);
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
      display: 'grid', placeItems: 'start center', paddingTop: '12vh',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 520, background: TP.bg2, border: `1px solid ${TP.lineStrong}`,
        borderRadius: 6, boxShadow: TP.shadow2, overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${TP.line}`,
          display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icons.Search s={14} c={TP.inkMuted} />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
            placeholder="Run a command…"
            style={{ flex: 1, border: 0, background: 'transparent', color: TP.inkBright,
              fontFamily: TP.fontUi, fontSize: 14, outline: 'none' }} />
          <span style={{ fontFamily: TP.fontMono, fontSize: 10, color: TP.inkDim }}>ESC</span>
        </div>
        <div style={{ maxHeight: 380, overflow: 'auto', padding: 6 }}>
          {filtered.map(s => (
            <div key={s.section}>
              <div style={{ padding: '8px 10px 4px', fontFamily: TP.fontMono,
                fontSize: 9, color: TP.inkDim, letterSpacing: 1, textTransform: 'uppercase' }}>
                {s.section}
              </div>
              {s.items.map((it, i) => (
                <div key={i} style={{
                  height: 30, padding: '0 10px', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', borderRadius: 3, cursor: 'pointer',
                  fontFamily: TP.fontUi, fontSize: 12, color: TP.ink,
                }}
                  onMouseEnter={e => e.currentTarget.style.background = TP.bg3}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span>{it.label}</span>
                  {it.kbd && <span style={{ fontFamily: TP.fontMono, fontSize: 10, color: TP.inkDim }}>{it.kbd}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

window.CommandPalette = CommandPalette;
