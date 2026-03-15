"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ─── Types ──────────────────────────────────────────────────────
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

// ─── Hook: useVoice ─────────────────────────────────────────────
function useVoice(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [hearingSpeech, setHearingSpeech] = useState(false);
  const recognitionRef = useRef<any>(null);
  const shouldRestartRef = useRef(false);

  const start = useCallback(() => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";

    r.onstart = () => {
      setListening(true);
    };

    r.onspeechstart = () => setHearingSpeech(true);
    r.onspeechend = () => setHearingSpeech(false);

    r.onresult = (e: SpeechRecognitionEvent) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text) onFinal(text);
        } else {
          interimText += result[0].transcript;
        }
      }
      setInterim(interimText);
    };

    r.onerror = (e: SpeechRecognitionErrorEvent) => {
      // "aborted" is normal when we stop manually; "no-speech" is benign
      if (e.error === "aborted" || e.error === "no-speech") return;
      console.warn("[Voice] SpeechRecognition error:", e.error);
    };

    r.onend = () => {
      setHearingSpeech(false);
      // Auto-restart for always-on (Chrome stops after silence; Safari stops at 60s)
      if (shouldRestartRef.current) {
        try {
          r.start();
        } catch {
          // Already started or disposed — ignore
        }
      } else {
        setListening(false);
        setInterim("");
      }
    };

    shouldRestartRef.current = true;
    recognitionRef.current = r;
    try {
      r.start();
    } catch {
      // ignore
    }
  }, [onFinal]);

  const stop = useCallback(() => {
    shouldRestartRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setInterim("");
    setHearingSpeech(false);
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return { listening, interim, hearingSpeech, toggle };
}

// ─── MicButton ──────────────────────────────────────────────────
function MicButton({
  listening,
  hearingSpeech,
  onClick,
}: {
  listening: boolean;
  hearingSpeech: boolean;
  onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tRef = useRef(0);

  // Animate VU bars + mic icon on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;

    const draw = () => {
      tRef.current++;
      const t = tRef.current;
      ctx.clearRect(0, 0, 56, 56);
      ctx.imageSmoothingEnabled = false;

      const micColor = listening ? "#FFD700" : "#999999";

      // Draw pixel art microphone (centered, 16x24 native, 2x scale)
      const px = 2;
      const ox = 12; // offset x
      const oy = 6; // offset y

      // Mic head (rounded top)
      ctx.fillStyle = micColor;
      ctx.fillRect(ox + 4 * px, oy + 0 * px, 4 * px, 1 * px); // top
      ctx.fillRect(ox + 3 * px, oy + 1 * px, 6 * px, 1 * px); // wider
      ctx.fillRect(ox + 3 * px, oy + 2 * px, 6 * px, 1 * px);
      ctx.fillRect(ox + 3 * px, oy + 3 * px, 6 * px, 1 * px);
      // Mic body
      ctx.fillRect(ox + 3 * px, oy + 4 * px, 6 * px, 1 * px);
      ctx.fillRect(ox + 3 * px, oy + 5 * px, 6 * px, 1 * px);
      ctx.fillRect(ox + 3 * px, oy + 6 * px, 6 * px, 1 * px);
      ctx.fillRect(ox + 4 * px, oy + 7 * px, 4 * px, 1 * px); // bottom rounded
      // Mic cage lines (detail)
      ctx.fillStyle = listening ? "#b8960a" : "#777777";
      ctx.fillRect(ox + 4 * px, oy + 3 * px, 4 * px, 1 * px);
      ctx.fillRect(ox + 4 * px, oy + 5 * px, 4 * px, 1 * px);
      // Stand arc
      ctx.fillStyle = micColor;
      ctx.fillRect(ox + 2 * px, oy + 7 * px, 1 * px, 1 * px); // left arc
      ctx.fillRect(ox + 9 * px, oy + 7 * px, 1 * px, 1 * px); // right arc
      ctx.fillRect(ox + 2 * px, oy + 8 * px, 1 * px, 1 * px);
      ctx.fillRect(ox + 9 * px, oy + 8 * px, 1 * px, 1 * px);
      ctx.fillRect(ox + 3 * px, oy + 9 * px, 6 * px, 1 * px); // bottom of arc
      // Stand post
      ctx.fillRect(ox + 5 * px, oy + 10 * px, 2 * px, 1 * px);
      ctx.fillRect(ox + 5 * px, oy + 11 * px, 2 * px, 1 * px);
      // Base
      ctx.fillRect(ox + 3 * px, oy + 12 * px, 6 * px, 1 * px);

      // VU bars when hearing speech
      if (listening && hearingSpeech) {
        for (let i = 0; i < 3; i++) {
          const barH = Math.sin(t * 0.12 + i * 1.2) * 6 + 7;
          const barX = 40 + i * 4;
          const barY = 28 - barH / 2;
          ctx.fillStyle = "rgba(255, 215, 0, 0.8)";
          ctx.fillRect(barX, barY, 2, barH);
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [listening, hearingSpeech]);

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <button
      role="switch"
      aria-checked={listening}
      aria-label="Microphone"
      onClick={onClick}
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        zIndex: 1100,
        border: `2px solid ${listening ? "#FFD700" : "#3a5a7a"}`,
        borderRadius: 8,
        background: "#1a1a2e",
        cursor: "pointer",
        padding: 0,
        outline: "none",
        boxShadow:
          listening && !prefersReduced
            ? `0 0 0 ${4 + 4 * Math.abs(Math.sin(Date.now() * 0.003))}px rgba(255, 215, 0, 0.3)`
            : "0 2px 8px rgba(0,0,0,0.3)",
        transition: "border-color 200ms, transform 100ms",
        animation:
          listening && !prefersReduced
            ? "micPulse 1.5s infinite ease-in-out"
            : undefined,
      }}
      onMouseDown={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "scale(0.92)";
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "scale(1)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "scale(1)";
      }}
    >
      <canvas
        ref={canvasRef}
        width={56}
        height={56}
        style={{ imageRendering: "pixelated", width: 56, height: 56 }}
      />
    </button>
  );
}

// ─── TranscriptDisplay ──────────────────────────────────────────
function TranscriptDisplay({
  interim,
  lastFinal,
  goldFlash,
  visible,
}: {
  interim: string;
  lastFinal: string;
  goldFlash: boolean;
  visible: boolean;
}) {
  if (!visible && !interim && !lastFinal) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 200,
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(80vw, 640px)",
        maxHeight: 80,
        padding: "12px 16px",
        background: "rgba(26, 26, 46, 0.85)",
        border: `1px solid ${goldFlash ? "rgba(255, 215, 0, 1)" : "rgba(255, 215, 0, 0.3)"}`,
        borderRadius: 4,
        zIndex: 950,
        fontFamily: "'Press Start 2P', 'Courier New', monospace",
        fontSize: 11,
        lineHeight: 1.8,
        textAlign: "center",
        overflow: "hidden",
        opacity: visible ? 1 : 0,
        transition: "opacity 500ms, border-color 300ms, transform 300ms",
        pointerEvents: "none",
      }}
    >
      {lastFinal && (
        <span style={{ color: "#f0e6d3" }}>{lastFinal}</span>
      )}
      {interim && (
        <span style={{ color: "rgba(240, 230, 211, 0.5)", marginLeft: lastFinal ? 4 : 0 }}>
          {interim}
        </span>
      )}
    </div>
  );
}

// ─── VoiceOverlay (exported) ────────────────────────────────────
export default function VoiceOverlay({
  onWireThinking,
}: {
  onWireThinking: (thinking: boolean, transcript?: string) => void;
}) {
  const [lastFinal, setLastFinal] = useState("");
  const [goldFlash, setGoldFlash] = useState(false);
  const [transcriptVisible, setTranscriptVisible] = useState(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFinal = useCallback(
    async (text: string) => {
      setLastFinal(text);
      setTranscriptVisible(true);
      setGoldFlash(true);

      // Clear existing fade timer
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);

      // Gold flash for 300ms
      setTimeout(() => setGoldFlash(false), 300);

      // Fade after 5s of silence
      fadeTimerRef.current = setTimeout(() => {
        setTranscriptVisible(false);
        setTimeout(() => setLastFinal(""), 600);
      }, 5000);

      // Notify canvas that WIRE is thinking
      onWireThinking(true, text);

      // POST to /api/voice
      try {
        const res = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        if (!data.ok) {
          console.warn("[Voice] API error:", data.error);
        }
      } catch (err) {
        console.warn("[Voice] Fetch error:", err);
      }

      // Clear thinking after a reasonable delay (WIRE will respond via activity polling)
      setTimeout(() => onWireThinking(false), 15000);
    },
    [onWireThinking]
  );

  const { listening, interim, hearingSpeech, toggle } = useVoice(handleFinal);

  // Show transcript area when interim text appears
  useEffect(() => {
    if (interim) {
      setTranscriptVisible(true);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    }
  }, [interim]);

  // Keyboard shortcut: M to toggle mic (when no input focused)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "m" || e.key === "M") {
        const active = document.activeElement;
        if (
          active &&
          (active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            (active as HTMLElement).isContentEditable)
        )
          return;
        toggle();

        // Show toast
        const msg = listening ? "🎙️ Mic off" : "🎙️ Mic on";
        setToast(msg);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast(null), 1500);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle, listening]);

  return (
    <>
      <MicButton
        listening={listening}
        hearingSpeech={hearingSpeech}
        onClick={toggle}
      />
      <TranscriptDisplay
        interim={interim}
        lastFinal={lastFinal}
        goldFlash={goldFlash}
        visible={transcriptVisible}
      />
      {/* Toast for keyboard shortcut */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 88,
            right: 24,
            zIndex: 1100,
            background: "rgba(26, 26, 46, 0.9)",
            border: "1px solid rgba(255, 215, 0, 0.4)",
            borderRadius: 4,
            padding: "6px 12px",
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 10,
            color: "#FFD700",
            animation: "dialogueSlideUp 150ms ease-out",
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
