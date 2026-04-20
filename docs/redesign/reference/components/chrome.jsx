// Shared app chrome: title bar with traffic lights, menu bar, command bar, route switch

const TC = window.FC_TOKENS;

function TitleBar({ title = "Fieldcraft — Untitled Scenario" }) {
  return (
    <div style={{
      height: 28, background: TC.bg0, borderBottom: `1px solid ${TC.line}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', flex: '0 0 auto',
    }}>
      <div style={{ position: 'absolute', left: 10, display: 'flex', gap: 6 }}>
        {['#ff5f56', '#ffbd2e', '#27c93f'].map(c =>
          <div key={c} style={{ width: 11, height: 11, borderRadius: 999, background: c, opacity: 0.85 }} />
        )}
      </div>
      <span style={{
        color: TC.inkMuted, fontFamily: TC.fontUi, fontSize: 11, fontWeight: 500,
      }}>{title}</span>
    </div>
  );
}

const K = window.FC_KEYS;
const MENU_SHORTCUTS = {
  'Save':          `${K.MOD}S`,
  'Save As…':      `${K.SHIFT_MOD}S`,
  'Undo':          `${K.MOD}Z`,
  'Redo':          `${K.SHIFT_MOD}Z`,
  'New Scenario':  `${K.MOD}N`,
  'Open…':         `${K.MOD}O`,
};

function MenuBar({ theme, setTheme, route, setRoute, onOpenPalette, dirty }) {
  const [open, setOpen] = React.useState(null);
  const closeTimer = React.useRef(null);
  const menus = {
    File: ['New Scenario', 'Open…', '—', 'Save', 'Save As…', '—', 'Import Image…', 'Import Audio…', '—', 'Export Browser Runtime…'],
    Edit: ['Undo', 'Redo', '—', 'Cut', 'Copy', 'Paste', '—', 'Delete Selection', '—', 'Preferences…'],
    View: ['Zoom In', 'Zoom Out', 'Reset View', '—', 'Show Grid', 'Show Coordinates', 'Show Rulers'],
    Board: ['Edit Board Setup…', '—', 'Square Grid', 'Hex Grid', 'Free Coordinate'],
    Help: ['Keyboard Shortcuts', 'About Fieldcraft'],
  };

  return (
    <div style={{
      height: 32, padding: '0 8px',
      display: 'flex', alignItems: 'center', gap: 16,
      background: TC.bg1, borderBottom: `1px solid ${TC.line}`,
      flex: '0 0 auto', position: 'relative', zIndex: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <FcMark size={18} />
        <span style={{
          fontFamily: TC.fontUi, fontSize: 12, fontWeight: 600,
          color: TC.inkBright, letterSpacing: 0.1,
        }}>Fieldcraft</span>
        {dirty && <span style={{
          width: 6, height: 6, borderRadius: 999, background: TC.amber, marginLeft: 4,
        }} title="Unsaved changes" />}
      </div>

      <div style={{ display: 'flex', alignItems: 'center' }}>
        {Object.keys(menus).map(m => (
          <div key={m} style={{ position: 'relative' }}
            onMouseEnter={() => { clearTimeout(closeTimer.current); setOpen(m); }}
            onMouseLeave={() => { closeTimer.current = setTimeout(() => setOpen(null), 120); }}
          >
            <MenuTrigger label={m} active={open === m} onClick={() => setOpen(open === m ? null : m)} />
            {open === m && (
              <div style={{
                position: 'absolute', top: 28, left: 0, minWidth: 200,
                background: TC.bg2, border: `1px solid ${TC.lineStrong}`, borderRadius: 4,
                padding: 4, boxShadow: TC.shadow2, zIndex: 30,
              }}>
                {menus[m].map((item, i) => item === '—' ? (
                  <div key={i} style={{ height: 1, background: TC.line, margin: '4px 6px' }} />
                ) : (
                  <div key={i} style={{
                    height: 26, padding: '0 10px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderRadius: 3, fontFamily: TC.fontUi, fontSize: 12, color: TC.ink, cursor: 'pointer',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = TC.bg3; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span>{item}</span>
                    {MENU_SHORTCUTS[item] && <span style={{ color: TC.inkDim, fontFamily: TC.fontMono, fontSize: 10 }}>{MENU_SHORTCUTS[item]}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* command palette button — the one new affordance */}
      <button onClick={onOpenPalette} style={{
        height: 22, padding: '0 8px', display: 'flex', alignItems: 'center', gap: 6,
        border: `1px solid ${TC.line}`, borderRadius: 3, background: TC.bg0,
        color: TC.inkMuted, fontFamily: TC.fontUi, fontSize: 11, cursor: 'pointer',
      }}>
        <Icons.Search s={11} />
        <span>Search commands</span>
        <span style={{ fontFamily: TC.fontMono, fontSize: 10, opacity: 0.7, marginLeft: 6 }}>{`${K.MOD}K`}</span>
      </button>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Seg
          options={[
            { value: 'system', label: 'System', icon: <Icons.Monitor s={12} />, hideLabel: true },
            { value: 'light',  label: 'Light',  icon: <Icons.Sun s={12} />,     hideLabel: true },
            { value: 'dark',   label: 'Dark',   icon: <Icons.Moon s={12} />,    hideLabel: true },
          ]}
          value={theme} onChange={setTheme}
        />
        <Seg
          options={[
            { value: 'editor',  label: 'Editor',  icon: <Icons.Edit s={12} /> },
            { value: 'runtime', label: 'Runtime', icon: <Icons.PlayTriangle s={11} /> },
          ]}
          value={route} onChange={setRoute}
        />
      </div>
    </div>
  );
}

function CommandBar({ children }) {
  return (
    <div style={{
      height: 40, padding: '0 8px',
      display: 'flex', alignItems: 'center', gap: 6,
      background: TC.bg1, borderBottom: `1px solid ${TC.line}`,
      flex: '0 0 auto',
    }}>{children}</div>
  );
}

function StatusBar({ left, right }) {
  return (
    <div style={{
      height: 22, padding: '0 10px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: TC.bg1, borderTop: `1px solid ${TC.line}`,
      color: TC.inkMuted, fontFamily: TC.fontMono, fontSize: 10, letterSpacing: 0.3,
      flex: '0 0 auto',
    }}>
      <div style={{ display: 'flex', gap: 16 }}>{left}</div>
      <div style={{ display: 'flex', gap: 16 }}>{right}</div>
    </div>
  );
}

Object.assign(window, { TitleBar, MenuBar, CommandBar, StatusBar });
