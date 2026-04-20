// Shared primitive UI pieces used across all editor variants

const T = window.FC_TOKENS;

// Platform-aware modifier key. Mac users see ⌘, everyone else sees Ctrl.
const IS_MAC = typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
const MOD = IS_MAC ? '⌘' : 'Ctrl+';
const SHIFT_MOD = IS_MAC ? '⇧⌘' : 'Ctrl+Shift+';
window.FC_KEYS = { IS_MAC, MOD, SHIFT_MOD };

// Brand mark — thin bracket with FC
function FcMark({ size = 20 }) {
  const s = size;
  return (
    <div style={{
      width: s, height: s, display: 'inline-grid', placeItems: 'center',
      border: `1px solid ${T.accent}`, borderRadius: 2,
      fontFamily: T.fontMono, fontSize: s * 0.45, fontWeight: 600,
      color: T.accent, letterSpacing: -0.5,
    }}>FC</div>
  );
}

// Tiny app-bar menu button ("File", "Edit"...)
function MenuTrigger({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      height: 26, padding: '0 10px', border: 0, borderRadius: 3,
      background: active ? T.bg3 : 'transparent',
      color: active ? T.inkBright : T.ink,
      fontFamily: T.fontUi, fontSize: 12, fontWeight: 500,
      letterSpacing: 0.1, cursor: 'pointer',
    }}>{label}</button>
  );
}

// Command bar button (Undo / Save / etc)
function CmdBtn({ label, kbd, disabled, primary, onClick, title, icon, iconOnly }) {
  const [hover, setHover] = React.useState(false);
  const bg = disabled
    ? 'transparent'
    : primary
      ? (hover ? T.accent : T.accentWash)
      : (hover ? T.bg3 : 'transparent');
  const fg = disabled ? T.inkDim : primary ? (hover ? T.accentInk : T.accent) : T.ink;
  const border = primary
    ? `1px solid ${T.accent}`
    : `1px solid ${hover && !disabled ? T.lineStrong : T.line}`;
  return (
    <button
      title={title || (kbd ? `${label}   ${kbd}` : label)}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 28,
        padding: iconOnly ? 0 : '0 10px',
        width: iconOnly ? 30 : undefined,
        justifyContent: iconOnly ? 'center' : undefined,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        border, borderRadius: 4, background: bg, color: fg,
        fontFamily: T.fontUi, fontSize: 12, fontWeight: 500,
        cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap',
      }}
    >
      {icon && <span style={{ opacity: 0.85, display: 'inline-flex' }}>{icon}</span>}
      {!iconOnly && <span>{label}</span>}
      {!iconOnly && kbd && <span style={{
        marginLeft: 2, color: T.inkDim, fontFamily: T.fontMono, fontSize: 10,
      }}>{kbd}</span>}
    </button>
  );
}

// Segmented control — for route switch, theme switch, etc.
// Option shape: { value, label, icon? (element), hideLabel? (bool) }
function Seg({ options, value, onChange }) {
  return (
    <div style={{
      display: 'inline-flex', border: `1px solid ${T.line}`,
      borderRadius: 4, overflow: 'hidden', background: T.bg2,
    }}>
      {options.map((o, i) => {
        const active = o.value === value;
        const showLabel = !o.hideLabel;
        return (
          <button key={o.value} onClick={() => onChange(o.value)}
            title={o.hideLabel ? o.label : undefined}
            style={{
              height: 26, padding: showLabel ? '0 10px' : 0,
              width: showLabel ? undefined : 30,
              border: 0,
              borderLeft: i === 0 ? 0 : `1px solid ${T.line}`,
              background: active ? T.accentWash : 'transparent',
              color: active ? T.accent : T.ink,
              fontFamily: T.fontUi, fontSize: 11, fontWeight: 600,
              letterSpacing: 0.3, textTransform: 'uppercase', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
            {o.icon && <span style={{ display: 'inline-flex' }}>{o.icon}</span>}
            {showLabel && <span>{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

// Section header in a rail / panel
function RailHeader({ children, right }) {
  return (
    <div style={{
      height: 28, padding: '0 12px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: `1px solid ${T.line}`,
      background: T.bg1,
    }}>
      <span style={{
        fontFamily: T.fontMono, fontSize: 10, fontWeight: 600,
        letterSpacing: 1.4, textTransform: 'uppercase', color: T.inkMuted,
      }}>{children}</span>
      {right && <div style={{ display: 'flex', gap: 4 }}>{right}</div>}
    </div>
  );
}

// Generic labeled row (key: value)
function KV({ k, v, mono, accent }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12,
      padding: '6px 12px',
      fontFamily: T.fontUi, fontSize: 12,
    }}>
      <span style={{ color: T.inkMuted }}>{k}</span>
      <span style={{
        color: accent || T.inkBright,
        fontFamily: mono ? T.fontMono : T.fontUi,
        fontSize: mono ? 11 : 12,
        textAlign: 'right',
      }}>{v}</span>
    </div>
  );
}

// Input field
function Input({ value, onChange, mono, placeholder }) {
  return (
    <input
      value={value}
      onChange={e => onChange && onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', height: 28, padding: '0 10px',
        border: `1px solid ${T.line}`, borderRadius: 3,
        background: T.bg0, color: T.ink,
        fontFamily: mono ? T.fontMono : T.fontUi,
        fontSize: mono ? 11 : 12, outline: 'none',
      }}
      onFocus={e => e.target.style.borderColor = T.accent}
      onBlur={e => e.target.style.borderColor = T.line}
    />
  );
}

// Tool/icon button (square)
function ToolBtn({ icon, label, active, onClick, kbd, disabled }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      title={kbd ? `${label}   ${kbd}` : label}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 32, height: 32, display: 'grid', placeItems: 'center',
        border: `1px solid ${active && !disabled ? T.accent : (hover && !disabled ? T.lineStrong : 'transparent')}`,
        borderRadius: 3,
        background: active && !disabled ? T.accentWash : (hover && !disabled ? T.bg3 : 'transparent'),
        color: disabled ? T.inkDim : (active ? T.accent : T.ink),
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
      }}
    >
      {icon}
      {disabled && (
        <span style={{
          position: 'absolute', top: 2, right: 2,
          width: 4, height: 4, borderRadius: '50%',
          background: T.inkDim,
        }} />
      )}
    </button>
  );
}

// Tiny inline icons (drawn in JSX so we can tint)
const Icons = {
  Cursor: ({ s = 14, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.3">
      <path d="M3 2l10 6-4.5 1.2L6.5 14z" />
    </svg>
  ),
  Marker: ({ s = 14, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.3">
      <circle cx="8" cy="8" r="4.5" />
    </svg>
  ),
  Ruler: ({ s = 14, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.3">
      <path d="M1.5 11l9.5-9.5 3.5 3.5L5 14.5z" />
      <path d="M3.5 9l1.5 1.5M6 6.5L7.5 8M8.5 4L10 5.5" />
    </svg>
  ),
  Hand: ({ s = 14, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.3">
      <path d="M5 8V3.5a1 1 0 0 1 2 0V7M7 7V2.5a1 1 0 0 1 2 0V7M9 7V3a1 1 0 0 1 2 0v5M11 6.5a1 1 0 0 1 2 0V11c0 2.5-2 3.5-4 3.5s-3.5-.5-4.5-2L3 10c-.5-1 .5-1.5 1-1.2L5 10" />
    </svg>
  ),
  Plus: ({ s = 12, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 12 12" fill="none" stroke={c} strokeWidth="1.4">
      <path d="M6 2v8M2 6h8" />
    </svg>
  ),
  Minus: ({ s = 12, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 12 12" fill="none" stroke={c} strokeWidth="1.4">
      <path d="M2 6h8" />
    </svg>
  ),
  Undo: ({ s = 12, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 12 12" fill="none" stroke={c} strokeWidth="1.3">
      <path d="M4 3L1.5 5.5 4 8M1.5 5.5h6a3 3 0 0 1 0 6H6" />
    </svg>
  ),
  Redo: ({ s = 12, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 12 12" fill="none" stroke={c} strokeWidth="1.3">
      <path d="M8 3l2.5 2.5L8 8M10.5 5.5h-6a3 3 0 0 0 0 6H6" />
    </svg>
  ),
  Play: ({ s = 12, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 12 12" fill={c} stroke="none">
      <path d="M3 2l7 4-7 4z" />
    </svg>
  ),
  File: ({ s = 12, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 12 12" fill="none" stroke={c} strokeWidth="1.2">
      <path d="M2.5 1.5h5L9.5 3.5v7h-7z" />
      <path d="M7.5 1.5v2h2" />
    </svg>
  ),
  FilePlus: ({ s = 12, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none" stroke={c} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round">
      <path d="M3 1.5h5l2.5 2.5V12.5H3z" />
      <path d="M8 1.5V4h2.5" />
      <path d="M6.5 6.5v4M4.5 8.5h4" />
    </svg>
  ),
  FolderOpen: ({ s = 12, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none" stroke={c} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round">
      <path d="M1.5 3.5V11.5h10l1.5-5.5H3.5L1.5 11.5" />
      <path d="M1.5 3.5h4l1.3 1.3h5v1.2" />
    </svg>
  ),
  Save: ({ s = 12, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none" stroke={c} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round">
      <path d="M1.8 1.8h8.3l2.1 2.1V12.2H1.8z" />
      <path d="M3.8 1.8v3h5v-3" />
      <rect x="3.8" y="7.5" width="6.4" height="4.7" />
    </svg>
  ),
  SaveAs: ({ s = 12, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none" stroke={c} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round">
      <path d="M1.8 1.8h6.3l2.1 2.1v4.6" />
      <path d="M1.8 1.8V12.2h5" />
      <path d="M3.8 1.8v3h4" />
      <path d="M8.8 11.8l3-3 1.2 1.2-3 3H8.8z" />
    </svg>
  ),
  Library: ({ s = 12, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none" stroke={c} strokeWidth="1.2" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="5" height="5" />
      <rect x="7.5" y="1.5" width="5" height="5" />
      <rect x="1.5" y="7.5" width="5" height="5" />
      <rect x="7.5" y="7.5" width="5" height="5" />
    </svg>
  ),
  Search: ({ s = 12, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 12 12" fill="none" stroke={c} strokeWidth="1.3">
      <circle cx="5" cy="5" r="3.2" />
      <path d="M7.5 7.5L10 10" />
    </svg>
  ),
  Image: ({ s = 12, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 12 12" fill="none" stroke={c} strokeWidth="1.2">
      <rect x="1.5" y="2.5" width="9" height="7" rx="1" />
      <circle cx="4" cy="5" r="0.8" fill={c} />
      <path d="M2 9l2.5-2.5 2 2L8 7l2.5 2" />
    </svg>
  ),
  Audio: ({ s = 12, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 12 12" fill="none" stroke={c} strokeWidth="1.2">
      <path d="M2 4.5v3h2l3 2.5v-8l-3 2.5H2z" />
      <path d="M9 4c1 1 1 3 0 4" />
    </svg>
  ),
  Chevron: ({ s = 10, c = 'currentColor', dir = 'right' }) => {
    const r = { right: 0, down: 90, left: 180, up: 270 }[dir];
    return (
      <svg width={s} height={s} viewBox="0 0 10 10" style={{ transform: `rotate(${r}deg)` }}>
        <path d="M3.5 2l3 3-3 3" fill="none" stroke={c} strokeWidth="1.3" />
      </svg>
    );
  },
  Close: ({ s = 10, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 10 10" fill="none" stroke={c} strokeWidth="1.3">
      <path d="M2 2l6 6M8 2l-6 6" />
    </svg>
  ),
  Dot: ({ s = 8, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill={c} /></svg>
  ),
  Sun: ({ s = 12, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none" stroke={c} strokeWidth="1.3" strokeLinecap="round">
      <circle cx="7" cy="7" r="2.6" />
      <path d="M7 1.2v1.5M7 11.3v1.5M1.2 7h1.5M11.3 7h1.5M2.9 2.9l1 1M10.1 10.1l1 1M2.9 11.1l1-1M10.1 3.9l1-1" />
    </svg>
  ),
  Moon: ({ s = 12, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none" stroke={c} strokeWidth="1.3" strokeLinejoin="round">
      <path d="M11.5 8.5A5 5 0 0 1 5.5 2.5a5 5 0 1 0 6 6z" />
    </svg>
  ),
  Monitor: ({ s = 12, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none" stroke={c} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round">
      <rect x="1.5" y="2" width="11" height="7.5" rx="1" />
      <path d="M5 11.5h4M7 9.5v2" />
    </svg>
  ),
  Edit: ({ s = 12, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none" stroke={c} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round">
      <path d="M2 10.5L2 12h1.5l7-7-1.5-1.5z" />
      <path d="M9 4l1.5 1.5" />
    </svg>
  ),
  PlayTriangle: ({ s = 11, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 12 12" fill={c}>
      <path d="M3 2.2l6.5 3.8L3 9.8z" />
    </svg>
  ),
};

Object.assign(window, {
  FcMark, MenuTrigger, CmdBtn, Seg, RailHeader, KV, Input, ToolBtn, Icons,
});

// Shared mini-button styles used by source editor, asset library, runtime controls.
// Getters read current FC_TOKENS so theme swaps apply on re-render.
Object.defineProperty(window, 'miniBtn', {
  configurable: true,
  get() {
    const T = window.FC_TOKENS;
    return {
      height: 26, padding: '0 10px', border: `1px solid ${T.line}`,
      borderRadius: 3, background: T.bg2, color: T.ink,
      fontFamily: T.fontUi, fontSize: 11, fontWeight: 500, cursor: 'pointer',
    };
  },
});
Object.defineProperty(window, 'miniGhost', {
  configurable: true,
  get() {
    const T = window.FC_TOKENS;
    return {
      ...window.miniBtn, background: 'transparent', color: T.inkMuted,
    };
  },
});
