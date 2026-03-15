"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import VoiceOverlay from "./components/VoiceOverlay";

// ─── Types ──────────────────────────────────────────────────────
interface Vec2 {
  x: number;
  y: number;
}

interface Station {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  label: string;
}

interface ActiveAgent {
  id: string;
  task: string;
  startedAt: string;
}

interface RecentCompletion {
  id: string;
  task: string;
  completedAt: string;
}

interface ActivityData {
  activeAgents: ActiveAgent[];
  recentCompletions: RecentCompletion[];
}

type AgentActivity = "idle" | "active" | "completed";

interface Agent {
  id: string;
  name: string;
  role: string;
  station: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  sprite: HTMLImageElement | null;
  state: "idle" | "walking" | "working" | "getting_coffee" | "returning_coffee";
  stateTimer: number;
  idleTime: number;
  direction: "left" | "right";
  bobOffset: number;
  statusMsg: string;
  // Real-time activity
  activity: AgentActivity;
  currentTask: string;
  completedAt: number; // timestamp for fade-out
  // Coffee system
  coffeeCycleCounter: number;
  coffeeThreshold: number; // set once per coffee cycle, not re-rolled each tick
  coffeeIconAlpha: number; // fades after returning from coffee
  hasCoffee: boolean;
}

// ─── Dialogue & Interior Data ───────────────────────────────────
const AGENT_COLORS: Record<string, string> = {
  wire: "#FFD700", code: "#00FF88", look: "#FF6B9D", hunt: "#FF8C42",
  mail: "#42A5F5", plan: "#AB47BC", eyes: "#EF5350", sage: "#26A69A",
  snap: "#FFEE58", memo: "#8D6E63",
};

const AGENT_EMOJIS: Record<string, string> = {
  wire: "⚡", code: "💻", look: "🎨", hunt: "🔍",
  mail: "📧", plan: "📋", eyes: "👁️", sage: "🧠",
  snap: "📸", memo: "📝",
};

const AGENT_ROLES: Record<string, string> = {
  wire: "CEO / Orchestrator", code: "Builder", look: "Designer", hunt: "Scout",
  mail: "Comms", plan: "Strategist", eyes: "Code Critic", sage: "Advisor",
  snap: "Media Producer", memo: "Scribe",
};

// Coffee frequency: how many idle cycles before a coffee run (higher = rarer)
// Each idle cycle is ~3-5 seconds, so 720-1200 idle cycles ≈ 1 hour.
// Target: busiest agents get coffee ~once/hour, quiet agents almost never.
const COFFEE_FREQUENCY: Record<string, [number, number]> = {
  code: [500, 700], snap: [500, 700],                          // hardest workers, ~1 coffee/hour
  wire: [600, 800], hunt: [600, 800],                          // busy but slightly less
  eyes: [800, 1000], look: [800, 1000], sage: [800, 1000],    // moderate
  plan: [900, 1200],                                           // strategist, rarely needs coffee
  mail: [1500, 2000], memo: [1500, 2000],                      // barely ever
};

const AGENT_SAYINGS: Record<string, string[]> = {
  wire: ["Every task needs an owner. That's why you have me.", "I don't write code. I write briefs.", "Nine agents. One mission. Zero excuses."],
  code: ["Ship it or it didn't happen.", "If it compiles, it ships.", "I dream in TypeScript."],
  hunt: ["The answer is out there. I just have to find it.", "Google fears me.", "Every rabbit hole has a treasure."],
  snap: ["If I didn't record it, did it even happen?", "Every pixel tells a story.", "Lights. Camera. Automation."],
  look: ["If it's not beautiful, it's not done.", "Whitespace is not wasted space.", "The grid is my religion."],
  eyes: ["I've seen things you wouldn't believe... in your pull requests.", "LGTM means I actually looked.", "Your code is my morning newspaper."],
  sage: ["The wise architect builds the foundation before the walls.", "Have you considered the edge cases?", "Complexity is the enemy of reliability."],
  plan: ["A goal without a plan is just a wish.", "I see your sprint. I raise you a roadmap.", "Every minute planned saves ten in chaos."],
  mail: ["You have unread mail. You always have unread mail.", "I sorted your inbox before you woke up.", "Reply all is never the answer."],
  memo: ["If it's not written down, it didn't happen.", "Your future self will thank me.", "I remember so you don't have to."],
};

interface DialogueState {
  agentId: string;
  text: string;
  displayedText: string;
  isTyping: boolean;
  charIndex: number;
}

interface InteriorState {
  agentId: string;
  loaded: boolean;
}

// ─── Theme ──────────────────────────────────────────────────────
interface Theme {
  canvasBg: string;
  gridLine: string;
  stationFallback: string;
  stationStroke: string;
  commandGlow: string;
  stationLabel: string;
  hudTitle: string;
  hudSub: string;
  hudIdle: string;
  hudIdleText: string;
  clockColor: string;
  liveTextColor: string;
  idleDot: string;
  idleLineColor: string;
  shadowIdle: string;
  shadowActive: string;
  spotIdle: string;
  spotActive: string;
  nameFallback: string;
  wireNameColor: string;
  warRoomLabel: string;
  warRoomBorderIdle: string;
  warRoomFallbackBg: string;
  warRoomTableBg: string;
  warRoomTableStroke: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  tooltipRole: string;
  tooltipStatus: string;
  tooltipMeta: string;
  tooltipShadow: string;
  outerBg: string;
  agentCircleBg: string;
}

const LIGHT_THEME: Theme = {
  canvasBg: "#E8E8E8",
  gridLine: "rgba(0, 0, 0, 0.08)",
  stationFallback: "#D8D8D8",
  stationStroke: "#CCCCCC",
  commandGlow: "#00a0cc",
  stationLabel: "#333333",
  hudTitle: "#007799",
  hudSub: "#555555",
  hudIdle: "#558855",
  hudIdleText: "#558855",
  clockColor: "#555555",
  liveTextColor: "#338844",
  idleDot: "rgba(0, 120, 180, 0.5)",
  idleLineColor: "rgba(0, 0, 0, 0.06)",
  shadowIdle: "rgba(0, 0, 0, 0.10)",
  shadowActive: "rgba(200, 80, 20, 0.15)",
  spotIdle: "rgba(80, 160, 220, 0.10)",
  spotActive: "rgba(255, 140, 50, 0.18)",
  nameFallback: "#333333",
  wireNameColor: "#007799",
  warRoomLabel: "#555555",
  warRoomBorderIdle: "rgba(0, 0, 0, 0.15)",
  warRoomFallbackBg: "rgba(0, 0, 0, 0.04)",
  warRoomTableBg: "#D0D0D0",
  warRoomTableStroke: "rgba(0, 0, 0, 0.2)",
  tooltipBg: "#ffffff",
  tooltipBorder: "#CCCCCC",
  tooltipText: "#222222",
  tooltipRole: "#555555",
  tooltipStatus: "#333333",
  tooltipMeta: "#777777",
  tooltipShadow: "0 4px 20px rgba(0,0,0,0.12)",
  outerBg: "#E0E0E0",
  agentCircleBg: "rgba(255, 255, 255, 1.0)",
};

const DARK_THEME: Theme = {
  canvasBg: "#0a0a1a",
  gridLine: "#151530",
  stationFallback: "#1a1a2e",
  stationStroke: "#1e3a5f",
  commandGlow: "#00d4ff",
  stationLabel: "#4a6a8a",
  hudTitle: "#00d4ff",
  hudSub: "#3a5a7a",
  hudIdle: "#2a4a3a",
  hudIdleText: "#2a4a3a",
  clockColor: "#3a5a7a",
  liveTextColor: "#3a7a5a",
  idleDot: "rgba(0, 212, 255, 0.5)",
  idleLineColor: "rgba(0, 212, 255, 0.04)",
  shadowIdle: "rgba(0, 100, 200, 0.1)",
  shadowActive: "rgba(255, 100, 30, 0.15)",
  spotIdle: "rgba(80, 180, 255, 0.25)",
  spotActive: "rgba(255, 140, 50, 0.35)",
  nameFallback: "#6888a8",
  wireNameColor: "#00d4ff",
  warRoomLabel: "#4a3a6a",
  warRoomBorderIdle: "rgba(80, 60, 160, 0.2)",
  warRoomFallbackBg: "rgba(100, 60, 200, 0.06)",
  warRoomTableBg: "#15152a",
  warRoomTableStroke: "rgba(100, 80, 200, 0.25)",
  tooltipBg: "#0d1b2a",
  tooltipBorder: "#00d4ff",
  tooltipText: "#c0d8f0",
  tooltipRole: "#6888a8",
  tooltipStatus: "#88aacc",
  tooltipMeta: "#4a6a8a",
  tooltipShadow: "0 0 20px rgba(0,212,255,0.2)",
  outerBg: "#050510",
  agentCircleBg: "rgba(255, 255, 255, 1.0)",
};

// ─── Constants ──────────────────────────────────────────────────
const CANVAS_W = 1920;
const CANVAS_H = 1080;
const SPRITE_SIZE = 96;
const TILE = 40;

const WAR_ROOM = { x: 620, y: 780, w: 680, h: 260 };
const WAR_ROOM_CENTER = { x: WAR_ROOM.x + WAR_ROOM.w / 2, y: WAR_ROOM.y + WAR_ROOM.h / 2 };

const AGENTS_DATA: {
  id: string;
  name: string;
  role: string;
  station: string;
  status: string;
}[] = [
  { id: "wire", name: "WIRE", role: "CEO / Orchestrator", station: "command", status: "Coordinating team" },
  { id: "code", name: "CODE", role: "Builder", station: "coding", status: "Shipping features" },
  { id: "hunt", name: "HUNT", role: "Scout", station: "research", status: "Investigating leads" },
  { id: "snap", name: "SNAP", role: "Media Producer", station: "studio", status: "Generating assets" },
  { id: "plan", name: "PLAN", role: "Strategist", station: "whiteboard", status: "Planning sprints" },
  { id: "eyes", name: "EYES", role: "Code Critic", station: "review", status: "Reviewing PRs" },
  { id: "sage", name: "SAGE", role: "Advisor", station: "library", status: "Deep in thought" },
  { id: "mail", name: "MAIL", role: "Comms", station: "mailroom", status: "Triaging inbox" },
  { id: "memo", name: "MEMO", role: "Scribe", station: "filing", status: "Updating memory" },
  { id: "look", name: "LOOK", role: "Designer", station: "design", status: "Checking design system" },
];

const STATIONS: Station[] = [
  // Center command - WIRE (large, prominent)
  { name: "command", x: 720, y: 360, w: 480, h: 260, color: "#1a1a2e", label: "⚡ Command Center" },
  // Left wing - builders (bigger, spaced out)
  { name: "coding", x: 40, y: 120, w: 360, h: 200, color: "#16213e", label: "💻 Dev Bay" },
  { name: "review", x: 40, y: 380, w: 340, h: 200, color: "#1a1a2e", label: "👁️ Review Screens" },
  { name: "design", x: 40, y: 640, w: 360, h: 200, color: "#1a1a2e", label: "🎨 Design Wall" },
  // Right wing - research/strategy (bigger, spaced out)
  { name: "research", x: 1520, y: 120, w: 360, h: 200, color: "#16213e", label: "🔍 Research Lab" },
  { name: "library", x: 1520, y: 380, w: 360, h: 200, color: "#0f3460", label: "📚 Think Tank" },
  { name: "whiteboard", x: 1520, y: 640, w: 360, h: 200, color: "#1a1a2e", label: "📋 Strategy Board" },
  // Top - comms (bigger)
  { name: "studio", x: 440, y: 60, w: 340, h: 200, color: "#1a1a2e", label: "📸 Studio" },
  { name: "mailroom", x: 1140, y: 60, w: 340, h: 200, color: "#16213e", label: "📬 Mailroom" },
  // Bottom corners (bigger)
  { name: "filing", x: 40, y: 880, w: 340, h: 180, color: "#1a1a2e", label: "🗄️ Archives" },
  { name: "coffee", x: 1540, y: 880, w: 340, h: 180, color: "#2d1b4e", label: "☕ Coffee" },
];

// ─── Helpers ────────────────────────────────────────────────────
function stationCenter(s: Station): Vec2 {
  return { x: s.x + s.w / 2, y: s.y + s.h / 2 };
}

function dist(a: Vec2, b: Vec2): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function pickRandomStation(exclude: string): Station {
  const pool = STATIONS.filter((s) => s.name !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

function truncateTask(task: string, maxLen: number = 24): string {
  return task.length > maxLen ? task.slice(0, maxLen - 1) + "…" : task;
}

// War room slot positions (arranged around table)
function getWarRoomSlot(index: number, total: number): Vec2 {
  const cx = WAR_ROOM_CENTER.x;
  const cy = WAR_ROOM_CENTER.y;
  if (total <= 1) return { x: cx, y: cy - 10 };
  const angleStart = -Math.PI / 2;
  const angle = angleStart + (index / total) * Math.PI * 2;
  const rx = 120;
  const ry = 55;
  return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
}

// ─── Component ──────────────────────────────────────────────────
export default function AgentOffice() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const agentsRef = useRef<Agent[]>([]);
  const activityRef = useRef<ActivityData>({ activeAgents: [], recentCompletions: [] });
  const spritesLoadedRef = useRef(false);
  const [tooltip, setTooltip] = useState<{
    agent: Agent;
    x: number;
    y: number;
  } | null>(null);
  const [, setActiveCount] = useState(0);
  const [isDark, setIsDark] = useState(false); // Light mode default
  const themeRef = useRef<Theme>(LIGHT_THEME);
  const timeRef = useRef(0);
  const stationImagesRef = useRef<Record<string, HTMLImageElement>>({});
  const warRoomImageRef = useRef<HTMLImageElement | null>(null);
  const coffeeCountsRef = useRef<Record<string, number>>({});

  // Voice / WIRE thinking state
  const [wireThinking, setWireThinking] = useState(false);
  const wireThinkingRef = useRef(false);
  const wireThinkingTranscriptRef = useRef("");

  const handleWireThinking = useCallback((thinking: boolean, transcript?: string) => {
    setWireThinking(thinking);
    wireThinkingRef.current = thinking;
    wireThinkingTranscriptRef.current = transcript || "";
  }, []);

  // Dialogue state
  const [dialogue, setDialogue] = useState<DialogueState | null>(null);
  const dialogueRef = useRef<DialogueState | null>(null);
  const lastSaidRef = useRef<Record<string, number>>({}); // agentId -> last saying index
  const typewriterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Interior popup state
  const [interior, setInterior] = useState<InteriorState | null>(null);
  const interiorImageCache = useRef<Record<string, HTMLImageElement>>({});

  // Keep themeRef in sync
  useEffect(() => {
    themeRef.current = isDark ? DARK_THEME : LIGHT_THEME;
  }, [isDark]);

  // ─── Dialogue helpers ──────────────────────────────────────────
  const openDialogue = useCallback((agentId: string) => {
    // Clear any existing typewriter
    if (typewriterTimerRef.current) {
      clearTimeout(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }

    // Close interior if open
    setInterior(null);

    // Pick a random saying (no repeat last)
    const sayings = AGENT_SAYINGS[agentId] || ["..."];
    const lastIndex = lastSaidRef.current[agentId] ?? -1;
    let idx: number;
    do {
      idx = Math.floor(Math.random() * sayings.length);
    } while (idx === lastIndex && sayings.length > 1);
    lastSaidRef.current[agentId] = idx;

    const text = sayings[idx];
    const newDialogue: DialogueState = {
      agentId,
      text,
      displayedText: "",
      isTyping: true,
      charIndex: 0,
    };
    setDialogue(newDialogue);
    dialogueRef.current = newDialogue;
  }, []);

  const closeDialogue = useCallback(() => {
    if (typewriterTimerRef.current) {
      clearTimeout(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }
    setDialogue(null);
    dialogueRef.current = null;
  }, []);

  // Typewriter effect
  useEffect(() => {
    if (!dialogue || !dialogue.isTyping) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setDialogue((d) => d ? { ...d, displayedText: d.text, isTyping: false, charIndex: d.text.length } : null);
      return;
    }

    const typeNext = () => {
      setDialogue((prev) => {
        if (!prev || !prev.isTyping) return prev;
        if (prev.charIndex >= prev.text.length) {
          return { ...prev, isTyping: false };
        }

        const char = prev.text[prev.charIndex];
        const next = {
          ...prev,
          displayedText: prev.text.slice(0, prev.charIndex + 1),
          charIndex: prev.charIndex + 1,
        };

        // Schedule next character with punctuation pauses
        let delay = 35;
        if (char === "," ) delay = 150;
        else if (char === "." || char === "!" || char === "?") delay = 300;
        else if (char === "—" || char === "…") delay = 200;

        if (next.charIndex < next.text.length) {
          typewriterTimerRef.current = setTimeout(typeNext, delay);
        }

        return next;
      });
    };

    typewriterTimerRef.current = setTimeout(typeNext, 35);
    return () => {
      if (typewriterTimerRef.current) clearTimeout(typewriterTimerRef.current);
    };
  }, [dialogue?.agentId, dialogue?.text]); // Re-run when new dialogue opens

  // ─── Interior helpers ─────────────────────────────────────────
  const openInterior = useCallback((agentId: string) => {
    // Close dialogue
    closeDialogue();
    // Lock body scroll
    document.body.style.overflow = "hidden";

    // Start loading image if not cached
    const cached = interiorImageCache.current[agentId];
    if (cached && cached.complete) {
      setInterior({ agentId, loaded: true });
    } else {
      setInterior({ agentId, loaded: false });
      const img = new Image();
      img.src = `/interiors/interior-${agentId}.png`;
      img.onload = () => {
        interiorImageCache.current[agentId] = img;
        setInterior((prev) => prev?.agentId === agentId ? { ...prev, loaded: true } : prev);
      };
      interiorImageCache.current[agentId] = img;
    }
  }, [closeDialogue]);

  const closeInterior = useCallback(() => {
    document.body.style.overflow = "";
    setInterior(null);
  }, []);

  // Global key handler for Escape and dismiss
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (interior) {
        if (e.key === "Escape") closeInterior();
        return;
      }
      if (dialogue) {
        // Any key dismisses dialogue
        closeDialogue();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dialogue, interior, closeDialogue, closeInterior]);

  // Load sprites + init agents
  useEffect(() => {
    let loaded = 0;
    const total = AGENTS_DATA.length;

    const agents: Agent[] = AGENTS_DATA.map((a) => {
      const station = STATIONS.find((s) => s.name === a.station)!;
      const center = stationCenter(station);
      const img = new Image();
      img.src = `/sprites/${a.id}.png`;
      img.onload = () => {
        loaded++;
        if (loaded === total) spritesLoadedRef.current = true;
      };
      const freq = COFFEE_FREQUENCY[a.id] || [40, 60];
      const initialThreshold = freq[0] + Math.floor(Math.random() * (freq[1] - freq[0] + 1));
      return {
        id: a.id,
        name: a.name,
        role: a.role,
        station: a.station,
        x: center.x + (Math.random() - 0.5) * 40,
        y: center.y + (Math.random() - 0.5) * 30,
        targetX: center.x,
        targetY: center.y,
        speed: 1.5 + Math.random() * 1.0,
        sprite: img,
        state: "idle",
        stateTimer: Math.random() * 300 + 100,
        idleTime: 0,
        direction: "right" as const,
        bobOffset: Math.random() * Math.PI * 2,
        statusMsg: a.status,
        activity: "idle" as AgentActivity,
        currentTask: "",
        completedAt: 0,
        coffeeCycleCounter: Math.floor(Math.random() * initialThreshold), // stagger initial
        coffeeThreshold: initialThreshold, // set once, re-rolled only after coffee
        coffeeIconAlpha: 0,
        hasCoffee: false,
      };
    });

    agentsRef.current = agents;

    // Load station images
    const stationImageMap: Record<string, string> = {
      command: "/station-wire.png",
      coding: "/station-code.png",
      research: "/station-hunt.png",
      studio: "/station-snap.png",
      design: "/station-look.png",
      review: "/station-eyes.png",
      library: "/station-sage.png",
      whiteboard: "/station-plan.png",
      mailroom: "/station-mail.png",
      filing: "/station-memo.png",
      coffee: "/station-coffee.png",
    };
    for (const [stationName, src] of Object.entries(stationImageMap)) {
      const img = new Image();
      img.src = src;
      stationImagesRef.current[stationName] = img;
    }
    const wrImg = new Image();
    wrImg.src = "/station-warroom.png";
    warRoomImageRef.current = wrImg;
  }, []);

  // Poll /api/activity every 5 seconds
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/activity");
        if (res.ok) {
          const data: ActivityData = await res.json();
          activityRef.current = data;
          setActiveCount(data.activeAgents.length);

          // Update agent activity states
          const activeIds = new Set(data.activeAgents.map((a) => a.id));
          const completedIds = new Set(data.recentCompletions.map((c) => c.id));

          for (const agent of agentsRef.current) {
            if (activeIds.has(agent.id)) {
              agent.activity = "active";
              const activeData = data.activeAgents.find((a) => a.id === agent.id);
              agent.currentTask = activeData?.task || "";
              agent.statusMsg = activeData?.task || agent.statusMsg;
            } else if (completedIds.has(agent.id)) {
              if (agent.activity === "active") {
                // Just transitioned to completed
                agent.activity = "completed";
                agent.completedAt = Date.now();
              } else if (agent.activity === "completed") {
                // Already completing, check if fade is done
                if (Date.now() - agent.completedAt > 10_000) {
                  agent.activity = "idle";
                  agent.currentTask = "";
                }
              }
            } else {
              if (agent.activity === "completed" && Date.now() - agent.completedAt < 10_000) {
                // Still showing completion animation
              } else {
                agent.activity = "idle";
                agent.currentTask = "";
              }
            }
          }
        }
      } catch {
        // Silently handle fetch errors
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);

  // Game loop
  useEffect(() => {
    let animId: number;

    const idleStatuses: Record<string, string[]> = {
      wire: ["Coordinating team", "Reviewing agent output", "Prioritizing tasks", "Checking Slack"],
      code: ["Shipping features", "Fixing bugs", "Writing tests", "npm install"],
      hunt: ["Investigating leads", "Deep web search", "Reading API docs", "Competitive analysis"],
      snap: ["Generating assets", "Recording walkthrough", "Editing video", "Processing frames"],
      plan: ["Planning sprints", "Prepping standup", "Updating roadmap", "Calendar review"],
      eyes: ["Reviewing PRs", "BLOCK on line 42", "Running linter", "Checking types"],
      sage: ["Deep in thought", "Architecture review", "Risk assessment", "Thinking..."],
      mail: ["Triaging inbox", "Drafting reply", "LinkedIn outreach", "Scheduling send"],
      memo: ["Updating memory", "Filing notes", "Cross-referencing", "Daily summary"],
      look: ["Checking design system", "Pixel auditing", "Color review", "Responsive check"],
    };

    const tick = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d")!;
      timeRef.current++;
      const t = timeRef.current;

      const { activeAgents } = activityRef.current;
      const activeIds = new Set(activeAgents.map((a) => a.id));
      const anyActive = activeIds.size > 0;

      const theme = themeRef.current;

      // Clear
      ctx.fillStyle = theme.canvasBg;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Draw floor grid
      ctx.strokeStyle = theme.gridLine;
      ctx.lineWidth = 1;
      for (let x = 0; x < CANVAS_W; x += TILE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_H);
        ctx.stroke();
      }
      for (let y = 0; y < CANVAS_H; y += TILE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_W, y);
        ctx.stroke();
      }

      // Draw stations
      for (const s of STATIONS) {
        const stationImg = stationImagesRef.current[s.name];
        if (stationImg && stationImg.complete && stationImg.naturalWidth > 0) {
          // Draw the pixel art station image, scaled to fit the station area
          const imgAspect = stationImg.naturalWidth / stationImg.naturalHeight;
          let drawW = s.w;
          let drawH = s.w / imgAspect;
          if (drawH > s.h + 20) {
            drawH = s.h + 20;
            drawW = drawH * imgAspect;
          }
          // Ensure minimum recognizable size
          if (drawW < 160) { drawW = 160; drawH = drawW / imgAspect; }
          const drawX = s.x + s.w / 2 - drawW / 2;
          const drawY = s.y + s.h / 2 - drawH / 2;

          ctx.save();
          ctx.imageSmoothingEnabled = false; // Keep pixel art crisp
          ctx.drawImage(stationImg, drawX, drawY, drawW, drawH);

          // Subtle glow for command center (gold when WIRE is thinking)
          if (s.name === "command") {
            const isThinking = wireThinkingRef.current;
            const glowAlpha = isThinking
              ? 0.20 + 0.12 * Math.sin(t * 0.08)
              : 0.12 + 0.06 * Math.sin(t * 0.04);
            ctx.shadowColor = isThinking ? "#FFD700" : "#00d4ff";
            ctx.shadowBlur = isThinking ? 24 : 16;
            ctx.globalAlpha = glowAlpha;
            ctx.drawImage(stationImg, drawX, drawY, drawW, drawH);
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
          }
          ctx.restore();
        } else {
          // Fallback to procedural drawing while images load
          ctx.fillStyle = theme.stationFallback;
          ctx.fillRect(s.x, s.y, s.w, s.h);
          const glow = s.name === "command" ? theme.commandGlow : theme.stationStroke;
          ctx.strokeStyle = glow;
          ctx.lineWidth = s.name === "command" ? 2 : 1;
          ctx.strokeRect(s.x, s.y, s.w, s.h);
        }

        ctx.fillStyle = theme.stationLabel;
        ctx.font = "11px monospace";
        ctx.textAlign = "center";
        // Add coffee count to station label
        const stationAgent = AGENTS_DATA.find((a) => a.station === s.name);
        const coffeeCount = stationAgent ? (coffeeCountsRef.current[stationAgent.id] || 0) : 0;
        const coffeeLabel = coffeeCount > 0 ? ` ☕×${coffeeCount}` : "";
        ctx.fillText(s.label + coffeeLabel, s.x + s.w / 2, s.y - 6);
      }

      // ─── Draw War Room ────────────────────────────────────
      {
        const wr = WAR_ROOM;
        const warRoomActive = anyActive;
        const wrImg = warRoomImageRef.current;

        if (wrImg && wrImg.complete && wrImg.naturalWidth > 0) {
          // Draw war room image centered in the war room area
          const imgAspect = wrImg.naturalWidth / wrImg.naturalHeight;
          let drawW = wr.w;
          let drawH = wr.w / imgAspect;
          if (drawH > wr.h + 30) {
            drawH = wr.h + 30;
            drawW = drawH * imgAspect;
          }
          const drawX = WAR_ROOM_CENTER.x - drawW / 2;
          const drawY = WAR_ROOM_CENTER.y - drawH / 2;

          ctx.save();
          ctx.imageSmoothingEnabled = false;

          // Active glow underneath
          if (warRoomActive) {
            const pulseAlpha = 0.08 + 0.05 * Math.sin(t * 0.03);
            ctx.fillStyle = `rgba(255, 100, 50, ${pulseAlpha})`;
            ctx.fillRect(wr.x, wr.y, wr.w, wr.h);
          }

          ctx.drawImage(wrImg, drawX, drawY, drawW, drawH);

          // Active overlay glow
          if (warRoomActive) {
            const hGlow = 0.08 + 0.06 * Math.sin(t * 0.06);
            ctx.shadowColor = "rgba(255, 140, 50, 0.8)";
            ctx.shadowBlur = 20;
            ctx.globalAlpha = hGlow;
            ctx.drawImage(wrImg, drawX, drawY, drawW, drawH);
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
          }
          ctx.restore();
        } else {
          // Fallback procedural
          const pulseAlpha = 0.06 + 0.04 * Math.sin(t * 0.03);
          ctx.fillStyle = warRoomActive
            ? `rgba(255, 100, 50, ${pulseAlpha + 0.04})`
            : theme.warRoomFallbackBg;
          ctx.fillRect(wr.x, wr.y, wr.w, wr.h);
          const tableW = 120; const tableH = 40;
          const tableX = WAR_ROOM_CENTER.x - tableW / 2;
          const tableY = WAR_ROOM_CENTER.y - tableH / 2;
          ctx.fillStyle = warRoomActive ? "#2a1510" : theme.warRoomTableBg;
          ctx.fillRect(tableX, tableY, tableW, tableH);
          ctx.strokeStyle = warRoomActive ? "rgba(255, 140, 50, 0.5)" : theme.warRoomTableStroke;
          ctx.lineWidth = 2;
          ctx.strokeRect(tableX, tableY, tableW, tableH);
        }

        // War room border
        ctx.strokeStyle = warRoomActive
          ? `rgba(255, 120, 40, ${0.4 + 0.2 * Math.sin(t * 0.03)})`
          : theme.warRoomBorderIdle;
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(wr.x, wr.y, wr.w, wr.h);
        ctx.setLineDash([]);

        // Label
        ctx.fillStyle = warRoomActive ? "#ff8c32" : theme.warRoomLabel;
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.fillText(
          warRoomActive ? "🔥 WAR ROOM — ACTIVE" : "🔥 War Room",
          WAR_ROOM_CENTER.x,
          wr.y - 6
        );
      }

      // Draw connection lines from command to active stations
      const wireAgent = agentsRef.current.find((a) => a.id === "wire");
      if (wireAgent) {
        for (const agent of agentsRef.current) {
          if (agent.id === "wire") continue;
          const isActive = activeIds.has(agent.id);
          if (isActive) {
            // Bright connection line to war room
            const alpha = 0.15 + 0.1 * Math.sin(t * 0.04 + AGENTS_DATA.findIndex((a) => a.id === agent.id));
            ctx.strokeStyle = `rgba(255, 140, 50, ${alpha})`;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 6]);
            ctx.beginPath();
            ctx.moveTo(wireAgent.x, wireAgent.y);
            ctx.lineTo(agent.x, agent.y);
            ctx.stroke();
            ctx.setLineDash([]);
          } else if (agent.activity === "idle") {
            // Dim lines for idle agents
            const agentStation = STATIONS.find((s) => s.name === agent.station);
            if (!agentStation) continue;
            const cmdStation = STATIONS.find((s) => s.name === "command")!;
            const cmdCenter = stationCenter(cmdStation);
            const aCenter = stationCenter(agentStation);
            const alpha = 0.04 + 0.02 * Math.sin(t * 0.02 + AGENTS_DATA.findIndex((a) => a.id === agent.id));
            ctx.strokeStyle = theme.idleLineColor;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 8]);
            ctx.beginPath();
            ctx.moveTo(cmdCenter.x, cmdCenter.y);
            ctx.lineTo(aCenter.x, aCenter.y);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }

      // ─── Update + draw agents ─────────────────────────────
      // Compute war room slots for active agents (+ WIRE if delegating)
      const warRoomAgentIds: string[] = activeAgents.map((a) => a.id);
      if (anyActive && !warRoomAgentIds.includes("wire")) {
        warRoomAgentIds.unshift("wire"); // WIRE goes to war room when delegating
      }

      // Pre-compute label Y offsets so clustered agents don't overlap
      const CLUSTER_DIST = 80; // px — agents closer than this get offset
      const LABEL_STEP = 16; // vertical px between stacked labels
      const labelOffsets: Record<string, number> = {};
      const sortedAgents = [...agentsRef.current].sort((a, b) => a.y - b.y);
      for (let i = 0; i < sortedAgents.length; i++) {
        let offset = 0;
        for (let j = 0; j < i; j++) {
          const d = dist({ x: sortedAgents[i].x, y: sortedAgents[i].y },
                         { x: sortedAgents[j].x, y: sortedAgents[j].y });
          if (d < CLUSTER_DIST) {
            offset = Math.min(offset, (labelOffsets[sortedAgents[j].id] || 0) - LABEL_STEP);
          }
        }
        labelOffsets[sortedAgents[i].id] = offset;
      }

      for (const agent of agentsRef.current) {
        const isActive = activeIds.has(agent.id);
        const isWireInWarRoom = agent.id === "wire" && anyActive;
        const isInWarRoom = isActive || isWireInWarRoom;
        const isCompleted = agent.activity === "completed";

        // ─── Target position logic ───────────────────────
        if (isInWarRoom) {
          // Go to war room slot
          const slotIndex = warRoomAgentIds.indexOf(agent.id);
          const slot = getWarRoomSlot(slotIndex, warRoomAgentIds.length);
          agent.targetX = slot.x;
          agent.targetY = slot.y;
          agent.state = "walking";
          agent.stateTimer = 999; // Don't wander
        } else if (isCompleted) {
          // Walk back to home station
          const home = STATIONS.find((s) => s.name === agent.station)!;
          const c = stationCenter(home);
          agent.targetX = c.x + (Math.random() - 0.5) * 20;
          agent.targetY = c.y + (Math.random() - 0.5) * 15;
          agent.state = "walking";

          // Check if fade timer expired
          if (Date.now() - agent.completedAt > 10_000) {
            agent.activity = "idle";
          }
        } else {
          // Normal idle behavior
          agent.stateTimer--;

          // Fade coffee icon over time
          if (agent.coffeeIconAlpha > 0) {
            agent.coffeeIconAlpha -= 0.003; // ~5 seconds to fully fade
            if (agent.coffeeIconAlpha < 0) agent.coffeeIconAlpha = 0;
          }

          if (agent.stateTimer <= 0) {
            if (agent.state === "idle") {
              agent.coffeeCycleCounter++;

              if (agent.coffeeCycleCounter >= agent.coffeeThreshold) {
                // Time for coffee! Reset counter and pick a new threshold for next time
                agent.coffeeCycleCounter = 0;
                const freq = COFFEE_FREQUENCY[agent.id] || [40, 60];
                agent.coffeeThreshold = freq[0] + Math.floor(Math.random() * (freq[1] - freq[0] + 1));
                const coffee = STATIONS.find((s) => s.name === "coffee")!;
                const c = stationCenter(coffee);
                agent.targetX = c.x + (Math.random() - 0.5) * 30;
                agent.targetY = c.y + (Math.random() - 0.5) * 20;
                agent.state = "walking";
                agent.stateTimer = 600;
                agent.statusMsg = "Getting coffee ☕";
              } else if (Math.random() < 0.15) {
                const other = pickRandomStation(agent.station);
                const c = stationCenter(other);
                agent.targetX = c.x + (Math.random() - 0.5) * 30;
                agent.targetY = c.y + (Math.random() - 0.5) * 20;
                agent.state = "walking";
                agent.stateTimer = 400;
                agent.statusMsg = `Visiting ${other.label}`;
              } else {
                const msgs = idleStatuses[agent.id] || ["Working..."];
                agent.statusMsg = msgs[Math.floor(Math.random() * msgs.length)];
                agent.stateTimer = 200 + Math.random() * 400;
              }
            } else if (agent.state === "getting_coffee") {
              // Finished picking up coffee — now walk back to desk
              coffeeCountsRef.current[agent.id] = (coffeeCountsRef.current[agent.id] || 0) + 1;
              agent.hasCoffee = true;
              agent.coffeeIconAlpha = 1.0;
              const home = STATIONS.find((s) => s.name === agent.station)!;
              const c = stationCenter(home);
              agent.targetX = c.x + (Math.random() - 0.5) * 40;
              agent.targetY = c.y + (Math.random() - 0.5) * 30;
              agent.state = "returning_coffee";
              agent.stateTimer = 400;
              agent.statusMsg = "Coffee in hand ☕";
            } else if (agent.state === "returning_coffee") {
              // Back at desk
              agent.state = "idle";
              agent.hasCoffee = false;
              agent.stateTimer = 200 + Math.random() * 500;
              const msgs = idleStatuses[agent.id] || ["Working..."];
              agent.statusMsg = msgs[Math.floor(Math.random() * msgs.length)];
            } else if (agent.state === "walking") {
              // Check if we arrived at coffee station
              const coffeeStation = STATIONS.find((s) => s.name === "coffee")!;
              const coffeeCenter = stationCenter(coffeeStation);
              const dCoffee = dist({ x: agent.x, y: agent.y }, coffeeCenter);
              if (dCoffee < 60 && agent.statusMsg.includes("coffee")) {
                // Arrived at coffee — pause to pick up
                agent.state = "getting_coffee";
                agent.stateTimer = 60 + Math.floor(Math.random() * 60); // 1-2 seconds at 60fps
                agent.statusMsg = "Picking up coffee...";
              } else {
                const home = STATIONS.find((s) => s.name === agent.station)!;
                const c = stationCenter(home);
                agent.targetX = c.x + (Math.random() - 0.5) * 40;
                agent.targetY = c.y + (Math.random() - 0.5) * 30;
                agent.state = "walking";
                agent.stateTimer = 300;
                const dHome = dist({ x: agent.x, y: agent.y }, { x: agent.targetX, y: agent.targetY });
                if (dHome < 10) {
                  agent.state = "idle";
                  agent.stateTimer = 200 + Math.random() * 500;
                  const msgs = idleStatuses[agent.id] || ["Working..."];
                  agent.statusMsg = msgs[Math.floor(Math.random() * msgs.length)];
                }
              }
            }
          }
        }

        // Move toward target (smooth lerp)
        const dx = agent.targetX - agent.x;
        const dy = agent.targetY - agent.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const moveSpeed = isInWarRoom ? 3.5 : agent.speed; // Much faster when heading to war room
        if (d > 2) {
          agent.x += (dx / d) * moveSpeed;
          agent.y += (dy / d) * moveSpeed;
          agent.direction = dx > 0 ? "right" : "left";
        }

        // Bob animation
        const bob = Math.sin(t * 0.05 + agent.bobOffset) * 2;

        // Shadow
        ctx.fillStyle = isActive ? theme.shadowActive : theme.shadowIdle;
        ctx.beginPath();
        ctx.ellipse(agent.x, agent.y + SPRITE_SIZE / 2 + 4, 24, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Glowing floor spotlight under agent
        ctx.save();
        const spotColor = isActive ? theme.spotActive : theme.spotIdle;
        const spotGrad = ctx.createRadialGradient(agent.x, agent.y + SPRITE_SIZE / 2, 0, agent.x, agent.y + SPRITE_SIZE / 2, 44);
        spotGrad.addColorStop(0, spotColor);
        spotGrad.addColorStop(1, "transparent");
        ctx.fillStyle = spotGrad;
        ctx.beginPath();
        ctx.ellipse(agent.x, agent.y + SPRITE_SIZE / 2 + 2, 44, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Draw sprite with back-glow halo (no outline - outlines glitch during movement)
        if (agent.sprite && spritesLoadedRef.current) {
          const sx = agent.x - SPRITE_SIZE / 2;
          const sy = agent.y + bob - SPRITE_SIZE / 2;

          // BEFORE drawing the sprite, draw a solid white disc
          ctx.save();
          ctx.fillStyle = '#FFFFFF';
          ctx.globalAlpha = 1.0;
          ctx.beginPath();
          ctx.arc(agent.x, agent.y + bob, SPRITE_SIZE * 0.45, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Draw actual sprite on top
          ctx.save();
          if (agent.direction === "left") {
            ctx.translate(agent.x, agent.y + bob - SPRITE_SIZE / 2);
            ctx.scale(-1, 1);
            ctx.drawImage(agent.sprite, -SPRITE_SIZE / 2, 0, SPRITE_SIZE, SPRITE_SIZE);
          } else {
            ctx.drawImage(
              agent.sprite,
              sx,
              sy,
              SPRITE_SIZE,
              SPRITE_SIZE
            );
          }
          ctx.restore();
        }

        // Draw pixelated coffee icon next to agent (fading)
        if (agent.coffeeIconAlpha > 0 || agent.hasCoffee) {
          const alpha = agent.hasCoffee ? 1.0 : agent.coffeeIconAlpha;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.imageSmoothingEnabled = false;
          const coffeeX = agent.x + SPRITE_SIZE / 2 - 8;
          const coffeeY = agent.y + bob - 16;
          // Draw a tiny pixelated coffee cup (8x10 pixels, scaled 2x)
          const px = 2; // pixel scale
          // Cup body (brown)
          ctx.fillStyle = "#8B4513";
          ctx.fillRect(coffeeX, coffeeY + 2*px, 4*px, 3*px);
          // Cup handle
          ctx.fillRect(coffeeX + 4*px, coffeeY + 3*px, 1*px, 1*px);
          // Coffee liquid (dark)
          ctx.fillStyle = "#4a2a0a";
          ctx.fillRect(coffeeX + 0.5*px, coffeeY + 2*px, 3*px, 1*px);
          // Steam (white, animated)
          const steamOffset = Math.sin(t * 0.08 + agent.bobOffset) * 1.5;
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.7})`;
          ctx.fillRect(coffeeX + 1*px, coffeeY + steamOffset, 1*px, 1*px);
          ctx.fillRect(coffeeX + 2.5*px, coffeeY - 1*px + steamOffset, 1*px, 1*px);
          ctx.restore();
        }

        // Name tag (offset to avoid overlap in clusters)
        const lOff = labelOffsets[agent.id] || 0;
        const nameColor = isActive ? "#ff8c32" : agent.id === "wire" ? theme.wireNameColor : theme.nameFallback;
        ctx.fillStyle = nameColor;
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(agent.name, agent.x, agent.y - SPRITE_SIZE / 2 - 4 + bob + lOff);

        // ─── Status indicators ──────────────────────────────
        if (isActive && agent.currentTask) {
          // Speech bubble with task
          const bubbleText = truncateTask(agent.currentTask);
          const bubbleW = ctx.measureText(bubbleText).width + 16;
          const bubbleH = 18;
          const bubbleX = agent.x - bubbleW / 2;
          const bubbleY = agent.y - SPRITE_SIZE / 2 - 28 + bob + lOff;

          // Bubble bg
          ctx.fillStyle = "rgba(40, 20, 10, 0.9)";
          ctx.beginPath();
          ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 4);
          ctx.fill();
          ctx.strokeStyle = "rgba(255, 140, 50, 0.6)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 4);
          ctx.stroke();

          // Bubble text
          ctx.fillStyle = "#ffb870";
          ctx.font = "9px monospace";
          ctx.textAlign = "center";
          ctx.fillText(bubbleText, agent.x, bubbleY + 13);

          // Working dots
          for (let i = 0; i < 3; i++) {
            const dotAlpha = 0.4 + 0.4 * Math.sin(t * 0.1 + i * 0.8);
            ctx.fillStyle = `rgba(255, 140, 50, ${dotAlpha})`;
            ctx.beginPath();
            ctx.arc(agent.x - 6 + i * 6, bubbleY - 5, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (isCompleted) {
          // ✅ indicator that fades
          const elapsed = Date.now() - agent.completedAt;
          const fadeAlpha = Math.max(0, 1 - elapsed / 10_000);
          if (fadeAlpha > 0) {
            ctx.globalAlpha = fadeAlpha;
            ctx.fillStyle = "#22c55e";
            ctx.font = "bold 18px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("✅", agent.x, agent.y - SPRITE_SIZE / 2 - 8 + bob + lOff);
            ctx.globalAlpha = 1;
          }
        } else if (agent.state === "idle") {
          // Idle dots
          const dotCount = 3;
          for (let i = 0; i < dotCount; i++) {
            const dotAlpha = 0.3 + 0.3 * Math.sin(t * 0.08 + i * 1.2 + agent.bobOffset);
            ctx.fillStyle = theme.idleDot.replace("0.5)", `${dotAlpha})`);
            ctx.beginPath();
            ctx.arc(agent.x - 8 + i * 8, agent.y - SPRITE_SIZE / 2 - 14 + bob + lOff, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // ─── WIRE Thought Bubble (voice processing) ─────────
      if (wireThinkingRef.current && wireAgent) {
        const bubbleW = 48;
        const bubbleH = 28;
        const bubbleX = wireAgent.x - 40;
        const bubbleY = wireAgent.y - SPRITE_SIZE - 28 + Math.sin(t * 0.05 + wireAgent.bobOffset) * 2;

        // Bubble body
        ctx.fillStyle = "rgba(26, 26, 46, 0.9)";
        ctx.beginPath();
        ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 6);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 215, 0, 0.7)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 6);
        ctx.stroke();

        // Tail (three small circles pointing to WIRE)
        const tailX = bubbleX + bubbleW * 0.7;
        const tailY = bubbleY + bubbleH;
        ctx.fillStyle = "rgba(26, 26, 46, 0.9)";
        ctx.beginPath();
        ctx.arc(tailX, tailY + 6, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 215, 0, 0.7)";
        ctx.stroke();
        ctx.fillStyle = "rgba(26, 26, 46, 0.9)";
        ctx.beginPath();
        ctx.arc(tailX + 5, tailY + 13, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 215, 0, 0.7)";
        ctx.stroke();

        // Animated dots (3 dots cycling)
        for (let i = 0; i < 3; i++) {
          const phase = (t * 0.08 + i * 0.7) % (Math.PI * 2);
          const scale = 2.5 + 1.5 * Math.sin(phase);
          const alpha = 0.5 + 0.5 * Math.sin(phase);
          ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
          ctx.beginPath();
          ctx.arc(bubbleX + 10 + i * 10, bubbleY + bubbleH / 2, scale, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ─── HUD ──────────────────────────────────────────────
      // Title
      ctx.fillStyle = theme.hudTitle;
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "left";
      ctx.fillText("⚡ WHYRE Agent Office", 20, 30);
      ctx.fillStyle = theme.hudSub;
      ctx.font = "11px monospace";
      ctx.fillText("TappinAI HQ — 10 agents, always shipping", 20, 48);

      // Active agent count badge / WIRE processing indicator
      const ac = activityRef.current.activeAgents.length;
      if (wireThinkingRef.current) {
        const dots = ".".repeat(1 + (Math.floor(t / 30) % 3));
        ctx.fillStyle = "#FFD700";
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`⚡ WIRE processing${dots}`, 20, 68);
      } else if (ac > 0) {
        ctx.fillStyle = "#ff6b2e";
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`🔥 ${ac} agent${ac > 1 ? "s" : ""} active`, 20, 68);
      } else {
        ctx.fillStyle = theme.hudIdle;
        ctx.font = "12px monospace";
        ctx.textAlign = "left";
        ctx.fillText("💤 All agents idle", 20, 68);
      }

      // Clock
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      ctx.fillStyle = theme.clockColor;
      ctx.font = "11px monospace";
      ctx.textAlign = "right";
      ctx.fillText(timeStr, CANVAS_W - 20, 30);

      // Live indicator
      const liveAlpha = 0.5 + 0.5 * Math.sin(t * 0.06);
      ctx.fillStyle = `rgba(34, 197, 94, ${liveAlpha})`;
      ctx.beginPath();
      ctx.arc(CANVAS_W - 58, 44, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme.liveTextColor;
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText("LIVE", CANVAS_W - 20, 48);

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Click handler — sprite clicks → dialogue, station clicks → interior
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    // Check if clicked on an agent sprite first (stopPropagation equivalent)
    let foundAgent: Agent | null = null;
    for (const agent of agentsRef.current) {
      const d = dist({ x: mx, y: my }, { x: agent.x, y: agent.y });
      if (d < SPRITE_SIZE / 2 + 10) {
        foundAgent = agent;
        break;
      }
    }

    if (foundAgent) {
      // Agent sprite click → dialogue
      setTooltip({
        agent: { ...foundAgent },
        x: e.clientX,
        y: e.clientY,
      });
      openDialogue(foundAgent.id);
      return; // Don't check stations
    }

    // Dismiss tooltip
    setTooltip(null);

    // If dialogue is open, clicking outside dismisses it
    if (dialogueRef.current) {
      closeDialogue();
      return;
    }

    // Check if clicked on a station area → interior popup
    // Map station names to agent IDs
    const stationToAgent: Record<string, string> = {
      command: "wire", coding: "code", research: "hunt", studio: "snap",
      design: "look", review: "eyes", library: "sage", whiteboard: "plan",
      mailroom: "mail", filing: "memo",
    };

    for (const s of STATIONS) {
      if (s.name === "coffee") continue; // Coffee station has no agent
      if (mx >= s.x && mx <= s.x + s.w && my >= s.y && my <= s.y + s.h) {
        const agentId = stationToAgent[s.name];
        if (agentId) {
          openInterior(agentId);
        }
        return;
      }
    }
  }, [openDialogue, closeDialogue, openInterior]);

  return (
    <div
      style={{
        background: isDark ? DARK_THEME.outerBg : LIGHT_THEME.outerBg,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "absolute",
        top: 0,
        left: 0,
        margin: 0,
        padding: 0,
        fontFamily: "monospace",
      }}
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        onClick={handleClick}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          display: "block",
          cursor: "pointer",
          imageRendering: "pixelated",
        }}
      />
      {/* Theme toggle button */}
      <button
        onClick={() => setIsDark((d) => !d)}
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          zIndex: 200,
          background: isDark ? "#1a1a2e" : "#ffffff",
          border: `1px solid ${isDark ? "#3a5a7a" : "#c8c0b8"}`,
          borderRadius: 8,
          padding: "6px 12px",
          color: isDark ? "#aac" : "#5a6a7a",
          fontFamily: "monospace",
          fontSize: 12,
          cursor: "pointer",
          boxShadow: isDark ? "0 2px 8px rgba(0,0,0,0.4)" : "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        {isDark ? "☀️ Light" : "🌙 Dark"}
      </button>
      {/* ─── Dialogue Box ─────────────────────────────────────── */}
      {dialogue && (
        <div
          role="dialog"
          aria-label={`${dialogue.agentId.toUpperCase()} says: ${dialogue.text}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!dialogue.isTyping) {
              closeDialogue();
            } else {
              // Click during typing → reveal all text
              if (typewriterTimerRef.current) clearTimeout(typewriterTimerRef.current);
              setDialogue((d) => d ? { ...d, displayedText: d.text, isTyping: false, charIndex: d.text.length } : null);
            }
          }}
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(90vw, 720px)",
            minHeight: 120,
            maxHeight: 160,
            padding: "20px 24px",
            background: "rgba(26, 26, 46, 0.95)",
            border: `3px solid ${AGENT_COLORS[dialogue.agentId] || "#fff"}`,
            borderRadius: 4,
            zIndex: 1000,
            fontFamily: "'Press Start 2P', 'Courier New', monospace",
            animation: "dialogueSlideUp 250ms ease-out",
            cursor: "pointer",
            boxSizing: "border-box",
          }}
        >
          <div style={{
            fontSize: 10,
            color: AGENT_COLORS[dialogue.agentId] || "#fff",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: 12,
          }}>
            {AGENT_EMOJIS[dialogue.agentId]} {dialogue.agentId.toUpperCase()}
          </div>
          <div style={{
            fontSize: 13,
            color: "#f0e6d3",
            lineHeight: 1.8,
            minHeight: 40,
          }}>
            &ldquo;{dialogue.displayedText}&rdquo;
            {!dialogue.isTyping && (
              <span style={{
                display: "inline-block",
                marginLeft: 8,
                animation: "cursorBlink 500ms infinite",
                fontSize: 13,
                color: "#f0e6d3",
              }}>▼</span>
            )}
          </div>
        </div>
      )}

      {/* ─── Interior Popup ───────────────────────────────────── */}
      {interior && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={closeInterior}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "backdropFadeIn 200ms ease-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "min(85vw, 960px)",
              height: "min(80vh, 640px)",
              borderRadius: 8,
              border: `2px solid ${AGENT_COLORS[interior.agentId] || "#fff"}`,
              overflow: "hidden",
              animation: "interiorPop 300ms cubic-bezier(0.34, 1.56, 0.64, 1)",
              background: "#1a1a2e",
            }}
          >
            {/* Interior image */}
            {interior.loaded ? (
              <img
                src={`/interiors/interior-${interior.agentId}.png`}
                alt={`${interior.agentId.toUpperCase()}'s office interior`}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  imageRendering: "pixelated",
                  display: "block",
                }}
              />
            ) : (
              <div style={{
                width: "100%",
                height: "100%",
                background: "linear-gradient(135deg, #1a1a2e 25%, #2a2a4e 50%, #1a1a2e 75%)",
                backgroundSize: "200% 200%",
                animation: "skeletonShimmer 1.5s infinite",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <span style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 12,
                  color: "#4a4a6e",
                }}>Loading...</span>
              </div>
            )}

            {/* Close button */}
            <button
              onClick={(e) => { e.stopPropagation(); closeInterior(); }}
              style={{
                position: "absolute",
                top: -12,
                right: -12,
                width: 32,
                height: 32,
                background: "#1a1a2e",
                border: `2px solid ${AGENT_COLORS[interior.agentId] || "#fff"}`,
                borderRadius: 4,
                color: AGENT_COLORS[interior.agentId] || "#fff",
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 3,
                transition: "background 150ms, color 150ms",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = AGENT_COLORS[interior.agentId] || "#fff";
                (e.target as HTMLElement).style.color = "#1a1a2e";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = "#1a1a2e";
                (e.target as HTMLElement).style.color = AGENT_COLORS[interior.agentId] || "#fff";
              }}
            >×</button>

            {/* Info bar */}
            <div style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 48,
              background: "rgba(26, 26, 46, 0.85)",
              borderTop: "1px solid rgba(240, 230, 211, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 20px",
              zIndex: 2,
              fontFamily: "'Press Start 2P', monospace",
            }}>
              <span style={{
                fontSize: 12,
                color: AGENT_COLORS[interior.agentId] || "#fff",
              }}>
                {AGENT_EMOJIS[interior.agentId]} {interior.agentId.toUpperCase()}
              </span>
              <span style={{
                fontSize: 10,
                color: "#f0e6d3",
              }}>
                {AGENT_ROLES[interior.agentId] || "Agent"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─── Voice Overlay (Mic + Transcript) ─────────────── */}
      <VoiceOverlay onWireThinking={handleWireThinking} />

      {tooltip && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x + 16,
            top: tooltip.y - 20,
            background: isDark ? DARK_THEME.tooltipBg : LIGHT_THEME.tooltipBg,
            border: `1px solid ${tooltip.agent.activity === "active" ? "#ff8c32" : (isDark ? DARK_THEME.tooltipBorder : LIGHT_THEME.tooltipBorder)}`,
            borderRadius: 6,
            padding: "10px 14px",
            color: isDark ? DARK_THEME.tooltipText : LIGHT_THEME.tooltipText,
            fontSize: 12,
            zIndex: 100,
            pointerEvents: "none",
            boxShadow: tooltip.agent.activity === "active"
              ? "0 0 20px rgba(255,140,50,0.3)"
              : (isDark ? DARK_THEME.tooltipShadow : LIGHT_THEME.tooltipShadow),
            minWidth: 180,
          }}
        >
          <div
            style={{
              color: tooltip.agent.activity === "active" ? "#ff8c32" : (isDark ? "#00d4ff" : "#0088aa"),
              fontWeight: "bold",
              fontSize: 14,
              marginBottom: 4,
            }}
          >
            {tooltip.agent.name}
            {tooltip.agent.activity === "active" && (
              <span style={{ marginLeft: 8, fontSize: 10, color: "#ff6b2e" }}>● ACTIVE</span>
            )}
            {tooltip.agent.activity === "completed" && (
              <span style={{ marginLeft: 8, fontSize: 10, color: "#22c55e" }}>✅ DONE</span>
            )}
          </div>
          <div style={{ color: isDark ? DARK_THEME.tooltipRole : LIGHT_THEME.tooltipRole, marginBottom: 2 }}>{tooltip.agent.role}</div>
          {tooltip.agent.activity === "active" && tooltip.agent.currentTask ? (
            <div style={{ color: "#ffb870", marginBottom: 2 }}>
              🔥 {tooltip.agent.currentTask}
            </div>
          ) : (
            <div style={{ color: isDark ? DARK_THEME.tooltipStatus : LIGHT_THEME.tooltipStatus }}>📍 {tooltip.agent.statusMsg}</div>
          )}
          <div style={{ color: isDark ? DARK_THEME.tooltipMeta : LIGHT_THEME.tooltipMeta, marginTop: 4, fontSize: 10 }}>
            {tooltip.agent.activity === "active"
              ? "🏃 In the war room"
              : tooltip.agent.state === "walking"
                ? "🚶 On the move"
                : "💼 At station"}
          </div>
        </div>
      )}
    </div>
  );
}
