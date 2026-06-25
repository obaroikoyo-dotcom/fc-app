import { useEffect, useRef, useState } from "react";

interface Props {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [phase, setPhase] = useState<"fadein" | "glitch" | "fadeout">("fadein");
  const [logoOpacity, setLogoOpacity] = useState(0);
  const [logoScale, setLogoScale] = useState(0.92);
  const glitchRaf = useRef<number>(0);

  useEffect(() => {
    // Fade logo in
    const tFade = setTimeout(() => {
      setLogoOpacity(1);
      setLogoScale(1);
    }, 100);
    const t1 = setTimeout(() => setPhase("glitch"), 1200);
    const t2 = setTimeout(() => setPhase("fadeout"), 2300);
    const t3 = setTimeout(() => onComplete(), 3100);
    return () => { clearTimeout(tFade); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    if (phase !== "glitch") return;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const size = 120;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    const startTime = performance.now();
    const duration = 900;

    function drawGlitch() {
      const elapsed = performance.now() - startTime;
      const progress = elapsed / duration;

      ctx.clearRect(0, 0, size, size);

      // Base image
      ctx.drawImage(img!, 0, 0, size, size);

      // Number of slices increases mid-glitch then calms
      const intensity = Math.sin(progress * Math.PI);
      const sliceCount = Math.floor(3 + intensity * 10);

      for (let i = 0; i < sliceCount; i++) {
        const sliceY = Math.random() * size;
        const sliceH = Math.random() * 18 + 2;
        const shiftX = (Math.random() - 0.5) * 30 * intensity;

        // RGB channel split
        ctx.save();
        ctx.globalCompositeOperation = "source-over";

        // Red channel shifted left
        ctx.globalAlpha = 0.6;
        ctx.filter = "url(#red)";
        ctx.drawImage(img!, 0, sliceY, size, sliceH, shiftX - 6, sliceY, size, sliceH);

        // Cyan channel shifted right
        ctx.filter = "url(#cyan)";
        ctx.drawImage(img!, 0, sliceY, size, sliceH, shiftX + 6, sliceY, size, sliceH);

        ctx.filter = "none";
        ctx.globalAlpha = 1;

        // Main slice shifted
        ctx.drawImage(img!, 0, sliceY, size, sliceH, shiftX, sliceY, size, sliceH);
        ctx.restore();
      }

      // Scanline flicker
      if (Math.random() > 0.5) {
        ctx.save();
        ctx.globalAlpha = 0.08 * intensity;
        ctx.fillStyle = "#fff";
        for (let y = 0; y < size; y += 4) {
          ctx.fillRect(0, y, size, 1);
        }
        ctx.restore();
      }

      // Digital noise blocks
      if (Math.random() > 0.6) {
        const bx = Math.random() * size;
        const by = Math.random() * size;
        const bw = Math.random() * 40 + 10;
        const bh = Math.random() * 8 + 2;
        ctx.save();
        ctx.globalAlpha = 0.15 * intensity;
        ctx.fillStyle = Math.random() > 0.5 ? "#fff" : "#000";
        ctx.fillRect(bx, by, bw, bh);
        ctx.restore();
      }

      if (elapsed < duration) {
        glitchRaf.current = requestAnimationFrame(drawGlitch);
      } else {
        // Draw clean final frame
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img!, 0, 0, size, size);
      }
    }

    glitchRaf.current = requestAnimationFrame(drawGlitch);
    return () => { if (glitchRaf.current) cancelAnimationFrame(glitchRaf.current); };
  }, [phase]);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#0a0a0a",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999,
      opacity: phase === "fadeout" ? 0 : 1,
      transition: phase === "fadeout" ? "opacity 0.9s ease" : "none",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@800&display=swap');
        @keyframes fadein {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Hidden SVG filters for RGB split */}
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <defs>
          <filter id="red">
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/>
          </filter>
          <filter id="cyan">
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"/>
          </filter>
        </defs>
      </svg>

      {/* Preload image for canvas */}
      <img
        ref={imgRef}
        src="/logo.png"
        crossOrigin="anonymous"
        style={{ display: "none" }}
      />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px" }}>
        <div style={{ position: "relative", width: 120, height: 120 }}>
          {/* Normal logo — hidden during glitch */}
          <img
            src="/logo.png"
            style={{
              width: 120, height: 120, objectFit: "contain",
              opacity: phase === "glitch" ? 0 : logoOpacity,
              transform: `scale(${logoScale})`,
              transition: "opacity 0.8s ease, transform 0.8s cubic-bezier(0.16,1,0.3,1)",
              position: "absolute", inset: 0,
            }}
          />
          {/* Canvas glitch layer */}
          <canvas
            ref={canvasRef}
            style={{
              width: 120, height: 120,
              opacity: phase === "glitch" ? 1 : 0,
              position: "absolute", inset: 0,
            }}
          />
        </div>

        <p style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: "26px",
          fontWeight: 800,
          color: "#fff",
          letterSpacing: "-0.02em",
          margin: 0,
          opacity: phase === "fadein" ? 0 : 1,
          transform: phase === "fadein" ? "translateY(6px)" : "translateY(0)",
          transition: "opacity 0.5s ease 0.4s, transform 0.5s ease 0.4s",
        }}>
          FlipCollab
        </p>
      </div>
    </div>
  );
}