import { NextResponse } from "next/server";
import { execFile } from "child_process";

// openclaw CLI path
const OPENCLAW_BIN = "/opt/homebrew/bin/openclaw";

/**
 * Send a voice transcript to WIRE via `openclaw agent --agent wire`.
 *
 * Why CLI instead of raw WebSocket:
 * The gateway requires device identity (pub/priv key signing) for operator.write
 * scopes needed by chat.send. The CLI handles this automatically via
 * ~/.openclaw/identity/device.json. A raw WS connection without device identity
 * gets scopes stripped to [] by clearUnboundScopes().
 *
 * Gateway connect frame format (for reference):
 * {
 *   type: "req", method: "connect", id: "0",
 *   params: {
 *     minProtocol: 3, maxProtocol: 3,
 *     client: { id: "cli", displayName: "...", version: "1.0.0",
 *               platform: "node", mode: "cli", instanceId: "..." },
 *     auth: { token: "<gateway-token>" }
 *   }
 * }
 */
export async function POST(req: Request) {
  try {
    const { text, context } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Empty transcript" },
        { status: 400 },
      );
    }

    // Build message with rolling context for continuity
    let message = "";
    if (Array.isArray(context) && context.length > 0) {
      message += `[Context: ${context.join(" → ")}]\n`;
    }
    message += `[Voice] ${text}`;

    console.log("[Voice API] Sending via Gateway agent:", message.slice(0, 80));

    // Fire-and-forget: spawn the CLI process and respond immediately.
    // openclaw agent handles device identity signing for write scopes.
    const child = execFile(
      OPENCLAW_BIN,
      ["agent", "--agent", "wire", "-m", message, "--json"],
      {
        timeout: 120000,
        env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` },
      },
    );

    child.on("error", (err) => {
      console.warn("[Voice API] Background agent error:", err.message);
    });

    console.log("[Voice API] Agent command dispatched");
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[Voice API] Error:", err.message);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 },
    );
  }
}
