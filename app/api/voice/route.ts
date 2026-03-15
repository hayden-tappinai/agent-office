import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Voice → WIRE pipeline via OpenClaw CLI.
 *
 * The Gateway WebSocket requires device-pairing + challenge-response auth
 * that isn't available to server-side API routes. Instead, we shell out to
 * `openclaw message send` which uses the Slack channel that WIRE monitors.
 *
 * Messages are sent from the CODE bot account so WIRE doesn't ignore them
 * as self-authored messages.
 */
const OPENCLAW_BIN = "/opt/homebrew/bin/openclaw";
const SLACK_CHANNEL = "C0ALJCWBHLN";
const SLACK_ACCOUNT = "code"; // Not "whyre" — WIRE ignores its own bot's messages

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

    const args = [
      "message",
      "send",
      "--channel",
      "slack",
      "--account",
      SLACK_ACCOUNT,
      "-m",
      message,
      "-t",
      SLACK_CHANNEL,
    ];

    console.log("[Voice API] Sending via CLI:", message.slice(0, 80));

    const { stderr } = await execFileAsync(OPENCLAW_BIN, args, {
      timeout: 15000,
      env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` },
    });

    // openclaw doctor warnings are expected — only log real errors
    if (stderr && !stderr.includes("Doctor") && !stderr.includes("doctor")) {
      console.warn("[Voice API] CLI stderr:", stderr.slice(0, 200));
    }

    console.log("[Voice API] Sent OK");
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[Voice API] Error:", err.message);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 },
    );
  }
}
