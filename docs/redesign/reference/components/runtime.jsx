// Runtime preview screen — read-only view of the scenario with transport controls.

const TR = window.FC_TOKENS;

function RuntimeScreen() {
  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '260px 1fr',
      background: TR.bg0,
    }}>
      {/* LEFT — scenario brief / transport */}
      <div style={{
        borderRight: `1px solid ${TR.line}`, background: TR.bg1,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: 16, borderBottom: `1px solid ${TR.line}` }}>
          <div style={{
            fontFamily: TR.fontMono, fontSize: 9, color: TR.accent,
            letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 4,
          }}>Runtime · Read-only</div>
          <div style={{
            fontFamily: TR.fontUi, fontSize: 14, fontWeight: 600, color: TR.inkBright,
          }}>Untitled Fieldcraft Scenario</div>
        </div>

        <RailHeader>Scenario</RailHeader>
        <div style={{ padding: '4px 0' }}>
          <KV k="Space" v="square-grid" mono accent={TR.accent} />
          <KV k="Dimensions" v="8 × 8" mono />
          <KV k="Tile size" v="48px" mono />
          <KV k="Markers" v="2" mono />
        </div>

        <RailHeader>Turn</RailHeader>
        <div style={{ padding: '10px 12px' }}>
          <div style={{
            fontFamily: TR.fontMono, fontSize: 36, color: TR.inkBright, lineHeight: 1,
          }}>01</div>
          <div style={{
            fontFamily: TR.fontUi, fontSize: 11, color: TR.inkMuted, marginTop: 4,
          }}>of ∞ — plotted simultaneous</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginTop: 16 }}>
            <button style={{ ...miniBtn, height: 30, display: 'grid', placeItems: 'center' }}>
              ◀
            </button>
            <button style={{
              ...miniBtn, height: 30, borderColor: TR.accent, color: TR.accentInk,
              background: TR.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Icons.Play s={10} c={TR.accentInk} />
              <span>PLAY</span>
            </button>
            <button style={{ ...miniBtn, height: 30, display: 'grid', placeItems: 'center' }}>
              ▶
            </button>
          </div>
        </div>

        <RailHeader>Phases</RailHeader>
        <div style={{ padding: '4px 0' }}>
          <PhaseRow label="Orders" state="pending" idx="1" active />
          <PhaseRow label="Resolution" state="queued" idx="2" />
          <PhaseRow label="Report" state="queued" idx="3" />
        </div>

        <div style={{ flex: 1 }} />

        <RailHeader>Export status</RailHeader>
        <div style={{ padding: '8px 12px', display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icons.Dot s={6} c={TR.accent} />
            <span style={{ fontFamily: TR.fontUi, fontSize: 11, color: TR.inkMuted }}>
              Browser runtime ready
            </span>
          </div>
          <button style={{ ...miniBtn, height: 28 }}>Export browser bundle…</button>
        </div>
      </div>

      {/* CENTER — board */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{
          height: 36, padding: '0 16px', display: 'flex', alignItems: 'center',
          borderBottom: `1px solid ${TR.line}`, background: TR.bg1, gap: 10,
        }}>
          <span style={{
            fontFamily: TR.fontMono, fontSize: 10, letterSpacing: 1.4,
            textTransform: 'uppercase', color: TR.inkMuted,
          }}>Runtime View</span>
          <span style={{ color: TR.inkDim }}>·</span>
          <span style={{ fontFamily: TR.fontMono, fontSize: 11, color: TR.ink }}>
            read-only preview of authored state
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <ToolBtn icon={<Icons.Hand s={14} />} label="Pan" />
            <ToolBtn icon={<Icons.Minus s={12} />} label="Zoom out" />
            <ToolBtn icon={<Icons.Plus s={12} />} label="Zoom in" />
          </div>
        </div>

        <div style={{
          flex: 1, minHeight: 0,
          background: window.FC_TOKENS.stageGradient,
          display: 'grid', placeItems: 'center', padding: 40, position: 'relative',
        }}>
          <BoardDotGrid />
          <div style={{
            width: 'min(100%, 560px)', aspectRatio: '1/1',
            boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
          }}>
            <SquareBoard w={8} h={8} tilePx={48} checker
              markers={[
                { x: 2, y: 3, label: 'A' },
                { x: 5, y: 4, label: 'B' },
              ]} />
          </div>

          {/* HUD overlay bottom */}
          <div style={{
            position: 'absolute', bottom: 16, left: 40, right: 40,
            display: 'flex', justifyContent: 'space-between',
            padding: '8px 12px', borderRadius: 3,
            background: 'rgba(10,14,18,0.82)', backdropFilter: 'blur(8px)',
            border: `1px solid ${TR.line}`,
            fontFamily: TR.fontMono, fontSize: 10, color: TR.inkMuted, letterSpacing: 0.4,
          }}>
            <span>TURN <span style={{ color: TR.inkBright }}>01</span></span>
            <span>PHASE <span style={{ color: TR.accent }}>ORDERS</span></span>
            <span>ACTIVE UNITS <span style={{ color: TR.inkBright }}>2</span></span>
            <span>SPACE <span style={{ color: TR.inkBright }}>square-grid</span></span>
          </div>
        </div>

        <StatusBar
          left={[
            <span key="1">CURSOR <span style={{ color: TR.ink }}>x 4  y 2</span></span>,
            <span key="2">TURN <span style={{ color: TR.ink }}>01 · orders</span></span>,
          ]}
          right={[
            <span key="a">ZOOM <span style={{ color: TR.ink }}>100%</span></span>,
            <span key="b" style={{ color: TR.accent }}>● RUNTIME READY</span>,
          ]}
        />
      </div>
    </div>
  );
}

function PhaseRow({ label, state, idx, active }) {
  const T = window.FC_TOKENS;
  return (
    <div style={{
      padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10,
      background: active ? T.accentWash : 'transparent',
      borderLeft: `2px solid ${active ? T.accent : 'transparent'}`,
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: 2,
        border: `1px solid ${active ? T.accent : T.line}`,
        background: active ? T.accent : T.bg0,
        color: active ? T.accentInk : T.inkMuted,
        fontFamily: T.fontMono, fontSize: 10, display: 'grid', placeItems: 'center',
      }}>{idx}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: T.fontUi, fontSize: 12, color: T.ink }}>{label}</div>
        <div style={{
          fontFamily: T.fontMono, fontSize: 9, color: T.inkDim,
          textTransform: 'uppercase', letterSpacing: 0.6,
        }}>{state}</div>
      </div>
    </div>
  );
}

Object.assign(window, { RuntimeScreen });

// Subtle dot-grid backdrop for the runtime stage
function BoardDotGrid() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      backgroundImage: `radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)`,
      backgroundSize: '24px 24px',
      pointerEvents: 'none',
    }} />
  );
}
window.BoardDotGrid = BoardDotGrid;
