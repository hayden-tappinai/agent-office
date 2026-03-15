"use client";
import { useEffect, useRef, useState } from "react";

// ─── Constants ───
const TILE = 16;
const COLS = 60;
const ROWS = 40;
const W = COLS * TILE;
const H = ROWS * TILE;
const SCALE = typeof window !== "undefined" ? Math.min(window.innerWidth / W, window.innerHeight / H, 2) : 1;

// ─── Colors ───
const C = {
  wall: "#2d2d44",
  wallTop: "#3d3d5c",
  floor: "#4a4a6a",
  floorAlt: "#52527a",
  carpet: "#5c3d6e",
  carpetAlt: "#6b4d7e",
  desk: "#8b6914",
  deskTop: "#a07828",
  monitor: "#1a1a2e",
  monitorScreen: "#00ff88",
  monitorScreenBlue: "#4488ff",
  monitorScreenPurple: "#aa44ff",
  chair: "#444466",
  coffee: "#8B4513",
  coffeeTop: "#654321",
  whiteboard: "#e8e8e8",
  whiteboardFrame: "#888888",
  bookshelf: "#654321",
  bookColor1: "#cc3333",
  bookColor2: "#3366cc",
  bookColor3: "#33aa33",
  bookColor4: "#cc9933",
  filing: "#667788",
  filingHandle: "#aabbcc",
  mailSlot: "#997755",
  designWall: "#555577",
  studioLight: "#ffdd44",
  camera: "#333344",
  plant: "#228833",
  plantPot: "#885533",
  meetingTable: "#6b5b3a",
  rug: "#6b3a4a",
  rugAlt: "#7b4a5a",
};

// ─── Agent Definitions ───
interface AgentDef {
  id: string;
  name: string;
  emoji: string;
  role: string;
  homeX: number;
  homeY: number;
  sprite: string;
}

const AGENTS: AgentDef[] = [
  { id: "wire", name: "WIRE", emoji: "⚡", role: "CEO — Command & Delegation", homeX: 29, homeY: 19, sprite: "/sprites/wire.png" },
  { id: "code", name: "CODE", emoji: "💻", role: "Builder — Ships Features & PRs", homeX: 8, homeY: 8, sprite: "/sprites/code.png" },
  { id: "hunt", name: "HUNT", emoji: "🔍", role: "Scout — Research & Investigation", homeX: 45, homeY: 12, sprite: "/sprites/hunt.png" },
  { id: "snap", name: "SNAP", emoji: "📸", role: "Media — Screenshots & Video Gen", homeX: 52, homeY: 30, sprite: "/sprites/snap.png" },
  { id: "plan", name: "PLAN", emoji: "📋", role: "Strategist — Planning & Scheduling", homeX: 42, homeY: 5, sprite: "/sprites/plan.png" },
  { id: "eyes", name: "EYES", emoji: "👀", role: "Critic — Code Review & QA", homeX: 8, homeY: 18, sprite: "/sprites/eyes.png" },
  { id: "sage", name: "SAGE", emoji: "🧠", role: "Advisor — Architecture & Strategy", homeX: 52, homeY: 6, sprite: "/sprites/sage.png" },
  { id: "mail", name: "MAIL", emoji: "📬", role: "Comms — Email & Outreach", homeX: 8, homeY: 30, sprite: "/sprites/mail.png" },
  { id: "memo", name: "MEMO", emoji: "📝", role: "Scribe — Memory & Documentation", homeX: 20, homeY: 30, sprite: "/sprites/memo.png" },
  { id: "look", name: "LOOK", emoji: "🎨", role: "Designer — UI/UX & Design System", homeX: 35, homeY: 30, sprite: "/sprites/look.png" },
];

// Shared areas agents can visit
const SHARED_AREAS = [
  { name: "Coffee", x: 28, y: 4 },
  { name: "Meeting", x: 28, y: 28 },
  { name: "Whiteboard", x: 42, y: 5 },
  { name: "Lounge", x: 30, y: 14 },
  { name: "Water Cooler", x: 20, y: 14 },
];

// ─── Office Map (procedural) ───
function drawOffice(ctx: CanvasRenderingContext2D) {
  // Floor
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? C.floor : C.floorAlt;
      ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
    }
  }

  // Walls (top and sides)
  ctx.fillStyle = C.wall;
  ctx.fillRect(0, 0, W, TILE * 2);
  ctx.fillRect(0, 0, TILE * 2, H);
  ctx.fillRect(W - TILE * 2, 0, TILE * 2, H);
  ctx.fillRect(0, H - TILE * 2, W, TILE * 2);
  // Wall highlight
  ctx.fillStyle = C.wallTop;
  ctx.fillRect(0, TILE, W, 2);
  ctx.fillRect(TILE, 0, 2, H);
  ctx.fillRect(W - TILE - 2, 0, 2, H);
  ctx.fillRect(0, H - TILE - 2, W, 2);

  // ── Carpet areas ──
  drawCarpet(ctx, 25, 25, 12, 10); // meeting room
  drawCarpet(ctx, 25, 11, 12, 8);  // center lounge

  // ── CODE's desk (top-left area) ──
  drawDesk(ctx, 6, 6, 2, true);
  drawDesk(ctx, 6, 8, 2, true); // dual monitors
  drawMonitor(ctx, 6, 6, C.monitorScreen);
  drawMonitor(ctx, 6, 8, C.monitorScreenBlue);
  drawChair(ctx, 8, 7);

  // ── EYES' review station (left middle) ──
  drawDesk(ctx, 6, 16, 2, true);
  drawDesk(ctx, 6, 18, 2, true);
  drawDesk(ctx, 6, 20, 2, true);
  drawMonitor(ctx, 6, 16, C.monitorScreenPurple);
  drawMonitor(ctx, 6, 18, C.monitorScreen);
  drawMonitor(ctx, 6, 20, C.monitorScreenBlue);
  drawChair(ctx, 8, 18);

  // ── MAIL corner (bottom-left) ──
  drawMailStation(ctx, 5, 28);

  // ── MEMO filing area (bottom-center-left) ──
  drawFilingCabinets(ctx, 18, 28);

  // ── WIRE's command desk (center) ──
  drawDesk(ctx, 27, 17, 6, false);
  drawMonitor(ctx, 28, 17, C.monitorScreen);
  drawMonitor(ctx, 31, 17, C.monitorScreenBlue);
  drawChair(ctx, 29, 19);

  // ── PLAN's whiteboard area (top-right-ish) ──
  drawWhiteboard(ctx, 40, 2);
  drawChair(ctx, 42, 6);

  // ── SAGE's bookshelf corner (far right top) ──
  drawBookshelf(ctx, 50, 3);
  drawChair(ctx, 52, 7);

  // ── Coffee machine (top center) ──
  drawCoffeeMachine(ctx, 26, 2);

  // ── Meeting room (bottom center) ──
  drawMeetingTable(ctx, 27, 27);

  // ── SNAP's studio (bottom-right) ──
  drawStudio(ctx, 50, 28);

  // ── LOOK's design wall (bottom-center-right) ──
  drawDesignWall(ctx, 33, 28);

  // ── HUNT roams but has a small investigation desk ──
  drawDesk(ctx, 43, 11, 2, true);
  drawMonitor(ctx, 43, 11, C.monitorScreen);
  drawChair(ctx, 45, 12);

  // ── Plants ──
  drawPlant(ctx, 3, 3);
  drawPlant(ctx, 56, 3);
  drawPlant(ctx, 3, 36);
  drawPlant(ctx, 56, 36);
  drawPlant(ctx, 24, 10);
  drawPlant(ctx, 37, 10);

  // ── Water cooler ──
  drawWaterCooler(ctx, 19, 12);
}

function drawCarpet(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? C.carpet : C.carpetAlt;
      ctx.fillRect((x + c) * TILE, (y + r) * TILE, TILE, TILE);
    }
  }
}

function drawDesk(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, vertical: boolean) {
  if (vertical) {
    ctx.fillStyle = C.desk;
    ctx.fillRect(x * TILE, y * TILE, TILE * 2, TILE * w);
    ctx.fillStyle = C.deskTop;
    ctx.fillRect(x * TILE + 2, y * TILE + 2, TILE * 2 - 4, TILE * w - 4);
  } else {
    ctx.fillStyle = C.desk;
    ctx.fillRect(x * TILE, y * TILE, TILE * w, TILE * 2);
    ctx.fillStyle = C.deskTop;
    ctx.fillRect(x * TILE + 2, y * TILE + 2, TILE * w - 4, TILE * 2 - 4);
  }
}

function drawMonitor(ctx: CanvasRenderingContext2D, x: number, y: number, screenColor: string) {
  ctx.fillStyle = C.monitor;
  ctx.fillRect(x * TILE + 3, y * TILE + 3, TILE - 6, TILE - 4);
  ctx.fillStyle = screenColor;
  ctx.fillRect(x * TILE + 5, y * TILE + 5, TILE - 10, TILE - 8);
  // screen glow
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = screenColor;
  ctx.fillRect((x - 1) * TILE, (y - 1) * TILE, TILE * 3, TILE * 3);
  ctx.globalAlpha = 1;
}

function drawChair(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = C.chair;
  ctx.beginPath();
  ctx.arc(x * TILE + TILE / 2, y * TILE + TILE / 2, TILE / 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawWhiteboard(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = C.whiteboardFrame;
  ctx.fillRect(x * TILE, y * TILE, TILE * 6, TILE * 3);
  ctx.fillStyle = C.whiteboard;
  ctx.fillRect(x * TILE + 3, y * TILE + 3, TILE * 6 - 6, TILE * 3 - 6);
  // some "writing" on the board
  ctx.fillStyle = "#cc3333";
  ctx.fillRect(x * TILE + 8, y * TILE + 10, 30, 2);
  ctx.fillStyle = "#3366cc";
  ctx.fillRect(x * TILE + 8, y * TILE + 16, 45, 2);
  ctx.fillStyle = "#33aa33";
  ctx.fillRect(x * TILE + 8, y * TILE + 22, 20, 2);
  ctx.fillRect(x * TILE + 8, y * TILE + 28, 55, 2);
}

function drawBookshelf(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = C.bookshelf;
  ctx.fillRect(x * TILE, y * TILE, TILE * 6, TILE * 4);
  // shelves
  const colors = [C.bookColor1, C.bookColor2, C.bookColor3, C.bookColor4];
  for (let shelf = 0; shelf < 3; shelf++) {
    for (let b = 0; b < 8; b++) {
      ctx.fillStyle = colors[(shelf + b) % colors.length];
      const bx = x * TILE + 4 + b * 11;
      const by = y * TILE + 4 + shelf * 18;
      ctx.fillRect(bx, by, 8, 14);
    }
  }
}

function drawCoffeeMachine(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = C.coffee;
  ctx.fillRect(x * TILE, y * TILE, TILE * 3, TILE * 2);
  ctx.fillStyle = C.coffeeTop;
  ctx.fillRect(x * TILE + 4, y * TILE + 4, TILE * 3 - 8, TILE - 4);
  // coffee indicator light
  ctx.fillStyle = "#ff3333";
  ctx.fillRect(x * TILE + 6, y * TILE + 6, 4, 4);
  ctx.fillStyle = "#00ff00";
  ctx.fillRect(x * TILE + 12, y * TILE + 6, 4, 4);
}

function drawMeetingTable(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = C.meetingTable;
  ctx.fillRect(x * TILE, y * TILE, TILE * 6, TILE * 4);
  ctx.fillStyle = "#7b6b4a";
  ctx.fillRect(x * TILE + 3, y * TILE + 3, TILE * 6 - 6, TILE * 4 - 6);
  // chairs around
  for (let i = 0; i < 3; i++) {
    drawChair(ctx, x + i * 2 + 1, y - 1);
    drawChair(ctx, x + i * 2 + 1, y + 4);
  }
}

function drawStudio(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // studio lights
  ctx.fillStyle = C.studioLight;
  ctx.fillRect(x * TILE, y * TILE, TILE, TILE * 3);
  ctx.fillRect((x + 5) * TILE, y * TILE, TILE, TILE * 3);
  // camera
  ctx.fillStyle = C.camera;
  ctx.fillRect((x + 2) * TILE, (y + 1) * TILE, TILE * 2, TILE);
  ctx.fillStyle = "#555566";
  ctx.fillRect((x + 2) * TILE + 4, (y + 1) * TILE + 3, TILE - 4, TILE - 6);
  // tripod
  ctx.fillStyle = "#444444";
  ctx.fillRect((x + 2) * TILE + 6, (y + 2) * TILE, 4, TILE);
}

function drawMailStation(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // mail slots
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = C.mailSlot;
    ctx.fillRect(x * TILE, (y + i * 2) * TILE, TILE * 4, TILE * 2 - 2);
    ctx.fillStyle = "#bbaa88";
    ctx.fillRect(x * TILE + 3, (y + i * 2) * TILE + 3, TILE * 4 - 6, TILE * 2 - 8);
    // envelope icon
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x * TILE + 8, (y + i * 2) * TILE + 6, 12, 8);
    ctx.fillStyle = "#cccccc";
    ctx.fillRect(x * TILE + 10, (y + i * 2) * TILE + 8, 8, 4);
  }
}

function drawFilingCabinets(ctx: CanvasRenderingContext2D, x: number, y: number) {
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = C.filing;
    ctx.fillRect((x + i * 2) * TILE, y * TILE, TILE * 2, TILE * 4);
    // drawer lines
    for (let d = 0; d < 3; d++) {
      ctx.fillStyle = "#556677";
      ctx.fillRect((x + i * 2) * TILE + 2, y * TILE + 4 + d * 18, TILE * 2 - 4, 14);
      ctx.fillStyle = C.filingHandle;
      ctx.fillRect((x + i * 2) * TILE + 10, y * TILE + 8 + d * 18, 12, 4);
    }
  }
}

function drawDesignWall(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = C.designWall;
  ctx.fillRect(x * TILE, y * TILE, TILE * 6, TILE * 4);
  // mood board cards
  const cardColors = ["#ff6666", "#66aaff", "#ffaa33", "#66ff99", "#ff66cc", "#aaaaff"];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      ctx.fillStyle = cardColors[r * 3 + c];
      ctx.fillRect(x * TILE + 5 + c * 28, y * TILE + 5 + r * 28, 22, 22);
    }
  }
}

function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = C.plantPot;
  ctx.fillRect(x * TILE + 3, y * TILE + 8, TILE - 6, TILE - 8);
  ctx.fillStyle = C.plant;
  ctx.beginPath();
  ctx.arc(x * TILE + TILE / 2, y * TILE + 6, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x * TILE + 2, y * TILE + 2, 4, 6);
  ctx.fillRect(x * TILE + TILE - 6, y * TILE + 2, 4, 6);
}

function drawWaterCooler(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#aabbcc";
  ctx.fillRect(x * TILE + 2, y * TILE + 4, TILE - 4, TILE * 2 - 4);
  ctx.fillStyle = "#88ccff";
  ctx.fillRect(x * TILE + 4, y * TILE, TILE - 8, TILE - 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x * TILE + 5, y * TILE + 2, TILE - 10, 6);
}

// ─── Agent State ───
interface AgentState {
  def: AgentDef;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  state: "idle" | "walking" | "arrived";
  idleTimer: number;
  img: HTMLImageElement | null;
}

function createAgentState(def: AgentDef): AgentState {
  return {
    def,
    x: def.homeX * TILE,
    y: def.homeY * TILE,
    targetX: def.homeX * TILE,
    targetY: def.homeY * TILE,
    state: "idle",
    idleTimer: Math.random() * 120 + 60,
    img: null,
  };
}

function pickTarget(agent: AgentState): { x: number; y: number } {
  const isHome = Math.abs(agent.x - agent.def.homeX * TILE) < TILE && Math.abs(agent.y - agent.def.homeY * TILE) < TILE;
  if (isHome) {
    // Go to a shared area
    const area = SHARED_AREAS[Math.floor(Math.random() * SHARED_AREAS.length)];
    // HUNT roams more — sometimes picks random spots
    if (agent.def.id === "hunt" && Math.random() < 0.4) {
      return {
        x: (4 + Math.floor(Math.random() * (COLS - 8))) * TILE,
        y: (4 + Math.floor(Math.random() * (ROWS - 8))) * TILE,
      };
    }
    return { x: area.x * TILE, y: area.y * TILE };
  } else {
    // Go home
    return { x: agent.def.homeX * TILE, y: agent.def.homeY * TILE };
  }
}

function updateAgent(agent: AgentState) {
  if (agent.state === "idle") {
    agent.idleTimer--;
    if (agent.idleTimer <= 0) {
      const t = pickTarget(agent);
      agent.targetX = t.x;
      agent.targetY = t.y;
      agent.state = "walking";
    }
  } else if (agent.state === "walking") {
    const dx = agent.targetX - agent.x;
    const dy = agent.targetY - agent.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 2) {
      agent.x = agent.targetX;
      agent.y = agent.targetY;
      agent.state = "idle";
      agent.idleTimer = agent.def.id === "hunt" ? Math.random() * 60 + 30 : Math.random() * 180 + 90;
    } else {
      const speed = agent.def.id === "hunt" ? 1.2 : 0.8;
      agent.x += (dx / dist) * speed;
      agent.y += (dy / dist) * speed;
    }
  }
}

function drawAgent(ctx: CanvasRenderingContext2D, agent: AgentState, time: number) {
  const size = 28;
  const bob = agent.state === "walking" ? Math.sin(time * 0.15) * 1.5 : 0;
  const drawX = agent.x - size / 2;
  const drawY = agent.y - size / 2 + bob;

  if (agent.img && agent.img.complete) {
    // Draw shadow
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(agent.x, agent.y + size / 2 + 2, size / 2.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.drawImage(agent.img, drawX, drawY, size, size);
  } else {
    // Fallback colored circle
    ctx.fillStyle = "#ff6688";
    ctx.beginPath();
    ctx.arc(agent.x, agent.y + bob, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Name tag
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(agent.x - 16, agent.y - size / 2 - 12 + bob, 32, 10);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 7px monospace";
  ctx.textAlign = "center";
  ctx.fillText(agent.def.name, agent.x, agent.y - size / 2 - 4 + bob);
}

// ─── Main Component ───
export default function AgentOffice() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const agentsRef = useRef<AgentState[]>([]);
  const frameRef = useRef(0);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; agent: AgentDef } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    // Init agents
    const agents = AGENTS.map((def) => {
      const state = createAgentState(def);
      const img = new Image();
      img.src = def.sprite;
      state.img = img;
      return state;
    });
    agentsRef.current = agents;

    // Pre-render office background
    const bgCanvas = document.createElement("canvas");
    bgCanvas.width = W;
    bgCanvas.height = H;
    const bgCtx = bgCanvas.getContext("2d")!;
    drawOffice(bgCtx);

    let animId: number;
    let frame = 0;

    function loop() {
      frame++;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(bgCanvas, 0, 0);

      // Update & draw agents
      for (const agent of agents) {
        updateAgent(agent);
      }
      // Sort by Y for depth
      const sorted = [...agents].sort((a, b) => a.y - b.y);
      for (const agent of sorted) {
        drawAgent(ctx, agent, frame);
      }

      frameRef.current = frame;
      animId = requestAnimationFrame(loop);
    }

    loop();
    return () => cancelAnimationFrame(animId);
  }, []);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    for (const agent of agentsRef.current) {
      const dx = mx - agent.x;
      const dy = my - agent.y;
      if (Math.sqrt(dx * dx + dy * dy) < 18) {
        setTooltip({ x: e.clientX, y: e.clientY, agent: agent.def });
        return;
      }
    }
    setTooltip(null);
  }

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f23", position: "relative" }}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onClick={handleClick}
        style={{
          width: `${W * SCALE}px`,
          height: `${H * SCALE}px`,
          imageRendering: "pixelated",
          cursor: "pointer",
          border: "2px solid #333355",
          borderRadius: "4px",
        }}
      />
      {tooltip && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x + 12,
            top: tooltip.y - 60,
            background: "rgba(20,20,40,0.95)",
            border: "2px solid #5566aa",
            borderRadius: 8,
            padding: "10px 14px",
            color: "#e0e0ff",
            fontFamily: "monospace",
            fontSize: 13,
            zIndex: 100,
            pointerEvents: "none",
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          }}
          onClick={() => setTooltip(null)}
        >
          <div style={{ fontSize: 18, marginBottom: 4 }}>
            {tooltip.agent.emoji} <strong>{tooltip.agent.name}</strong>
          </div>
          <div style={{ color: "#aabbdd", fontSize: 11 }}>{tooltip.agent.role}</div>
        </div>
      )}
      <div style={{ position: "fixed", bottom: 12, left: "50%", transform: "translateX(-50%)", color: "#556688", fontFamily: "monospace", fontSize: 11 }}>
        click an agent to inspect · 10 AI agents at work
      </div>
    </div>
  );
}
