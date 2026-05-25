import { useEffect, useRef, useState } from "react";

const VIEW_W = 1180;
const VIEW_H = 660;
const WORLD_W = 1480;
const WORLD_H = 940;
const MIN_ZOOM = 0.32;
const MAX_ZOOM = 2.05;

const DEFAULT_POINTS = {
  1: { x: 280, y: 610 },
  2: { x: 520, y: 355 },
  3: { x: 760, y: 585 },
  4: { x: 1010, y: 320 },
  5: { x: 1210, y: 690 },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getPoint(treasure) {
  return treasure.map || DEFAULT_POINTS[treasure.id] || { x: 120, y: 120 };
}

function getInitialView(viewport) {
  const fitZoom = Math.min((viewport.w - 28) / WORLD_W, (viewport.h - 28) / WORLD_H);
  const nextZoom = clamp(fitZoom * 1.22, MIN_ZOOM, 0.92);
  return {
    zoom: nextZoom,
    pan: {
      x: (viewport.w - WORLD_W * nextZoom) / 2,
      y: (viewport.h - WORLD_H * nextZoom) / 2,
    },
  };
}

function TreasureImage({ color, locked }) {
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" aria-hidden="true">
      <defs>
        <linearGradient id={`ballTop-${color.replace("#", "")}`} x1="14" y1="8" x2="52" y2="35">
          <stop offset="0%" stopColor={locked ? "#707988" : "#ff7a87"} />
          <stop offset="52%" stopColor={locked ? "#3b4350" : "#ed1d34"} />
          <stop offset="100%" stopColor={locked ? "#202938" : "#9d1020"} />
        </linearGradient>
        <linearGradient id={`ballBottom-${color.replace("#", "")}`} x1="18" y1="38" x2="52" y2="62">
          <stop offset="0%" stopColor={locked ? "#aab2bd" : "#ffffff"} />
          <stop offset="100%" stopColor={locked ? "#6e7784" : "#dce7f2"} />
        </linearGradient>
        <radialGradient id={`ballShine-${color.replace("#", "")}`} cx="32%" cy="24%" r="42%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="34" cy="34" r="29" fill="#111722" />
      <path d="M6 32a28 28 0 0 1 56 0H6Z" fill={`url(#ballTop-${color.replace("#", "")})`} />
      <path d="M6 36a28 28 0 0 0 56 0H6Z" fill={`url(#ballBottom-${color.replace("#", "")})`} />
      <rect x="7" y="30" width="54" height="8" rx="4" fill="#111722" />
      <circle cx="34" cy="34" r="13" fill="#111722" />
      <circle cx="34" cy="34" r="8" fill={locked ? "#c4ccd5" : "#ffffff"} />
      <circle cx="34" cy="34" r="4" fill={locked ? "#6e7784" : color} />
      <circle cx="24" cy="20" r="14" fill={`url(#ballShine-${color.replace("#", "")})`} />
    </svg>
  );
}

export default function TreasureMap({ treasures, unlocked, quizDone = [], onPointClick }) {
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const initializedRef = useRef(false);
  const [viewport, setViewport] = useState({ w: VIEW_W, h: VIEW_H });
  const initialView = getInitialView({ w: VIEW_W, h: VIEW_H });
  const [zoom, setZoom] = useState(initialView.zoom);
  const [pan, setPan] = useState(initialView.pan);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return undefined;

    function measure() {
      const rect = element.getBoundingClientRect();
      const nextViewport = { w: rect.width, h: rect.height };
      setViewport(nextViewport);

      if (!initializedRef.current) {
        const nextView = getInitialView(nextViewport);
        setZoom(nextView.zoom);
        setPan(nextView.pan);
        initializedRef.current = true;
      } else {
        setPan((current) => limitPan(current, zoom, nextViewport));
      }
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [zoom]);

  function limitPan(nextPan, nextZoom = zoom, nextViewport = viewport) {
    const margin = 18;
    const scaledW = WORLD_W * nextZoom;
    const scaledH = WORLD_H * nextZoom;
    const minX = Math.min(nextViewport.w - scaledW - margin, margin);
    const minY = Math.min(nextViewport.h - scaledH - margin, margin);
    const maxX = Math.max(margin, nextViewport.w - scaledW - margin);
    const maxY = Math.max(margin, nextViewport.h - scaledH - margin);
    return {
      x: clamp(nextPan.x, minX, maxX),
      y: clamp(nextPan.y, minY, maxY),
    };
  }

  function updateZoom(nextZoom, focal = { x: viewport.w / 2, y: viewport.h / 2 }) {
    const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const worldX = (focal.x - pan.x) / zoom;
    const worldY = (focal.y - pan.y) / zoom;
    const nextPan = {
      x: focal.x - worldX * clampedZoom,
      y: focal.y - worldY * clampedZoom,
    };
    setZoom(clampedZoom);
    setPan(limitPan(nextPan, clampedZoom));
  }

  function resetView() {
    const nextView = getInitialView(viewport);
    setZoom(nextView.zoom);
    setPan(limitPan(nextView.pan, nextView.zoom));
  }

  function handlePointerDown(e) {
    if (e.target.closest("[data-map-marker]")) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    setPan(limitPan({
      x: drag.panX + e.clientX - drag.startX,
      y: drag.panY + e.clientY - drag.startY,
    }));
  }

  function handlePointerUp(e) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  function handleWheel(e) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    updateZoom(zoom + (e.deltaY > 0 ? -0.08 : 0.08), {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }

  return (
    <div className="treasure-map-wrap" style={{ width: "100%", maxWidth: VIEW_W, margin: "0 auto" }}>
      <style>{`
        @keyframes seaDrift { from { transform: translateX(0); } to { transform: translateX(-120px); } }
        @keyframes glowPulse { 0%,100% { opacity: .48; transform: scale(1); } 50% { opacity: .9; transform: scale(1.08); } }
        @keyframes markerBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes sparkleRise { 0% { opacity: 0; transform: translateY(14px) scale(.7); } 35% { opacity: 1; } 100% { opacity: 0; transform: translateY(-26px) scale(1.1); } }
        @keyframes cloudFloat { from { transform: translateX(-80px); } to { transform: translateX(80px); } }
        @keyframes dashMove { to { stroke-dashoffset: -48; } }
      `}</style>
      <div
        ref={stageRef}
        className="treasure-map-stage"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        style={{
          position: "relative",
          height: `clamp(360px, calc(100svh - 230px), ${VIEW_H}px)`,
          minHeight: 360,
          overflow: "hidden",
          borderRadius: 18,
          border: "1px solid #2fc7d6",
          background: "linear-gradient(160deg, #06121f 0%, #0b314f 42%, #0a5f72 100%)",
          boxShadow: "0 24px 70px #000b, inset 0 0 70px #00f5ff22",
          cursor: "grab",
          touchAction: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: WORLD_W,
            height: WORLD_H,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          <svg width={WORLD_W} height={WORLD_H} viewBox={`0 0 ${WORLD_W} ${WORLD_H}`} style={{ position: "absolute", inset: 0 }}>
            <defs>
              <linearGradient id="sea" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#072656" />
                <stop offset="36%" stopColor="#0986a4" />
                <stop offset="67%" stopColor="#1db08b" />
                <stop offset="100%" stopColor="#0b2b5b" />
              </linearGradient>
              <radialGradient id="island" cx="48%" cy="45%" r="62%">
                <stop offset="0%" stopColor="#9fe15d" />
                <stop offset="45%" stopColor="#36a35b" />
                <stop offset="100%" stopColor="#14553e" />
              </radialGradient>
              <radialGradient id="pinkGrove" cx="50%" cy="45%" r="60%">
                <stop offset="0%" stopColor="#ffd4ef" />
                <stop offset="100%" stopColor="#d64c9e" />
              </radialGradient>
              <radialGradient id="crystalLake" cx="50%" cy="50%" r="65%">
                <stop offset="0%" stopColor="#9cfaff" />
                <stop offset="100%" stopColor="#1979d2" />
              </radialGradient>
              <filter id="softGlow">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            <rect width={WORLD_W} height={WORLD_H} fill="url(#sea)" />
            <g style={{ animation: "seaDrift 9s linear infinite" }} opacity="0.16">
              {[-80, 110, 300, 490, 680, 870, 1060, 1250, 1440].map((x) => (
                <path key={x} d={`M${x} 120 C${x + 70} 82 ${x + 140} 158 ${x + 220} 116`} fill="none" stroke="#d8ffff" strokeWidth="18" strokeLinecap="round" />
              ))}
              {[-160, 40, 240, 440, 640, 840, 1040, 1240].map((x) => (
                <path key={`b-${x}`} d={`M${x} 790 C${x + 80} 742 ${x + 160} 828 ${x + 250} 775`} fill="none" stroke="#bafff1" strokeWidth="16" strokeLinecap="round" />
              ))}
            </g>
            <path d="M-20 93 C88 33 183 132 315 75 C470 8 561 83 737 42 C875 10 1036 82 1160 50 C1305 12 1455 69 1530 150" fill="none" stroke="#bffcff" strokeWidth="46" opacity="0.12" />
            <path d="M-40 120 C110 70 170 145 310 90 C480 20 560 85 735 55 C910 18 1080 97 1260 61 C1370 38 1460 82 1530 180 L1530 980 L-40 980 Z" fill="#073047" opacity="0.32" />
            <path d="M136 540 C116 361 244 187 489 133 C701 86 924 134 1075 280 C1235 435 1280 657 1135 785 C1000 904 727 868 547 823 C325 767 148 704 136 540 Z" fill="#f7d889" opacity="0.98" />
            <path d="M186 523 C180 378 286 246 503 199 C685 159 885 199 1015 324 C1149 452 1192 623 1078 724 C965 827 736 796 574 758 C386 713 194 661 186 523 Z" fill="url(#island)" />
            <path d="M257 645 C430 547 565 580 706 488 C860 386 948 398 1120 455" fill="none" stroke="#ffe18a" strokeWidth="28" strokeLinecap="round" opacity="0.84" />
            <path d="M267 648 C438 557 571 588 714 495 C864 400 954 408 1112 461" fill="none" stroke="#8a5f31" strokeWidth="7" strokeLinecap="round" strokeDasharray="12 10" opacity="0.9" />
            <path d="M398 265 C482 326 602 309 663 238 C738 148 859 185 920 270" fill="none" stroke="#1d5e3c" strokeWidth="58" strokeLinecap="round" opacity="0.58" />
            <path d="M461 728 C538 653 650 663 718 734 C792 811 920 802 1024 715" fill="none" stroke="#105e87" strokeWidth="38" strokeLinecap="round" opacity="0.75" />
            <circle cx="350" cy="330" r="82" fill="url(#pinkGrove)" opacity="0.82" />
            <circle cx="900" cy="215" r="56" fill="#6d4ef6" opacity="0.84" />
            <circle cx="1040" cy="666" r="82" fill="url(#crystalLake)" opacity="0.78" />
            <circle cx="670" cy="392" r="48" fill="#ffcf4d" opacity="0.35" filter="url(#softGlow)" style={{ animation: "glowPulse 4s ease-in-out infinite" }} />
            <path d="M252 762 L311 700 L352 790 Z" fill="#6d4940" />
            <path d="M817 333 L892 244 L954 346 Z" fill="#765340" />
            <path d="M145 226 C189 188 247 197 286 238 C234 263 183 264 145 226 Z" fill="#ffdf6b" opacity="0.76" />
            <path d="M1180 160 C1228 122 1292 137 1328 184 C1269 210 1219 204 1180 160 Z" fill="#f7797d" opacity="0.78" />
            <path d="M1190 824 C1247 779 1320 800 1358 850 C1290 877 1235 871 1190 824 Z" fill="#8cffd1" opacity="0.7" />
            {[210, 325, 590, 1115, 1275].map((x, i) => (
              <g key={x} opacity="0.85">
                <rect x={x} y={i % 2 ? 418 : 520} width="10" height="42" rx="5" fill="#5c351f" />
                <circle cx={x + 5} cy={i % 2 ? 405 : 506} r="24" fill={i % 2 ? "#ff7ac8" : "#35d070"} />
              </g>
            ))}

            {treasures.map((treasure, index) => {
              if (index === 0) return null;
              const from = getPoint(treasures[index - 1]);
              const to = getPoint(treasure);
              const isOpen = unlocked.includes(treasure.id) || unlocked.includes(treasures[index - 1].id);
              return (
                <line
                  key={treasure.id}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={isOpen ? "#fff06acc" : "#ffffff55"}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray="12 12"
                  style={isOpen ? { animation: "dashMove 1.8s linear infinite" } : null}
                  filter={isOpen ? "url(#softGlow)" : "none"}
                />
              );
            })}
          </svg>

          {treasures.map((treasure) => {
            const point = getPoint(treasure);
            const isUnlocked = unlocked.includes(treasure.id);
            const isDone = quizDone.includes(treasure.id);
            const canOpen = treasure.id === 1 || unlocked.includes(treasure.id - 1);
            return (
              <button
                key={treasure.id}
                data-map-marker="true"
                onClick={() => onPointClick(treasure)}
                style={{
                  position: "absolute",
                  left: point.x - 48,
                  top: point.y - 78,
                  width: 96,
                  height: 118,
                  border: "none",
                  background: "transparent",
                  color: "#fff",
                  cursor: "pointer",
                  fontFamily: "'Courier New', monospace",
                  padding: 0,
                  filter: canOpen ? `drop-shadow(0 0 18px ${treasure.color}aa)` : "drop-shadow(0 8px 12px #0008)",
                  animation: canOpen ? `markerBob 2.4s ${treasure.id * 0.14}s ease-in-out infinite` : "none",
                  transition: "transform 0.2s ease, filter 0.2s ease",
                }}
                aria-label={treasure.name}
              >
                <span style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 78,
                  height: 78,
                  margin: "0 auto",
                  borderRadius: "50%",
                  background: canOpen || isUnlocked
                    ? "radial-gradient(circle at 35% 24%, #ffffff 0 8%, #ffe9a0 18%, #0b1724 76%)"
                    : "linear-gradient(145deg, #233142, #07111d)",
                  border: `1px solid ${canOpen || isUnlocked ? "#fff0a6" : "#53606d"}`,
                  boxShadow: canOpen
                    ? `0 0 0 8px ${treasure.color}1f, 0 16px 30px #0009, inset 0 0 18px #ffffff24`
                    : "0 10px 20px #0009, inset 0 0 18px #ffffff12",
                }}>
                  <TreasureImage color={treasure.color} locked={!canOpen && !isUnlocked} />
                </span>
                {canOpen && !isDone && (
                  <span style={{
                    position: "absolute",
                    left: 18,
                    top: 2,
                    width: 62,
                    height: 62,
                    borderRadius: "50%",
                    border: `2px solid ${treasure.color}88`,
                    animation: "glowPulse 1.8s ease-in-out infinite",
                    pointerEvents: "none",
                  }} />
                )}
                <span style={{
                  display: "block",
                  marginTop: 8,
                  padding: "6px 6px",
                  borderRadius: 8,
                  background: canOpen || isUnlocked ? "#07111ef2" : "#050b12e6",
                  border: `1px solid ${canOpen || isUnlocked ? treasure.color + "aa" : "#ffffff22"}`,
                  color: canOpen || isUnlocked ? treasure.color : "#7b8794",
                  fontSize: 9,
                  fontWeight: 900,
                  lineHeight: 1.15,
                }}>
                  {isDone ? "Concluido" : canOpen ? treasure.name.split(" ").slice(0, 2).join(" ") : "Bloqueado"}
                </span>
              </button>
            );
          })}
        </div>

        {[
          { left: "8%", top: "9%", size: 70, delay: "0s" },
          { left: "62%", top: "7%", size: 96, delay: "-2s" },
          { left: "78%", top: "72%", size: 74, delay: "-4s" },
        ].map((cloud) => (
          <div
            key={`${cloud.left}-${cloud.top}`}
            style={{
              position: "absolute",
              left: cloud.left,
              top: cloud.top,
              width: cloud.size,
              height: cloud.size * 0.38,
              borderRadius: 999,
              background: "#ffffff26",
              boxShadow: `${cloud.size * 0.25}px ${-cloud.size * 0.09}px 0 #ffffff1f, ${cloud.size * 0.48}px ${cloud.size * 0.04}px 0 #ffffff1a`,
              animation: `cloudFloat 7s ${cloud.delay} ease-in-out infinite alternate`,
              pointerEvents: "none",
            }}
          />
        ))}

        {[18, 31, 46, 63, 82].map((left, index) => (
          <div
            key={left}
            style={{
              position: "absolute",
              left: `${left}%`,
              top: `${18 + (index % 3) * 19}%`,
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#fff6a9",
              boxShadow: "0 0 12px #fff6a9",
              animation: `sparkleRise ${2.4 + index * 0.2}s ${-index * 0.4}s ease-in-out infinite`,
              pointerEvents: "none",
            }}
          />
        ))}

        <div style={{ position: "absolute", top: 10, right: 10, display: "grid", gap: 6 }}>
          {[
            ["+", () => updateZoom(zoom + 0.14)],
            ["-", () => updateZoom(zoom - 0.14)],
            ["R", resetView],
          ].map(([label, action]) => (
            <button
              key={label}
              onClick={action}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: "1px solid #ffffff2e",
                background: "#07111ee6",
                color: label === "o" ? "#ffd700" : "#00f5ff",
                fontFamily: "inherit",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{
          position: "absolute",
          left: 10,
          bottom: 10,
          borderRadius: 8,
          padding: "6px 8px",
          background: "#07111ee6",
          border: "1px solid #ffffff22",
          color: "#9fb1c2",
          fontSize: 9,
        }}>
          Arraste o mapa - zoom {Math.round(zoom * 100)}%
        </div>
      </div>
    </div>
  );
}
