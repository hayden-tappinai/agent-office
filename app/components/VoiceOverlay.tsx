"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";

// ─── Constants ──────────────────────────────────────────────────
const SENTENCE_REGEX = /[^.!?]*[.!?]+/g;
const GROWTH_THRESHOLD = 40;
const MIN_CHUNK_LENGTH = 10;
const CONTEXT_WINDOW_SIZE = 4;

// ─── Hook: useScribeVoice ───────────────────────────────────────
function useScribeVoice(onChunk: (text: string, context: string[]) => void) {
  const [listening, setListening] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [interim, setInterim] = useState("");
  const [hearingSpeech, setHearingSpeech] = useState(false);

  const lastProcessedLengthRef = useRef(0);
  const processedSentencesRef = useRef<Set<string>>(new Set());
  const contextBufferRef = useRef<string[]>([]);
  const vadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChunkRef = useRef(onChunk);
  useEffect(() => { onChunkRef.current = onChunk; }, [onChunk]);

  const emitChunk = useCallback((text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < MIN_CHUNK_LENGTH) return;
    if (processedSentencesRef.current.has(trimmed)) return;

    processedSentencesRef.current.add(trimmed);
    const context = [...contextBufferRef.current];
    onChunkRef.current(trimmed, context);

    contextBufferRef.current.push(trimmed);
    if (contextBufferRef.current.length > CONTEXT_WINDOW_SIZE) {
      contextBufferRef.current.shift();
    }
  }, []);

  const processSentences = useCallback((text: string) => {
    const matches = text.match(SENTENCE_REGEX);
    if (!matches) return;
    for (const sentence of matches) {
      emitChunk(sentence);
    }
  }, [emitChunk]);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => {
      const text = (data.text || "").trim();
      if (!text) return;

      setInterim(text);
      setHearingSpeech(true);

      if (vadTimerRef.current) clearTimeout(vadTimerRef.current);
      vadTimerRef.current = setTimeout(() => setHearingSpeech(false), 1500);

      if (text.length > lastProcessedLengthRef.current + GROWTH_THRESHOLD) {
        processSentences(text);
        lastProcessedLengthRef.current = text.length;
      }
    },
    onCommittedTranscript: (data) => {
      const text = (data.text || "").trim();
      setInterim("");
      lastProcessedLengthRef.current = 0;

      if (text.length >= MIN_CHUNK_LENGTH) {
        emitChunk(text);
      }
    },
  });

  const start = useCallback(async () => {
    if (listening || connecting) return;
    setConnecting(true);

    try {
      // Request mic permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get token from our API route
      const tokenRes = await fetch("/api/scribe-token", { method: "POST" });
      const tokenData = await tokenRes.json();
      if (!tokenData.token) {
        throw new Error(tokenData.error || "Failed to get scribe token");
      }

      // Connect via useScribe — handles audio capture, WebSocket, VAD
      await scribe.connect({
        token: tokenData.token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      lastProcessedLengthRef.current = 0;
      processedSentencesRef.current.clear();
      setListening(true);
    } catch (err) {
      console.warn("[Scribe] Start error:", err);
    } finally {
      setConnecting(false);
    }
  }, [listening, connecting, scribe]);

  const stop = useCallback(() => {
    // Grab remaining partial text BEFORE disconnecting (disconnect may clear it)
    let remaining: string | undefined;
    try {
      remaining = scribe.partialTranscript?.trim();
    } catch {
      // partialTranscript may throw if scribe is already disconnected
    }

    try {
      scribe.disconnect();
    } catch (err) {
      console.warn("[Scribe] disconnect error (safe to ignore):", err);
    }

    if (remaining && remaining.length >= MIN_CHUNK_LENGTH) {
      const sentences = remaining.match(SENTENCE_REGEX);
      if (sentences) {
        for (const s of sentences) {
          emitChunk(s);
        }
      } else if (!processedSentencesRef.current.has(remaining)) {
        emitChunk(remaining);
      }
    }

    if (vadTimerRef.current) {
      clearTimeout(vadTimerRef.current);
      vadTimerRef.current = null;
    }

    lastProcessedLengthRef.current = 0;
    processedSentencesRef.current.clear();
    setListening(false);
    setInterim("");
    setHearingSpeech(false);
  }, [scribe, emitChunk]);

  const toggle = useCallback(() => {
    if (listening || connecting) stop();
    else start();
  }, [listening, connecting, start, stop]);

  return { listening, connecting, interim, hearingSpeech, toggle };
}

// ─── MicButton ──────────────────────────────────────────────────
function MicButton({
  listening,
  connecting,
  hearingSpeech,
  onClick,
}: {
  listening: boolean;
  connecting: boolean;
  hearingSpeech: boolean;
  onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tRef = useRef(0);

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

      const micColor = connecting ? "#FF8C42" : listening ? "#4A9EF0" : "#999999";

      const px = 2;
      const ox = 12;
      const oy = 6;

      // Mic head
      ctx.fillStyle = micColor;
      ctx.fillRect(ox + 4 * px, oy + 0 * px, 4 * px, 1 * px);
      ctx.fillRect(ox + 3 * px, oy + 1 * px, 6 * px, 1 * px);
      ctx.fillRect(ox + 3 * px, oy + 2 * px, 6 * px, 1 * px);
      ctx.fillRect(ox + 3 * px, oy + 3 * px, 6 * px, 1 * px);
      ctx.fillRect(ox + 3 * px, oy + 4 * px, 6 * px, 1 * px);
      ctx.fillRect(ox + 3 * px, oy + 5 * px, 6 * px, 1 * px);
      ctx.fillRect(ox + 3 * px, oy + 6 * px, 6 * px, 1 * px);
      ctx.fillRect(ox + 4 * px, oy + 7 * px, 4 * px, 1 * px);
      // Detail lines
      ctx.fillStyle = connecting ? "#b86a20" : listening ? "#3578b8" : "#777777";
      ctx.fillRect(ox + 4 * px, oy + 3 * px, 4 * px, 1 * px);
      ctx.fillRect(ox + 4 * px, oy + 5 * px, 4 * px, 1 * px);
      // Stand
      ctx.fillStyle = micColor;
      ctx.fillRect(ox + 2 * px, oy + 7 * px, 1 * px, 1 * px);
      ctx.fillRect(ox + 9 * px, oy + 7 * px, 1 * px, 1 * px);
      ctx.fillRect(ox + 2 * px, oy + 8 * px, 1 * px, 1 * px);
      ctx.fillRect(ox + 9 * px, oy + 8 * px, 1 * px, 1 * px);
      ctx.fillRect(ox + 3 * px, oy + 9 * px, 6 * px, 1 * px);
      ctx.fillRect(ox + 5 * px, oy + 10 * px, 2 * px, 1 * px);
      ctx.fillRect(ox + 5 * px, oy + 11 * px, 2 * px, 1 * px);
      ctx.fillRect(ox + 3 * px, oy + 12 * px, 6 * px, 1 * px);

      // VU bars when hearing speech
      if (listening && hearingSpeech) {
        for (let i = 0; i < 3; i++) {
          const barH = Math.sin(t * 0.12 + i * 1.2) * 6 + 7;
          const barX = 40 + i * 4;
          const barY = 28 - barH / 2;
          ctx.fillStyle = "rgba(74, 158, 240, 0.8)";
          ctx.fillRect(barX, barY, 2, barH);
        }
      }

      // Connecting spinner
      if (connecting) {
        const angle = t * 0.15;
        ctx.strokeStyle = "#FF8C42";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(28, 28, 24, angle, angle + Math.PI * 1.2);
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [listening, connecting, hearingSpeech]);

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <button
      role="switch"
      aria-checked={listening}
      aria-label={connecting ? "Connecting microphone..." : "Microphone"}
      onClick={onClick}
      disabled={connecting}
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        zIndex: 1100,
        border: `2px solid ${connecting ? "#FF8C42" : listening ? "#4A9EF0" : "#3a5a7a"}`,
        borderRadius: 8,
        background: "#1a1a2e",
        cursor: connecting ? "wait" : "pointer",
        padding: 0,
        outline: "none",
        boxShadow:
          listening && !prefersReduced
            ? `0 0 0 ${4 + 4 * Math.abs(Math.sin(Date.now() * 0.003))}px rgba(74, 158, 240, 0.3)`
            : "0 2px 8px rgba(0,0,0,0.3)",
        transition: "border-color 200ms, transform 100ms",
        animation:
          listening && !prefersReduced
            ? "micPulse 1.5s infinite ease-in-out"
            : undefined,
        opacity: connecting ? 0.8 : 1,
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
        border: `1px solid ${goldFlash ? "rgba(74, 158, 240, 1)" : "rgba(74, 158, 240, 0.3)"}`,
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

  const handleChunk = useCallback(
    async (text: string, context: string[]) => {
      setLastFinal(text);
      setTranscriptVisible(true);
      setGoldFlash(true);

      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);

      setTimeout(() => setGoldFlash(false), 300);

      fadeTimerRef.current = setTimeout(() => {
        setTranscriptVisible(false);
        setTimeout(() => setLastFinal(""), 600);
      }, 5000);

      onWireThinking(true, text);

      try {
        const res = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, context }),
        });
        const data = await res.json();
        if (!data.ok) {
          console.warn("[Voice] API error:", data.error);
        }
      } catch (err) {
        console.warn("[Voice] Fetch error:", err);
      }

      setTimeout(() => onWireThinking(false), 15000);
    },
    [onWireThinking]
  );

  const { listening, connecting, interim, hearingSpeech, toggle } =
    useScribeVoice(handleChunk);

  useEffect(() => {
    if (interim) {
      setTranscriptVisible(true);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    }
  }, [interim]);

  // Keyboard shortcut: M to toggle mic
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

        const msg = connecting
          ? "🎙️ Connecting..."
          : listening
            ? "🎙️ Mic off"
            : "🎙️ Mic on — Scribe v2";
        setToast(msg);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast(null), 1500);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle, listening, connecting]);

  return (
    <>
      <MicButton
        listening={listening}
        connecting={connecting}
        hearingSpeech={hearingSpeech}
        onClick={toggle}
      />
      <TranscriptDisplay
        interim={interim}
        lastFinal={lastFinal}
        goldFlash={goldFlash}
        visible={transcriptVisible}
      />
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 88,
            right: 24,
            zIndex: 1100,
            background: "rgba(26, 26, 46, 0.9)",
            border: "1px solid rgba(74, 158, 240, 0.4)",
            borderRadius: 4,
            padding: "6px 12px",
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 10,
            color: "#4A9EF0",
            animation: "dialogueSlideUp 150ms ease-out",
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
