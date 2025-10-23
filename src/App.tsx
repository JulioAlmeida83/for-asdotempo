import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * App único: Forças do Tempo (sem Tailwind, sem PostCSS)
 * - Timer 5/10/15/30 min, 1h, 2h
 * - Ampulheta com progresso
 * - Chime com WebAudio ao zerar
 * - Slideshow de fotos (upload), persistido em localStorage
 * - Controle de opacidade e play/pause do slideshow
 */

/* ====== Estilos mínimos (um único arquivo) ====== */
const styles = `
:root {
  --bg: #0b1020;
  --card: rgba(255,255,255,0.06);
  --border: rgba(255,255,255,0.12);
  --soft: rgba(255,255,255,0.08);
  --text: #ffffff;
  --accent1: #06b6d4; /* ciano */
  --accent2: #d946ef; /* fúcsia */
}
* { box-sizing: border-box; }
html, body, #root { height: 100%; }
body { margin: 0; background: var(--bg); color: var(--text); font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; }
.app {
  position: relative; min-height: 100vh; width: 100%;
  display: flex; flex-direction: column; align-items: center;
  padding: 24px; gap: 16px; overflow: hidden;
}
.header { text-align: center; position: relative; z-index: 2; }
.title { font-size: clamp(28px, 4vw, 56px); font-weight: 800; margin: 0 0 6px; text-shadow: 0 2px 0 rgba(0,0,0,.4); }
.subtitle { opacity: .9; font-size: clamp(14px, 2vw, 20px); margin: 0; }

.toolbar {
  position: relative; z-index: 2;
  width: 100%; max-width: 1040px;
  margin-top: -4px; margin-bottom: 4px;
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
  background: var(--soft); border: 1px solid var(--border); border-radius: 16px;
  padding: 12px 14px;
}
.btn {
  appearance: none; border: 1px solid var(--border);
  background: rgba(255,255,255,0.10); color: var(--text);
  padding: 8px 12px; border-radius: 12px; cursor: pointer;
}
.btn:hover { background: rgba(255,255,255,0.18); }
.btn-danger { background: rgba(239, 68, 68, .16); border-color: rgba(239,68,68,.35); }
.btn-danger:hover { background: rgba(239,68,68,.25); }

.range { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; opacity: .9; }

.menu {
  position: relative; z-index: 2;
  width: 100%; max-width: 1040px;
}
.grid {
  display: grid; gap: 16px;
  grid-template-columns: repeat( auto-fit, minmax(220px, 1fr) );
}
.menu-card {
  height: 140px; border-radius: 20px;
  background: linear-gradient(135deg, #dc2626, #f59e0b);
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 700; letter-spacing: .2px;
  border: 2px solid rgba(255,255,255,0.12);
  box-shadow: 0 10px 24px rgba(0,0,0,.25);
  cursor: pointer; transform: translateZ(0);
  transition: transform .12s ease;
}
.menu-card:hover { transform: scale(1.03); }
.menu-emoji { font-size: 28px; margin-right: 6px; }

.timer-wrap { position: relative; z-index: 2; display:flex; flex-direction:column; align-items:center; justify-content:center; margin-top: 8px; }
.glass {
  position: relative;
  width: 176px; height: 290px;
  border: 4px solid rgba(34,211,238,0.9);
  border-radius: 28px; overflow: hidden;
  background: rgba(34,211,238,0.10);
  box-shadow: 0 0 40px rgba(34,211,238,0.15);
}
.fill {
  position: absolute; left: 0; bottom: 0; width: 100%;
  background: rgba(217,70,239,0.65); transition: height 1s linear;
}
.center-emoji {
  position: absolute; inset: 0; display:flex; align-items:center; justify-content:center;
  font-size: 44px; text-shadow: 0 2px 0 rgba(0,0,0,0.4);
}
.time-left { margin: 14px 0 6px; font-size: 28px; font-weight: 700; }
.status { opacity: .9; margin: 2px 0 0; }
.actions { margin-top: 12px; display:flex; gap: 10px; }

.thumbbar { display:flex; gap:8px; overflow-x:auto; padding-top: 6px; }
.thumbbar img { width: 64px; height: 64px; object-fit: cover; border-radius: 10px; opacity: .8; border:1px solid var(--border); }
.thumbbar img:hover { opacity: 1; }

.bg-host { position: absolute; inset: 0; z-index: 0; overflow: hidden; }
.bg-host img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; filter: blur(2px); transform: scale(1.05); transition: opacity .4s ease; }
.bg-grad { position:absolute; inset:0; background: linear-gradient(to bottom, rgba(11,16,32,.4), rgba(11,16,32,1)); }

.hero-svg { position:absolute; inset:0; width:100%; height:100%; z-index:1; pointer-events:none; }
`;

/* ====== Hooks utilitários ====== */
function useChime() {
  const ctxRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (Ctx) ctxRef.current = new Ctx();
    const resume = () => { if (ctxRef.current?.state === "suspended") ctxRef.current.resume(); };
    window.addEventListener("pointerdown", resume, { once: true });
    window.addEventListener("keydown", resume, { once: true });
    return () => {
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
      ctxRef.current?.close();
    };
  }, []);
  return () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const seq = [659, 880, 1046];
    seq.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = 0.01;
      osc.type = "sine";
      osc.frequency.value = f;
      osc.connect(g).connect(ctx.destination);
      const t = ctx.currentTime + i * 0.09;
      osc.start(t);
      osc.stop(t + 0.18);
    });
  };
}

function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);
  return [value, setValue] as const;
}

/* ====== Tipos ====== */
type Slide = { url: string };

/* ====== Subcomponentes ====== */
function PhotoSlideshow({
  images, playing, intervalMs = 6000, opacity = 0.22,
}: { images: Slide[]; playing: boolean; intervalMs?: number; opacity?: number; }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!playing || images.length < 2) return;
    const id = setInterval(() => setIdx(i => (i + 1) % images.length), intervalMs);
    return () => clearInterval(id);
  }, [playing, images.length, intervalMs]);
  if (!images.length) return null;
  const current = images[idx]?.url;
  return (
    <div className="bg-host">
      <img key={current} src={current} alt="Foto do Pedro" style={{ opacity }} />
      <div className="bg-grad" />
    </div>
  );
}

function TimerMenu({
  options, onPick,
}: { options: { title: string; seconds: number }[]; onPick: (s: number) => void }) {
  const powerIcons = useMemo(() => ["⚡","🛡️","🦸","🔥","🛰️","🪨","🗡️","🛸"], []);
  return (
    <div className="menu">
      <div className="grid">
        {options.map((opt, i) => (
          <button key={opt.title} className="menu-card" onClick={() => onPick(opt.seconds)}>
            <span className="menu-emoji">{powerIcons[i % powerIcons.length]}</span> {opt.title}
          </button>
        ))}
      </div>
    </div>
  );
}

function SandTimer({
  timeLeft, timeTotal, onPause, onRestart, onDone, insideUrl,
}: {
  timeLeft: number; timeTotal: number;
  onPause: () => void; onRestart: () => void; onDone: () => void;
  insideUrl?: string;
}) {
  const progress = timeTotal > 0 ? 1 - timeLeft / timeTotal : 0;
  const pct = Math.min(100, Math.max(0, progress * 100));
  const fmt = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
  return (
    <div className="timer-wrap">
      <div className="glass">
        {/* Slideshow dentro da ampulheta (se houver) */}
        {insideUrl && <img src={insideUrl} alt="" style={{
          position:"absolute", inset:0, width:"100%", height:"100%",
          objectFit:"cover", filter:"blur(2px)", transform:"scale(1.05)", opacity:.22
        }} />}
        <div className="fill" style={{ height: `${pct}%` }} />
        <div className="center-emoji">⚡</div>
      </div>
      <div className="time-left">{fmt(timeLeft)}</div>
      <p className="status">{timeLeft > 0 ? (timeLeft <= 10 ? "Carga máxima!" : "Energia em curso…") : "Missão concluída!"}</p>
      <div className="actions">
        <button className="btn" onClick={onPause}>Pausar</button>
        <button className="btn" onClick={onRestart}>Reiniciar</button>
        <button className="btn" onClick={onDone}>Concluir</button>
      </div>
    </div>
  );
}

/* ====== App único ====== */
export default function App() {
  const [screen, setScreen] = useState<"menu"|"tempo">("menu");
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeTotal, setTimeTotal] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const prevLeftRef = useRef<number>(0);
  const chime = useChime();

  const [slides, setSlides] = useLocalStorage<Slide[]>("pedro_slides", []);
  const [playing, setPlaying] = useLocalStorage<boolean>("pedro_slides_play", true);
  const [opacity, setOpacity] = useLocalStorage<number>("pedro_slides_opacity", 0.22);

  // Timer tick
  useEffect(() => {
    if (!isRunning) return;
    if (timeLeft <= 0) { setIsRunning(false); return; }
    const t = window.setTimeout(() => setTimeLeft(s => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [isRunning, timeLeft]);

  // Toca chime ao zerar
  useEffect(() => {
    if (prevLeftRef.current > 0 && timeLeft === 0) chime();
    prevLeftRef.current = timeLeft;
  }, [timeLeft, chime]);

  const startTimer = (seconds: number) => {
    setTimeTotal(seconds);
    setTimeLeft(seconds);
    setIsRunning(true);
    setScreen("tempo");
  };

  const timerOptions = [
    { title: "5 minutos", seconds: 5 * 60 },
    { title: "10 minutos", seconds: 10 * 60 },
    { title: "15 minutos", seconds: 15 * 60 },
    { title: "30 minutos", seconds: 30 * 60 },
    { title: "1 hora", seconds: 60 * 60 },
    { title: "2 horas", seconds: 120 * 60 },
  ];

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const onAddPhotos = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const readFile = (f: File) =>
      new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = reject;
        fr.readAsDataURL(f);
      });
    const newSlides: Slide[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      try {
        const dataUrl = await readFile(f);
        newSlides.push({ url: dataUrl });
      } catch {}
    }
    if (newSlides.length) setSlides(prev => [...prev, ...newSlides]);
  };

  const currentInsideUrl = slides[0]?.url; // simples: usa a 1ª foto dentro da ampulheta

  return (
    <div className="app">
      {/* estilos locais */}
      <style>{styles}</style>

      {/* fundo com slideshow */}
      <PhotoSlideshow images={slides} playing={playing} opacity={opacity} />

      {/* “brilho” sutil (SVG) */}
      <svg className="hero-svg" aria-hidden>
        <defs>
          <pattern id="dots" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.06)" />
          </pattern>
          <radialGradient id="rad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)" />
        <rect width="100%" height="100%" fill="url(#rad)" />
      </svg>

      {/* cabeçalho */}
      <header className="header">
        <h1 className="title">Forças do Tempo</h1>
        <p className="subtitle">Escolha seu poder do tempo e ative a missão! 🦸</p>
      </header>

      {/* barra de controles */}
      <div className="toolbar">
        <button className="btn" onClick={() => fileInputRef.current?.click()}>Adicionar fotos</button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => onAddPhotos(e.target.files)}
        />
        <button className="btn" onClick={() => setPlaying(p => !p)}>
          {playing ? "Pausar slideshow" : "Reproduzir slideshow"}
        </button>
        <label className="range">
          Opacidade
          <input
            type="range" min={0.05} max={0.6} step={0.01}
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
          />
        </label>
        {slides.length > 0 && (
          <>
            <div className="thumbbar">
              {slides.map((s, i) => (
                <img key={i} src={s.url} alt="" onClick={() => setSlides(prev => prev.filter((_, idx) => idx !== i))} />
              ))}
            </div>
            <button className="btn btn-danger" onClick={() => setSlides([])}>Limpar fotos</button>
          </>
        )}
      </div>

      {/* telas */}
      {screen === "menu" && <TimerMenu options={timerOptions} onPick={startTimer} />}

      {screen === "tempo" && (
        <SandTimer
          timeLeft={timeLeft}
          timeTotal={timeTotal}
          onPause={() => setIsRunning(false)}
          onRestart={() => { setTimeLeft(timeTotal); setIsRunning(true); }}
          onDone={() => { setScreen("menu"); setIsRunning(false); }}
          insideUrl={currentInsideUrl}
        />
      )}
    </div>
  );
}
