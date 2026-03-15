import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// openclaw CLI path
const OPENCLAW_BIN = "/opt/homebrew/bin/openclaw";

/**
 * Send a voice transcript to WIRE via the Gateway using `openclaw agent`.
 * This sends the message directly to the agent session (no Slack round-trip).
 * Uses --agent wire to route to WIRE's session.
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

    // Use openclaw agent to send directly to WIRE's session via the Gateway.
    // This bypasses Slack entirely — the message goes straight to the agent.
    const args = [
      "agent",
      "--agent", "wire",
      "-m", message,
      "--json",
    ];

    // Fire and forget — don't wait for the full agent response.
    // We spawn detached so the API responds immediately.
    const child = execFile(OPENCLAW_BIN, args, {
      timeout: 120000,
      env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` },
    });

    // Don't await — let the agent process run in the background
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
