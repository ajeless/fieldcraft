// Main editor — board fills the stage, floating inspector on the right,
// collapsed icon tool rail on the left, status bar along the bottom.

const TB = window.FC_TOKENS;
const KB = window.FC_KEYS;

function EditorScreen({ dirty, scenario, onOpenLibrary }) {
  const s = scenario;
  const [tool, setTool] = React.useState('select');
  const [inspectorTab, setInspectorTab] = React.useState('scenario');
  const [selected, setSelected] = React.useState({ x: 5, y: 4, id: 'm-002', assetId: 'token-red', sideId: 'kli' });
  const [cursor, setCursor] = React.useState({ x: 4, y: 2 });
  const [zoom, setZoom] = React.useState(100);
  const [tilePx, setTilePx] = React.useState(48);
  const [armedAsset, setArmedAsset] = React.useState(null);
  const [inspectorCollapsed, setInspectorCollapsed] = React.useState(false);
  const [boardSetupOpen, setBoardSetupOpen] = React.useState(false);
  const [sourceExpanded, setSourceExpanded] = React.useState(false);

  // When a marker is selected, auto-switch to Selection tab unless Source is pinned open
  React.useEffect(() => {
    if (selected && inspectorTab === 'scenario') setInspectorTab('selection');
  }, [selected]);

  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
      background: TB.bg0, position: 'relative',
    }}>
      {/* STAGE */}
      <div style={{
        flex: 1, minHeight: 0, display: 'flex', position: 'relative',
        background: TB.stageGradient,
      }}>
        {/* Left tool rail */}
        <ToolRail tool={tool} setTool={setTool} />

        {/* Board stage */}
        <div data-stage-root style={{
          flex: 1, minWidth: 0, minHeight: 0,
          padding: '24px 40px',
          position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <StageRulers cursor={cursor} w={8} h={8} />
          <BoardFit max={560}>
            <div
              data-board-stage
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const gx = Math.max(0, Math.min(7, Math.floor((e.clientX - r.left) / (r.width / 8))));
                const gy = Math.max(0, Math.min(7, Math.floor((e.clientY - r.top) / (r.height / 8))));
                setCursor({ x: gx, y: gy });
              }}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const gx = Math.max(0, Math.min(7, Math.floor((e.clientX - r.left) / (r.width / 8))));
                const gy = Math.max(0, Math.min(7, Math.floor((e.clientY - r.top) / (r.height / 8))));
                const hit = s.markers.find(m => m.x === gx && m.y === gy);
                if (hit) setSelected({ x: gx, y: gy, id: `m-${String(s.markers.indexOf(hit) + 1).padStart(3, '0')}`, assetId: selected?.assetId || 'token-red', sideId: hit.sideId || null });
                else setSelected(null);
              }}
              style={{
                width: '100%', height: '100%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)',
                position: 'relative', cursor: 'crosshair',
              }}
            >
              <SquareBoard
                w={8} h={8} tilePx={tilePx} checker
                markers={s.markers.map((m, i) => {
                  const side = (s.sides || []).find(sd => sd.id === m.sideId);
                  return {
                    ...m,
                    sideColor: side ? side.color : null,
                    selected: selected && selected.x === m.x && selected.y === m.y,
                  };
                })}
                highlight={selected ? { x: selected.x, y: selected.y } : null}
              />
            </div>
          </BoardFit>

          {/* Floating readout — bottom-left of stage. Editable zoom and tile size. */}
          <div style={{
            position: 'absolute', bottom: 16, left: 60,
            padding: '3px 6px', borderRadius: 3,
            background: TB.overlayBg, border: `1px solid ${TB.line}`,
            backdropFilter: 'blur(8px)',
            fontFamily: TB.fontMono, fontSize: 10, color: TB.inkMuted,
            letterSpacing: 0.4, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ padding: '0 4px' }}>ZOOM</span>
            <StageInput value={zoom} onChange={(v) => setZoom(Math.max(25, Math.min(400, v)))} suffix="%" width={44} />
            <span style={{ color: TB.inkDim, padding: '0 2px' }}>·</span>
            <button onClick={() => setBoardSetupOpen(true)} title="Edit board setup" style={{
              padding: '0 4px', border: 0, background: 'transparent',
              color: TB.inkMuted, cursor: 'pointer',
              fontFamily: TB.fontMono, fontSize: 10, letterSpacing: 0.4,
            }}>8×8 <span style={{ color: TB.ink }}>SQUARE</span></button>
            <span style={{ color: TB.inkDim, padding: '0 2px' }}>·</span>
            <span style={{ padding: '0 4px' }}>TILE</span>
            <StageInput value={tilePx} onChange={(v) => setTilePx(Math.max(16, Math.min(120, v)))} suffix="PX" width={44} />
          </div>

          {/* Fit-to-view floating control — bottom-right of stage */}
          <div style={{
            position: 'absolute', bottom: 16, right: 16,
            display: 'flex', gap: 4,
          }}>
            <FloatBtn title="Zoom out" onClick={() => setZoom(z => Math.max(25, z - 10))}><Icons.Minus s={12} /></FloatBtn>
            <FloatBtn title="Fit to view" onClick={() => setZoom(100)}>FIT</FloatBtn>
            <FloatBtn title="Zoom in" onClick={() => setZoom(z => Math.min(400, z + 10))}><Icons.Plus s={12} /></FloatBtn>
          </div>
        </div>

        {/* Docked inspector rail / collapse toggle */}
        {inspectorCollapsed ? (
          <button
            onClick={() => setInspectorCollapsed(false)}
            title="Expand inspector"
            style={{
              width: 18, flex: '0 0 auto',
              background: TB.bg1, borderLeft: `1px solid ${TB.line}`,
              color: TB.inkMuted, cursor: 'pointer', border: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="8" height="10" viewBox="0 0 8 10" fill="none" stroke="currentColor" strokeWidth="1.3">
              <path d="M5 2L2 5l3 3" />
            </svg>
          </button>
        ) : (
          <div style={{
            width: sourceExpanded && inspectorTab === 'source' ? 640 : 340,
            flex: '0 0 auto',
            background: TB.bg1, borderLeft: `1px solid ${TB.line}`,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            transition: 'width 140ms ease',
          }}>
            <div style={{
              display: 'flex', borderBottom: `1px solid ${TB.line}`,
              background: TB.bg1, alignItems: 'stretch',
            }}>
              {[
                { id: 'scenario', label: 'Scenario' },
                { id: 'selection', label: `Selection${selected ? ' · 1' : ''}` },
                { id: 'assets', label: 'Assets' },
                { id: 'source', label: 'Source' },
              ].map(t => (
                <button key={t.id} onClick={() => setInspectorTab(t.id)} style={{
                  flex: 1, height: 34, border: 0,
                  borderBottom: `2px solid ${inspectorTab === t.id ? TB.accent : 'transparent'}`,
                  background: 'transparent',
                  color: inspectorTab === t.id ? TB.accent : TB.inkMuted,
                  fontFamily: TB.fontUi, fontSize: 11, fontWeight: 600,
                  letterSpacing: 0.5, textTransform: 'uppercase', cursor: 'pointer',
                }}>{t.label}</button>
              ))}
              <button
                onClick={() => setInspectorCollapsed(true)}
                title="Collapse inspector"
                style={{
                  width: 26, border: 0, background: 'transparent',
                  color: TB.inkMuted, cursor: 'pointer',
                  display: 'grid', placeItems: 'center',
                  borderLeft: `1px solid ${TB.line}`,
                }}
              >
                <svg width="8" height="10" viewBox="0 0 8 10" fill="none" stroke="currentColor" strokeWidth="1.3">
                  <path d="M3 2l3 3-3 3" />
                </svg>
              </button>
            </div>

            {inspectorTab === 'scenario' && <ScenarioTab s={s} onEditBoard={() => setBoardSetupOpen(true)} />}
            {inspectorTab === 'selection' && (
              selected
                ? <SelectionTab selected={selected} sides={s.sides || []}
                    onClear={() => setSelected(null)}
                    onChangeAsset={() => { setInspectorTab('assets'); }}
                    onChangeSide={({ sideId, addNew }) => {
                      if (addNew) {
                        // Generate a new side with an unused palette color; seed into scenario
                        const palette = ['#5ea7e0','#e06a5e','#e6a85c','#5ed0a0','#b78ee6','#e08ebf'];
                        const used = new Set((s.sides || []).map(sd => sd.color));
                        const color = palette.find(c => !used.has(c)) || palette[0];
                        const id = 'side-' + Math.random().toString(36).slice(2, 6);
                        const side = { id, label: addNew, color };
                        s.sides = [...(s.sides || []), side];
                        setSelected(sel => ({ ...sel, sideId: id }));
                      } else {
                        setSelected(sel => ({ ...sel, sideId }));
                      }
                    }}
                    onOpenLibrary={onOpenLibrary} />
                : <EmptySelection onOpenLibrary={onOpenLibrary} />
            )}
            {inspectorTab === 'assets' && (
              <AssetsPickerTab selected={selected}
                onPick={(id) => setSelected(sel => sel ? { ...sel, assetId: id } : sel)}
                onOpenLibrary={onOpenLibrary} />
            )}
            {inspectorTab === 'source' && (
              <SourceTab
                expanded={sourceExpanded}
                onToggleExpand={() => setSourceExpanded(e => !e)}
              />
            )}
          </div>
        )}
      </div>

      <AssetStrip
        tool={tool}
        activeAssetId={armedAsset}
        onPick={setArmedAsset}
        onOpenLibrary={onOpenLibrary}
      />

      <StatusBar
        left={[
          <span key="cur">CURSOR <span style={{ color: TB.ink }}>
            x {String(cursor.x).padStart(2, '0')}  y {String(cursor.y).padStart(2, '0')}
          </span></span>,
          <span key="tool">TOOL <span style={{ color: TB.accent }}>{tool.toUpperCase()}</span></span>,
          <span key="space">SPACE <span style={{ color: TB.ink }}>square-grid</span></span>,
          <span key="sel">SEL <span style={{ color: selected ? TB.ink : TB.inkDim }}>
            {selected ? '1 marker' : '—'}
          </span></span>,
        ]}
        right={[
          <span key="a">{s.markers.length} markers · {s.assets} asset</span>,
          <span key="b" style={{ color: TB.amber }}>● UNSAVED — RECOVERED DRAFT</span>,
          <span key="c" style={{ color: TB.inkDim }}>{`${KB.MOD}S`} SAVE</span>,
        ]}
      />

      {boardSetupOpen && (
        <BoardSetupModal s={s} onClose={() => setBoardSetupOpen(false)} />
      )}
    </div>
  );
}

// Coordinate rulers overlay for the stage — shows column letters (A..H) across
// the top and row numbers (1..N) down the left, highlighting the current cursor
// position. Positions itself by observing the board wrapper's bounds.
function StageRulers({ cursor, w = 8, h = 8, space = 'square-grid' }) {
  const T = window.FC_TOKENS;
  const [rect, setRect] = React.useState(null);
  React.useEffect(() => {
    const measure = () => {
      const board = document.querySelector('[data-board-stage]');
      const stage = board?.closest('[data-stage-root]');
      if (!board || !stage) return;
      const b = board.getBoundingClientRect();
      const s = stage.getBoundingClientRect();
      setRect({
        left: b.left - s.left,
        top: b.top - s.top,
        width: b.width,
        height: b.height,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    const board = document.querySelector('[data-board-stage]');
    if (board) ro.observe(board);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [w, h]);

  if (!rect) return null;
  const tileW = rect.width / w;
  const tileH = rect.height / h;
  const cols = Array.from({ length: w }, (_, i) => String.fromCharCode(65 + i));
  const rows = Array.from({ length: h }, (_, i) => i + 1);

  const cell = {
    fontFamily: T.fontMono, fontSize: 9, color: T.inkDim,
    letterSpacing: 0.6, display: 'grid', placeItems: 'center',
    userSelect: 'none',
  };
  const hit = {
    color: T.accent, fontWeight: 700,
  };

  return (
    <>
      {/* Top ruler (columns) */}
      <div style={{
        position: 'absolute', top: rect.top - 18, left: rect.left, width: rect.width, height: 16,
        display: 'grid', gridTemplateColumns: `repeat(${w}, 1fr)`,
        pointerEvents: 'none',
      }}>
        {cols.map((c, i) => (
          <div key={c} style={{ ...cell, ...(cursor?.x === i ? hit : {}) }}>{c}</div>
        ))}
      </div>
      {/* Left ruler (rows) */}
      <div style={{
        position: 'absolute', top: rect.top, left: rect.left - 18, width: 16, height: rect.height,
        display: 'grid', gridTemplateRows: `repeat(${h}, 1fr)`,
        pointerEvents: 'none',
      }}>
        {rows.map((r, i) => (
          <div key={r} style={{ ...cell, ...(cursor?.y === i ? hit : {}) }}>{r}</div>
        ))}
      </div>
    </>
  );
}

// Modal overlay for editing board setup (space model + dimensions + tile).
// Non-functional chrome — values reset on close — but shows the shape of the flow.
function BoardSetupModal({ s, onClose }) {
  const T = window.FC_TOKENS;
  const [model, setModel] = React.useState('square-grid');
  const [w, setW] = React.useState(s.w);
  const [h, setH] = React.useState(s.h);
  const [tile, setTile] = React.useState(s.tile);
  const [scale, setScale] = React.useState(s.scale);
  const [unit, setUnit] = React.useState(s.unit);

  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
      display: 'grid', placeItems: 'center',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 480, background: T.bg1,
        border: `1px solid ${T.lineStrong}`, borderRadius: 4,
        boxShadow: T.shadow2, overflow: 'hidden',
      }}>
        <div style={{
          padding: '10px 14px', borderBottom: `1px solid ${T.line}`,
          background: T.bg2, display: 'flex', alignItems: 'center',
        }}>
          <span style={{
            fontFamily: T.fontMono, fontSize: 10, letterSpacing: 1.2,
            textTransform: 'uppercase', color: T.accent,
          }}>Edit Board Setup</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{
            width: 22, height: 22, border: `1px solid ${T.line}`, borderRadius: 3,
            background: 'transparent', color: T.inkMuted, cursor: 'pointer',
            display: 'grid', placeItems: 'center',
          }}><Icons.Close s={9} /></button>
        </div>

        <div style={{ padding: 14, display: 'grid', gap: 12 }}>
          <div>
            <label style={miniLabelCss}>Space model</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {[
                { id: 'square-grid', label: 'Square grid' },
                { id: 'hex-grid',    label: 'Hex grid', comingSoon: true },
                { id: 'free',        label: 'Free', comingSoon: true },
              ].map(m => {
                const active = model === m.id;
                const disabled = m.comingSoon;
                return (
                  <button key={m.id} disabled={disabled}
                    onClick={() => !disabled && setModel(m.id)} style={{
                      height: 32, padding: '0 8px',
                      border: `1px solid ${active ? T.accent : T.line}`, borderRadius: 3,
                      background: active ? T.accentWash : T.bg2,
                      color: disabled ? T.inkDim : (active ? T.accent : T.ink),
                      opacity: disabled ? 0.5 : 1,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      fontFamily: T.fontUi, fontSize: 11, fontWeight: 500,
                    }}>{m.label}{disabled ? ' · soon' : ''}</button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MiniField label="Width (tiles)"  value={w} />
            <MiniField label="Height (tiles)" value={h} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <MiniField label="Tile (px)" value={tile} />
            <MiniField label="Scale"     value={scale} />
            <div>
              <label style={miniLabelCss}>Unit</label>
              <Input value={unit} />
            </div>
          </div>

          <div style={{
            padding: 10, borderRadius: 3, background: T.bg0, border: `1px solid ${T.line}`,
            fontFamily: T.fontUi, fontSize: 11, color: T.inkMuted, lineHeight: 1.5,
          }}>
            Changing the space model will migrate existing markers by snapping
            each to its nearest cell in the new coordinate system. This can be undone.
          </div>
        </div>

        <div style={{
          padding: '10px 14px', borderTop: `1px solid ${T.line}`, background: T.bg2,
          display: 'flex', gap: 6, justifyContent: 'flex-end',
        }}>
          <button onClick={onClose} style={{
            height: 28, padding: '0 14px', borderRadius: 3,
            border: `1px solid ${T.line}`, background: 'transparent', color: T.ink,
            fontFamily: T.fontUi, fontSize: 11, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={onClose} style={{
            height: 28, padding: '0 14px', borderRadius: 3,
            border: `1px solid ${T.accent}`, background: T.accent, color: T.bg0,
            fontFamily: T.fontUi, fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>Apply changes</button>
        </div>
      </div>
    </div>
  );
}

// Square box sized to the smaller of parent width/height, capped at `max`.
// ResizeObserver keeps it responsive when the strip is toggled.
function BoardFit({ children, max = 560 }) {
  const ref = React.useRef(null);
  const [size, setSize] = React.useState(max);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;
    const measure = () => {
      const cs = getComputedStyle(parent);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const w = parent.clientWidth - padX;
      const h = parent.clientHeight - padY;
      setSize(Math.max(80, Math.min(w, h, max)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [max]);
  return (
    <div ref={ref} style={{ width: size, height: size, position: 'relative' }}>
      {children}
    </div>
  );
}

function ToolRail({ tool, setTool }) {
  const tools = [
    { id: 'select', icon: <Icons.Cursor s={16} />, label: 'Select', kbd: 'V' },
    { id: 'marker', icon: <Icons.Marker s={16} />, label: 'Place marker', kbd: 'M' },
    { id: 'ruler', icon: <Icons.Ruler s={16} />, label: 'Ruler', kbd: 'R', comingSoon: true },
    { id: 'hand', icon: <Icons.Hand s={16} />, label: 'Pan', kbd: 'H', comingSoon: true },
  ];
  return (
    <div style={{
      width: 44, flex: '0 0 auto',
      background: TB.bg1, borderRight: `1px solid ${TB.line}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '8px 0', gap: 2,
    }}>
      {tools.map(t => (
        <ToolBtn
          key={t.id}
          icon={t.icon}
          label={t.comingSoon ? `${t.label} (coming soon)` : t.label}
          kbd={t.kbd}
          active={tool === t.id}
          disabled={t.comingSoon}
          onClick={() => { if (!t.comingSoon) setTool(t.id); }}
        />
      ))}
      <div style={{ flex: 1 }} />
    </div>
  );
}

function FloatBtn({ children, title, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button title={title} onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        minWidth: 30, height: 26, padding: '0 8px',
        background: hover ? TB.bg3 : TB.overlayBg,
        border: `1px solid ${hover ? TB.lineStrong : TB.line}`,
        borderRadius: 3, color: TB.ink, cursor: 'pointer',
        fontFamily: TB.fontMono, fontSize: 10, letterSpacing: 0.4,
        backdropFilter: 'blur(8px)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}
    >{children}</button>
  );
}

// Compact inline numeric input for the stage readout. Accepts typed digits,
// commits on Enter / blur, scroll-wheel to nudge, ↑/↓ keys to step.
function StageInput({ value, onChange, suffix, width = 44 }) {
  const [draft, setDraft] = React.useState(String(value));
  const [focus, setFocus] = React.useState(false);
  React.useEffect(() => { if (!focus) setDraft(String(value)); }, [value, focus]);
  const commit = () => {
    const n = parseInt(draft, 10);
    if (!Number.isNaN(n)) onChange(n);
    else setDraft(String(value));
  };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      border: `1px solid ${focus ? TB.accent : 'transparent'}`,
      background: focus ? TB.bg0 : 'transparent',
      borderRadius: 2, paddingRight: 4,
    }}>
      <input
        type="text" inputMode="numeric" value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
        onFocus={(e) => { setFocus(true); e.target.select(); }}
        onBlur={() => { setFocus(false); commit(); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { commit(); e.currentTarget.blur(); }
          if (e.key === 'Escape') { setDraft(String(value)); e.currentTarget.blur(); }
          if (e.key === 'ArrowUp') { e.preventDefault(); onChange(value + 1); }
          if (e.key === 'ArrowDown') { e.preventDefault(); onChange(value - 1); }
        }}
        onWheel={(e) => { if (focus) { e.preventDefault(); onChange(value + (e.deltaY < 0 ? 1 : -1)); } }}
        style={{
          width, height: 18, border: 0, outline: 'none', background: 'transparent',
          color: TB.ink, fontFamily: TB.fontMono, fontSize: 10,
          letterSpacing: 0.4, textAlign: 'right', padding: '0 2px',
        }}
      />
      {suffix && <span style={{ color: TB.inkMuted, fontSize: 10 }}>{suffix}</span>}
    </span>
  );
}

function ScenarioTab({ s, onEditBoard }) {
  const T = window.FC_TOKENS;
  // Local mirror of sides so we can add/rename without lifting state.
  // Source of truth still `s.sides`; we mutate for cross-tab consistency.
  const [, forceRender] = React.useReducer(n => n + 1, 0);
  const sides = s.sides || (s.sides = []);

  const addSide = () => {
    const palette = ['#5ea7e0','#e06a5e','#e6a85c','#5ed0a0','#b78ee6','#e08ebf','#8ec55e','#5ec5c0'];
    const used = new Set(sides.map(sd => sd.color));
    const color = palette.find(c => !used.has(c)) || palette[sides.length % palette.length];
    const id = 'side-' + Math.random().toString(36).slice(2, 6);
    sides.push({ id, label: `Side ${sides.length + 1}`, color });
    forceRender();
  };
  const renameSide = (id, label) => {
    const side = sides.find(sd => sd.id === id);
    if (side) { side.label = label; forceRender(); }
  };
  const removeSide = (id) => {
    const i = sides.findIndex(sd => sd.id === id);
    if (i >= 0) { sides.splice(i, 1); forceRender(); }
    // Orphan markers referencing this side — clear their sideId
    s.markers.forEach(m => { if (m.sideId === id) m.sideId = null; });
  };
  const pieceCount = (id) => s.markers.filter(m => m.sideId === id).length;

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.line}` }}>
        <label style={{
          display: 'block', fontFamily: T.fontMono, fontSize: 9, letterSpacing: 1.2,
          textTransform: 'uppercase', color: T.inkDim, marginBottom: 6,
        }}>Title</label>
        <Input value={s.title} />
      </div>
      <SectionLabel
        right={
          <button onClick={onEditBoard} style={{
            height: 18, padding: '0 6px', border: `1px solid ${T.line}`, borderRadius: 2,
            background: T.bg1, color: T.inkMuted, cursor: 'pointer',
            fontFamily: T.fontUi, fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase',
          }}>Edit…</button>
        }
      >Space</SectionLabel>
      <div style={{ padding: '2px 0 10px' }}>
        <KV k="Model" v="square-grid" mono accent={T.accent} />
        <KV k="Dimensions" v={`${s.w} × ${s.h}`} mono />
        <KV k="Tile size" v={`${s.tile}px`} mono />
        <KV k="Scale" v={`1 / ${s.scale}${s.unit}`} mono />
      </div>

      <SectionLabel
        right={
          <button onClick={addSide} title="Add a new side" style={{
            height: 18, padding: '0 6px', border: `1px solid ${T.line}`, borderRadius: 2,
            background: T.bg1, color: T.inkMuted, cursor: 'pointer',
            fontFamily: T.fontUi, fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase',
          }}>+ Add</button>
        }
      >Sides</SectionLabel>
      <div style={{ padding: '4px 14px 12px' }}>
        {sides.length === 0 ? (
          <div style={{
            padding: '10px 12px', border: `1px dashed ${T.line}`, borderRadius: 3,
            fontFamily: T.fontUi, fontSize: 11, color: T.inkDim, lineHeight: 1.5,
            background: T.bg0,
          }}>
            No sides defined. Add sides to give pieces factions or player ownership —
            e.g. <em style={{ color: T.inkMuted }}>Federation</em>, <em style={{ color: T.inkMuted }}>Klingon Empire</em>,
            or <em style={{ color: T.inkMuted }}>Player 1 / NPCs</em>.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sides.map(side => (
              <SideRow key={side.id}
                side={side}
                count={pieceCount(side.id)}
                onRename={(label) => renameSide(side.id, label)}
                onRemove={() => removeSide(side.id)}
              />
            ))}
          </div>
        )}
      </div>

      <SectionLabel>Contents</SectionLabel>
      <div style={{ padding: '2px 0 10px' }}>
        <KV k="Markers" v={s.markers.length} mono />
        <KV k="Assets" v={s.assets} mono />
      </div>
      <SectionLabel>Board background</SectionLabel>
      <div style={{ padding: '4px 14px 12px' }}>
        <AssetRow name="checkerboard-32" kind="image" path="assets/checkerboard-32-3.png" active />
      </div>
      <SectionLabel>File</SectionLabel>
      <div style={{ padding: '2px 0 12px' }}>
        <KV k="State" v={<span style={{ color: T.amber }}>Unsaved changes</span>} />
        <KV k="Mode" v="Desktop file" mono />
        <KV k="Path" v={<span style={{ fontSize: 10 }}>/home/ajeless/atester1.fieldcraft.json</span>} mono />
      </div>
    </div>
  );
}

function SideRow({ side, count, onRename, onRemove }) {
  const T = window.FC_TOKENS;
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '6px 8px', borderRadius: 3,
        border: `1px solid ${hover ? T.lineStrong : T.line}`,
        background: T.bg1,
      }}
    >
      <span style={{
        width: 14, height: 14, borderRadius: 3, flex: '0 0 auto',
        background: side.color, border: `1px solid rgba(0,0,0,0.25)`,
        boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.1)`,
      }} title={side.color} />
      <input
        defaultValue={side.label}
        onBlur={(e) => { if (e.target.value.trim()) onRename(e.target.value.trim()); else e.target.value = side.label; }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.currentTarget.value = side.label; e.currentTarget.blur(); } }}
        style={{
          flex: 1, minWidth: 0,
          fontFamily: T.fontUi, fontSize: 12, color: T.ink, fontWeight: 500,
          background: 'transparent', border: 0, outline: 0, padding: 0,
        }}
        title="Click to rename"
      />
      <span style={{
        fontFamily: T.fontMono, fontSize: 9, color: T.inkDim,
        letterSpacing: 0.4,
      }}>{count} {count === 1 ? 'piece' : 'pieces'}</span>
      <button onClick={onRemove} title="Remove side" style={{
        width: 18, height: 18, border: 0, borderRadius: 2,
        background: 'transparent', color: hover ? T.inkMuted : 'transparent',
        cursor: 'pointer', display: 'grid', placeItems: 'center',
        transition: 'color 120ms',
      }}><Icons.Close s={8} /></button>
    </div>
  );
}

function SelectionTab({ selected, sides = [], onClear, onChangeAsset, onChangeSide, onOpenLibrary }) {
  const T = window.FC_TOKENS;
  const asset = window.SAMPLE_ASSETS.find(a => a.id === selected.assetId);
  const currentSide = sides.find(sd => sd.id === selected.sideId) || null;
  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <div style={{
        padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: `1px solid ${T.line}`, background: TB.bg1,
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: 999,
          background: TB.marker, border: `2px solid ${TB.markerRing}`,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: T.fontUi, fontSize: 12, color: T.inkBright, fontWeight: 600 }}>
            Marker
          </div>
          <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.inkDim }}>
            {selected.id}
          </div>
        </div>
        <button onClick={onClear} title="Clear selection" style={{
          width: 22, height: 22, border: `1px solid ${T.line}`, borderRadius: 3,
          background: 'transparent', color: T.inkMuted, cursor: 'pointer',
          display: 'grid', placeItems: 'center',
        }}><Icons.Close s={9} /></button>
      </div>

      <SectionLabel>Position</SectionLabel>
      <div style={{ padding: '6px 14px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <MiniField label="X" value={selected.x} />
        <MiniField label="Y" value={selected.y} />
      </div>

      <SectionLabel>Linked asset</SectionLabel>
      <div style={{ padding: '6px 14px 10px' }}>
        {asset ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: 8, borderRadius: 3,
            border: `1px solid ${T.line}`, background: T.bg1,
          }}>
            <div style={{
              width: 40, height: 40, flex: '0 0 auto', borderRadius: 2,
              background: asset.kind === 'audio'
                ? T.bg3
                : `repeating-conic-gradient(${T.tileA} 0 25%, ${T.tileB} 0 50%) 0 0 / 8px 8px`,
              border: `1px solid ${T.line}`,
              display: 'grid', placeItems: 'center',
            }}>
              {asset.kind === 'audio' && (
                <svg width="24" height="10" viewBox="0 0 24 10">
                  {[3, 6, 4, 8, 5, 7, 4, 6].map((h, i) => (
                    <rect key={i} x={i * 3} y={5 - h / 2} width="1.5" height={h} fill={T.accent} opacity={0.75} />
                  ))}
                </svg>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                defaultValue={asset.label || asset.id}
                onFocus={(e) => e.target.select()}
                style={{
                  display: 'block', width: '100%',
                  fontFamily: T.fontUi, fontSize: 12, fontWeight: 500, color: T.ink,
                  background: 'transparent', border: 0, outline: 0, padding: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
                onBlur={(e) => { /* would persist to asset.label in real app */ }}
                title="Click to rename the display label"
              />
              <div style={{
                fontFamily: T.fontMono, fontSize: 9, color: T.inkDim,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', direction: 'rtl',
              }} title={asset.path}>
                {asset.path}
              </div>
              <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.inkDim, marginTop: 2 }}>
                {asset.kind} · {asset.size}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button onClick={onChangeAsset} style={{
                height: 20, padding: '0 8px', border: `1px solid ${T.line}`, borderRadius: 3,
                background: T.bg2, color: T.ink, cursor: 'pointer',
                fontFamily: T.fontUi, fontSize: 10,
              }}>Change…</button>
              <button style={{
                height: 20, padding: '0 8px', border: `1px solid ${T.line}`, borderRadius: 3,
                background: 'transparent', color: T.inkMuted, cursor: 'pointer',
                fontFamily: T.fontUi, fontSize: 10,
              }}>Unbind</button>
            </div>
          </div>
        ) : (
          <button onClick={onChangeAsset} style={{
            width: '100%', padding: '10px 12px',
            border: `1px dashed ${T.lineStrong}`, borderRadius: 3,
            background: 'transparent', color: T.inkMuted, cursor: 'pointer',
            fontFamily: T.fontUi, fontSize: 11, textAlign: 'left',
          }}>
            <span style={{ color: T.accent }}>＋</span> Assign image from library…
          </button>
        )}
      </div>

      <SectionLabel>Appearance</SectionLabel>
      <div style={{ padding: '6px 14px 10px', display: 'grid', gap: 8 }}>
        <div>
          <label style={miniLabelCss}>Color</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {['#e06a5e', '#e6a85c', '#5ed0a0', '#5ea7e0', '#b78ee6'].map((c, i) => (
              <button key={c} style={{
                width: 24, height: 24, borderRadius: 999,
                background: c, cursor: 'pointer',
                border: `2px solid ${i === 0 ? T.ink : 'transparent'}`,
                boxShadow: i === 0 ? `0 0 0 1px ${T.bg0}` : 'none',
              }} />
            ))}
          </div>
        </div>
        <div>
          <label style={miniLabelCss}>Label</label>
          <Input value="Ghost" />
        </div>
      </div>

      <SectionLabel>Side</SectionLabel>
      <div style={{ padding: '6px 14px 10px' }}>
        <div style={{
          position: 'relative', display: 'flex', alignItems: 'center', gap: 8,
          height: 28, padding: '0 8px 0 10px', borderRadius: 3,
          border: `1px solid ${T.line}`, background: T.bg0,
        }}>
          <span style={{
            width: 10, height: 10, borderRadius: 999, flex: '0 0 auto',
            background: currentSide ? currentSide.color : 'transparent',
            border: `1.5px solid ${currentSide ? currentSide.color : T.lineStrong}`,
          }} />
          <span style={{
            flex: 1, minWidth: 0, fontFamily: T.fontUi, fontSize: 12,
            color: currentSide ? T.ink : T.inkDim,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{currentSide ? currentSide.label : 'None'}</span>
          <svg width="8" height="6" viewBox="0 0 8 6" fill="none" stroke={T.inkDim} strokeWidth="1.2">
            <path d="M1 1.5l3 3 3-3" />
          </svg>
          <select
            value={selected.sideId || ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '__add__') {
                const name = window.prompt('New side name', 'New side');
                if (!name) return;
                onChangeSide && onChangeSide({ addNew: name });
              } else {
                onChangeSide && onChangeSide({ sideId: v || null });
              }
            }}
            style={{
              position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer',
            }}
          >
            <option value="">None</option>
            {sides.map(sd => (
              <option key={sd.id} value={sd.id}>{sd.label}</option>
            ))}
            <option value="__add__">+ Add side…</option>
          </select>
        </div>
        {sides.length === 0 && (
          <div style={{
            marginTop: 6, fontFamily: T.fontUi, fontSize: 10, color: T.inkDim, lineHeight: 1.5,
          }}>
            No sides defined yet. Add sides from the Scenario tab, or pick <em>+ Add side…</em> above.
          </div>
        )}
        {sides.length > 0 && (
          <div style={{
            marginTop: 6, fontFamily: T.fontUi, fontSize: 10, color: T.inkDim, lineHeight: 1.5,
          }}>
            Sides drive turn order and visibility rules at runtime.
          </div>
        )}
      </div>

      <SectionLabel>Colocation</SectionLabel>
      <div style={{ padding: '6px 14px 14px' }}>
        <div style={{ fontFamily: T.fontUi, fontSize: 11, color: T.inkMuted, lineHeight: 1.45 }}>
          This tile contains <strong style={{ color: T.ink }}>1 marker</strong>.
          Drop another marker here to create a stack.
        </div>
      </div>
    </div>
  );
}

function EmptySelection({ onOpenLibrary }) {
  const T = window.FC_TOKENS;
  return (
    <div style={{ flex: 1, padding: '20px 14px', color: T.inkMuted, fontFamily: T.fontUi, fontSize: 12 }}>
      <p style={{ margin: 0, lineHeight: 1.55 }}>
        Nothing selected. Click a marker or tile to inspect it. Shift-click to multi-select.
      </p>
    </div>
  );
}

// Assets tab — contextual picker. When something is selected, highlight its
// current binding and let the user pick a replacement. When nothing is
// selected, the tab invites the user to open the full library.
function AssetsPickerTab({ selected, onPick, onOpenLibrary }) {
  const T = window.FC_TOKENS;
  const [query, setQuery] = React.useState('');
  if (!selected) {
    return (
      <div style={{ flex: 1, padding: '24px 16px', color: T.inkMuted, fontFamily: T.fontUi, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ margin: 0, lineHeight: 1.55 }}>
          Select a marker to rebind its image. To browse or manage the full project library,
          open the Asset Library.
        </p>
        <button onClick={onOpenLibrary} style={{
          alignSelf: 'flex-start', height: 28, padding: '0 12px',
          border: `1px solid ${T.accent}`, borderRadius: 3,
          background: T.accentWash, color: T.accent, cursor: 'pointer',
          fontFamily: T.fontUi, fontSize: 12, fontWeight: 500,
        }}>Open Asset Library</button>
      </div>
    );
  }
  const images = window.SAMPLE_ASSETS.filter(a => a.kind === 'image')
    .filter(a => !query || a.id.toLowerCase().includes(query.toLowerCase()));
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{
        padding: '10px 14px', borderBottom: `1px solid ${T.line}`,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ fontFamily: T.fontUi, fontSize: 11, color: T.inkMuted }}>
          Pick an image for marker <span style={{ color: T.ink, fontFamily: T.fontMono }}>{selected.id}</span>
        </div>
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter images…"
          style={{
            height: 26, padding: '0 8px',
            border: `1px solid ${T.line}`, borderRadius: 3,
            background: T.bg0, color: T.ink, outline: 'none',
            fontFamily: T.fontUi, fontSize: 12,
          }}
        />
      </div>
      <div style={{
        flex: 1, minHeight: 0, overflow: 'auto', padding: 10,
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
      }}>
        {images.map(a => {
          const active = selected.assetId === a.id;
          return (
            <button key={a.id} onClick={() => onPick(a.id)} style={{
              padding: 0, border: `1px solid ${active ? T.accent : T.line}`,
              borderRadius: 3, background: active ? T.accentWash : T.bg2,
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              cursor: 'pointer', textAlign: 'left',
              boxShadow: active ? `0 0 0 2px ${T.accentWash}` : 'none',
            }}>
              <div style={{
                aspectRatio: '1/1',
                background: `repeating-conic-gradient(${T.tileA} 0 25%, ${T.tileB} 0 50%) 0 0 / 10px 10px`,
                borderBottom: `1px solid ${T.line}`,
              }} />
              <div style={{
                padding: '5px 8px',
                fontFamily: T.fontMono, fontSize: 9,
                color: active ? T.accent : T.ink,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{a.label || a.id}</div>
            </button>
          );
        })}
      </div>
      <div style={{
        padding: '8px 14px', borderTop: `1px solid ${T.line}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <button onClick={() => onPick(null)} style={{
          height: 22, padding: '0 8px', border: 0, background: 'transparent',
          color: T.inkMuted, cursor: 'pointer', fontFamily: T.fontUi, fontSize: 11,
        }}>Unbind current</button>
        <button onClick={onOpenLibrary} style={{
          height: 22, padding: '0 8px', border: `1px solid ${T.line}`, borderRadius: 3,
          background: 'transparent', color: T.inkMuted, cursor: 'pointer',
          fontFamily: T.fontUi, fontSize: 11,
        }}>Open library →</button>
      </div>
    </div>
  );
}

function SourceTab({ expanded, onToggleExpand }) {
  const T = window.FC_TOKENS;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{
        padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${T.line}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icons.Dot s={6} c={T.accent} />
          <span style={{ fontFamily: T.fontUi, fontSize: 11, color: T.inkMuted }}>
            In sync with editor
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onToggleExpand} title={expanded ? 'Collapse source pane' : 'Expand source pane'}
            style={miniGhost}>
            {expanded ? '→|  Collapse' : '|← Expand'}
          </button>
          <button style={miniGhost}>Reset</button>
          <button style={{ ...miniBtn, borderColor: T.accent, color: T.accent }}>Apply</button>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: 10 }}>
        <JsonBlock text={SAMPLE_SCENARIO} />
      </div>
    </div>
  );
}

function SectionLabel({ children, right }) {
  const T = window.FC_TOKENS;
  return (
    <div style={{
      padding: '10px 14px 4px',
      fontFamily: T.fontMono, fontSize: 9, fontWeight: 600,
      letterSpacing: 1.4, textTransform: 'uppercase', color: T.inkDim,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    }}>
      <span>{children}</span>
      {right}
    </div>
  );
}

function MiniField({ label, value }) {
  const T = window.FC_TOKENS;
  return (
    <div>
      <label style={miniLabelCss}>{label}</label>
      <Input value={value} mono />
    </div>
  );
}

const miniLabelCss = {
  display: 'block',
  fontFamily: window.FC_TOKENS.fontMono, fontSize: 9, letterSpacing: 1.2,
  textTransform: 'uppercase', color: window.FC_TOKENS.inkDim, marginBottom: 4,
};

// Asset row — small card used in Scenario tab
function AssetRow({ name, kind, path, active }) {
  const T = window.FC_TOKENS;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: 8, borderRadius: 3,
      border: `1px solid ${active ? T.accent : T.line}`,
      background: active ? T.accentWash : T.bg1,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 2, flex: '0 0 auto',
        background: `repeating-conic-gradient(${T.tileA} 0 25%, ${T.tileB} 0 50%) 0 0 / 8px 8px`,
        border: `1px solid ${T.line}`,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: T.fontUi, fontSize: 12, fontWeight: 500, color: T.ink,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{name}</div>
        <div style={{
          fontFamily: T.fontMono, fontSize: 9, color: T.inkDim,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{path}</div>
      </div>
      <span style={{
        fontFamily: T.fontMono, fontSize: 9, letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: kind === 'image' ? T.accent : T.amber,
        padding: '2px 6px', borderRadius: 2,
        border: `1px solid ${kind === 'image' ? T.accent : T.amber}`,
        opacity: 0.8,
      }}>{kind}</span>
    </div>
  );
}

Object.assign(window, { EditorScreen, AssetRow });
