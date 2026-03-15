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
}

// ─── Constants ──────────────────────────────────────────────────
const CANVAS_W = 1200;
const CANVAS_H = 800;
const SPRITE_SIZE = 56;
const TILE = 32;

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
  // Center command - WIRE
  { name: "command", x: 520, y: 340, w: 160, h: 100, color: "#1a1a2e", label: "⚡ Command Center" },
  // Left wing - builders
  { name: "coding", x: 80, y: 180, w: 140, h: 90, color: "#16213e", label: "💻 Dev Bay" },
  { name: "review", x: 80, y: 340, w: 130, h: 80, color: "#1a1a2e", label: "👁️ Review Screens" },
  { name: "design", x: 80, y: 500, w: 140, h: 80, color: "#1a1a2e", label: "🎨 Design Wall" },
  // Right wing - research/strategy
  { name: "research", x: 960, y: 180, w: 140, h: 90, color: "#16213e", label: "🔍 Research Lab" },
  { name: "library", x: 960, y: 340, w: 140, h: 90, color: "#0f3460", label: "📚 Think Tank" },
  { name: "whiteboard", x: 960, y: 500, w: 140, h: 80, color: "#1a1a2e", label: "📋 War Room" },
  // Top - comms
  { name: "studio", x: 380, y: 80, w: 130, h: 80, color: "#1a1a2e", label: "📸 Studio" },
  { name: "mailroom", x: 700, y: 80, w: 130, h: 80, color: "#16213e", label: "📬 Mailroom" },
  // Bottom - storage
  { name: "filing", x: 520, y: 620, w: 140, h: 80, color: "#1a1a2e", label: "🗄️ Archives" },
  // Shared spaces
  { name: "coffee", x: 380, y: 620, w: 80, h: 60, color: "#2d1b4e", label: "☕ Coffee" },
  { name: "meeting", x: 700, y: 620, w: 100, h: 70, color: "#2d1b4e", label: "🤝 Huddle" },
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

// ─── Component ──────────────────────────────────────────────────
export default function AgentOffice() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const agentsRef = useRef<Agent[]>([]);
  const spritesLoadedRef = useRef(false);
  const [tooltip, setTooltip] = useState<{
    agent: Agent;
    x: number;
    y: number;
  } | null>(null);
  const frameRef = useRef(0);
  const timeRef = useRef(0);

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
        speed: 0.6 + Math.random() * 0.4,
        sprite: img,
        state: "idle",
        stateTimer: Math.random() * 300 + 100,
        idleTime: 0,
        direction: "right",
        bobOffset: Math.random() * Math.PI * 2,
        statusMsg: a.status,
      };
    });

    agentsRef.current = agents;
  }, []);

  // Game loop
  useEffect(() => {
    let animId: number;

    const statuses: Record<string, string[]> = {
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

      // Clear
      ctx.fillStyle = "#0a0a1a";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Draw floor grid
      ctx.strokeStyle = "#151530";
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
        // Station bg
        ctx.fillStyle = s.color;
        ctx.fillRect(s.x, s.y, s.w, s.h);

        // Glow border
        const glow = s.name === "command" ? "#00d4ff" : "#1e3a5f";
        ctx.strokeStyle = glow;
        ctx.lineWidth = s.name === "command" ? 2 : 1;
        ctx.strokeRect(s.x, s.y, s.w, s.h);

        // Animated scan line for command center
        if (s.name === "command") {
          const scanY = s.y + ((t * 0.5) % s.h);
          ctx.strokeStyle = "rgba(0, 212, 255, 0.15)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(s.x, scanY);
          ctx.lineTo(s.x + s.w, scanY);
          ctx.stroke();
        }

        // Label
        ctx.fillStyle = "#4a6a8a";
        ctx.font = "11px monospace";
        ctx.textAlign = "center";
        ctx.fillText(s.label, s.x + s.w / 2, s.y - 6);
      }

      // Draw connection lines between command and active stations (pulse effect)
      const wireAgent = agentsRef.current.find((a) => a.id === "wire");
      if (wireAgent && wireAgent.state === "idle") {
        const cmdStation = STATIONS.find((s) => s.name === "command")!;
        const cmdCenter = stationCenter(cmdStation);
        for (const agent of agentsRef.current) {
          if (agent.id === "wire") continue;
          if (agent.state !== "idle") continue;
          const agentStation = STATIONS.find((s) => s.name === agent.station);
          if (!agentStation) continue;
          const aCenter = stationCenter(agentStation);
          const alpha = 0.05 + 0.03 * Math.sin(t * 0.02 + AGENTS_DATA.findIndex((a) => a.id === agent.id));
          ctx.strokeStyle = `rgba(0, 212, 255, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 8]);
          ctx.beginPath();
          ctx.moveTo(cmdCenter.x, cmdCenter.y);
          ctx.lineTo(aCenter.x, aCenter.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Update + draw agents
      for (const agent of agentsRef.current) {
        // State machine
        agent.stateTimer--;
        if (agent.stateTimer <= 0) {
          if (agent.state === "idle") {
            // Decide: go to coffee, meeting, or wander
            const roll = Math.random();
            if (roll < 0.15) {
              const coffee = STATIONS.find((s) => s.name === "coffee")!;
              const c = stationCenter(coffee);
              agent.targetX = c.x + (Math.random() - 0.5) * 30;
              agent.targetY = c.y + (Math.random() - 0.5) * 20;
              agent.state = "walking";
              agent.stateTimer = 600;
              agent.statusMsg = "Getting coffee ☕";
            } else if (roll < 0.25) {
              const meeting = STATIONS.find((s) => s.name === "meeting")!;
              const c = stationCenter(meeting);
              agent.targetX = c.x + (Math.random() - 0.5) * 40;
              agent.targetY = c.y + (Math.random() - 0.5) * 30;
              agent.state = "walking";
              agent.stateTimer = 500;
              agent.statusMsg = "In a huddle 🤝";
            } else if (roll < 0.35) {
              // Visit another agent's station
              const other = pickRandomStation(agent.station);
              const c = stationCenter(other);
              agent.targetX = c.x + (Math.random() - 0.5) * 30;
              agent.targetY = c.y + (Math.random() - 0.5) * 20;
              agent.state = "walking";
              agent.stateTimer = 400;
              agent.statusMsg = `Visiting ${other.label}`;
            } else {
              // Stay idle, change status
              const msgs = statuses[agent.id] || ["Working..."];
              agent.statusMsg = msgs[Math.floor(Math.random() * msgs.length)];
              agent.stateTimer = 200 + Math.random() * 400;
            }
          } else if (agent.state === "walking") {
            // Return home
            const home = STATIONS.find((s) => s.name === agent.station)!;
            const c = stationCenter(home);
            agent.targetX = c.x + (Math.random() - 0.5) * 40;
            agent.targetY = c.y + (Math.random() - 0.5) * 30;
            agent.state = "walking";
            agent.stateTimer = 300;
            // After arriving home, go idle
            const dHome = dist({ x: agent.x, y: agent.y }, { x: agent.targetX, y: agent.targetY });
            if (dHome < 10) {
              agent.state = "idle";
              agent.stateTimer = 200 + Math.random() * 500;
              const msgs = statuses[agent.id] || ["Working..."];
              agent.statusMsg = msgs[Math.floor(Math.random() * msgs.length)];
            }
          }
        }

        // Move toward target
        const dx = agent.targetX - agent.x;
        const dy = agent.targetY - agent.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 2) {
          agent.x += (dx / d) * agent.speed;
          agent.y += (dy / d) * agent.speed;
          agent.direction = dx > 0 ? "right" : "left";
        }

        // Bob animation
        const bob = Math.sin(t * 0.05 + agent.bobOffset) * 2;

        // Shadow
        ctx.fillStyle = "rgba(0, 100, 200, 0.1)";
        ctx.beginPath();
        ctx.ellipse(agent.x, agent.y + SPRITE_SIZE / 2 + 4, 16, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw sprite
        if (agent.sprite && spritesLoadedRef.current) {
          ctx.save();
          if (agent.direction === "left") {
            ctx.translate(agent.x, agent.y + bob - SPRITE_SIZE / 2);
            ctx.scale(-1, 1);
            ctx.drawImage(agent.sprite, -SPRITE_SIZE / 2, 0, SPRITE_SIZE, SPRITE_SIZE);
          } else {
            ctx.drawImage(
              agent.sprite,
              agent.x - SPRITE_SIZE / 2,
              agent.y + bob - SPRITE_SIZE / 2,
              SPRITE_SIZE,
              SPRITE_SIZE
            );
          }
          ctx.restore();
        }

        // Name tag
        ctx.fillStyle = agent.id === "wire" ? "#00d4ff" : "#6888a8";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(agent.name, agent.x, agent.y - SPRITE_SIZE / 2 - 4 + bob);

        // Working indicator (small dots)
        if (agent.state === "idle") {
          const dotCount = 3;
          for (let i = 0; i < dotCount; i++) {
            const dotAlpha = 0.3 + 0.3 * Math.sin(t * 0.08 + i * 1.2 + agent.bobOffset);
            ctx.fillStyle = `rgba(0, 212, 255, ${dotAlpha})`;
            ctx.beginPath();
            ctx.arc(agent.x - 8 + i * 8, agent.y - SPRITE_SIZE / 2 - 14 + bob, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Title
      ctx.fillStyle = "#00d4ff";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "left";
      ctx.fillText("⚡ WHYRE Agent Office", 20, 30);
      ctx.fillStyle = "#3a5a7a";
      ctx.font = "11px monospace";
      ctx.fillText("TappinAI HQ — 10 agents, always shipping", 20, 48);

      // Clock
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      ctx.fillStyle = "#3a5a7a";
      ctx.font = "11px monospace";
      ctx.textAlign = "right";
      ctx.fillText(timeStr, CANVAS_W - 20, 30);

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
        background: "#050510",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        fontFamily: "monospace",
      }}
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        onClick={handleClick}
        style={{
          border: "1px solid #1a2a4a",
          borderRadius: 8,
          cursor: "pointer",
          maxWidth: "95vw",
          maxHeight: "85vh",
          imageRendering: "pixelated",
        }}
      />
      {tooltip && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x + 16,
            top: tooltip.y - 20,
            background: "#0d1b2a",
            border: "1px solid #00d4ff",
            borderRadius: 6,
            padding: "10px 14px",
            color: "#c0d8f0",
            fontSize: 12,
            zIndex: 100,
            pointerEvents: "none",
            boxShadow: "0 0 20px rgba(0,212,255,0.2)",
            minWidth: 160,
          }}
        >
          <div style={{ color: "#00d4ff", fontWeight: "bold", fontSize: 14, marginBottom: 4 }}>
            {tooltip.agent.name}
          </div>
          <div style={{ color: "#6888a8", marginBottom: 2 }}>{tooltip.agent.role}</div>
          <div style={{ color: "#88aacc" }}>📍 {tooltip.agent.statusMsg}</div>
          <div style={{ color: "#4a6a8a", marginTop: 4, fontSize: 10 }}>
            {tooltip.agent.state === "walking" ? "🚶 On the move" : "💼 At station"}
          </div>
        </div>
      )}
      <div
        style={{
          color: "#2a4a6a",
          fontSize: 11,
          marginTop: 12,
          textAlign: "center",
        }}
      >
        Click any agent to see their status • Built with ❤️ by TappinAI
      </div>
    </div>
  );
}
