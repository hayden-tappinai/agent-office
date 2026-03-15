"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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
  state: "idle" | "walking" | "working";
  stateTimer: number;
  idleTime: number;
  direction: "left" | "right";
  bobOffset: number;
  statusMsg: string;
  // Real-time activity
  activity: AgentActivity;
  currentTask: string;
  completedAt: number; // timestamp for fade-out
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

  // Keep themeRef in sync
  useEffect(() => {
    themeRef.current = isDark ? DARK_THEME : LIGHT_THEME;
  }, [isDark]);

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

          // Subtle glow for command center
          if (s.name === "command") {
            const glowAlpha = 0.12 + 0.06 * Math.sin(t * 0.04);
            ctx.shadowColor = "#00d4ff";
            ctx.shadowBlur = 16;
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
        ctx.fillText(s.label, s.x + s.w / 2, s.y - 6);
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
          if (agent.stateTimer <= 0) {
            if (agent.state === "idle") {
              const roll = Math.random();
              if (roll < 0.12) {
                const coffee = STATIONS.find((s) => s.name === "coffee")!;
                const c = stationCenter(coffee);
                agent.targetX = c.x + (Math.random() - 0.5) * 30;
                agent.targetY = c.y + (Math.random() - 0.5) * 20;
                agent.state = "walking";
                agent.stateTimer = 600;
                agent.statusMsg = "Getting coffee ☕";
              } else if (roll < 0.22) {
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
            } else if (agent.state === "walking") {
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
          ctx.arc(agent.x, agent.y + bob, SPRITE_SIZE * 0.65, 0, Math.PI * 2);
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

      // ─── HUD ──────────────────────────────────────────────
      // Title
      ctx.fillStyle = theme.hudTitle;
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "left";
      ctx.fillText("⚡ WHYRE Agent Office", 20, 30);
      ctx.fillStyle = theme.hudSub;
      ctx.font = "11px monospace";
      ctx.fillText("TappinAI HQ — 10 agents, always shipping", 20, 48);

      // Active agent count badge
      const ac = activityRef.current.activeAgents.length;
      if (ac > 0) {
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

  // Click handler
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    let found: Agent | null = null;
    for (const agent of agentsRef.current) {
      const d = dist({ x: mx, y: my }, { x: agent.x, y: agent.y });
      if (d < SPRITE_SIZE / 2 + 10) {
        found = agent;
        break;
      }
    }

    if (found) {
      setTooltip({
        agent: { ...found },
        x: e.clientX,
        y: e.clientY,
      });
    } else {
      setTooltip(null);
    }
  }, []);

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
