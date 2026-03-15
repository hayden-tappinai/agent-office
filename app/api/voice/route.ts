import { NextResponse } from "next/server";
import WebSocket from "ws";

const GW_URL = "ws://127.0.0.1:18789";
const GW_TOKEN = "53e6acd8e9f8adc6951c4db8eadca417f56c2387f40bb001";

let ws: WebSocket | null = null;
let authenticated = false;
let msgId = 0;
let connectPromise: Promise<void> | null = null;

function nextId(): string {
  return String(++msgId);
}

function ensureConnection(): Promise<void> {
  if (ws && ws.readyState === WebSocket.OPEN && authenticated) {
    return Promise.resolve();
  }
  if (connectPromise) return connectPromise;

  connectPromise = new Promise<void>((resolve, reject) => {
    // Clean up old socket
    if (ws) {
      try { ws.close(); } catch {}
      ws = null;
    }
    authenticated = false;

    const socket = new WebSocket(GW_URL);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("Gateway connection timeout"));
    }, 5000);

    socket.on("open", () => {
      socket.send(JSON.stringify({
        type: "req",
        method: "connect",
        id: nextId(),
        params: { token: GW_TOKEN },
      }));
    });

    socket.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "res" && msg.method === "hello-ok") {
          authenticated = true;
          ws = socket;
          clearTimeout(timeout);
          connectPromise = null;
          resolve();
        }
      } catch {}
    });

    socket.on("error", (err) => {
      clearTimeout(timeout);
      connectPromise = null;
      ws = null;
      authenticated = false;
      reject(err);
    });

    socket.on("close", () => {
      ws = null;
      authenticated = false;
      connectPromise = null;
    });
  });

  return connectPromise;
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ ok: false, error: "Empty transcript" }, { status: 400 });
    }

    await ensureConnection();

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error("Gateway WebSocket not connected");
    }

    ws.send(JSON.stringify({
      type: "req",
      method: "chat.send",
      id: nextId(),
      params: {
        message: `[Voice] ${text}`,
        agentId: "wire",
      },
    }));

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // Reset connection state on failure so next request retries
    ws = null;
    authenticated = false;
    connectPromise = null;
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
