import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const OPENCLAW_BIN = "/opt/homebrew/bin/openclaw";
const SLACK_CHANNEL = "C0ALJCWBHLN";
const SLACK_ACCOUNT = "code";

export async function POST(req: Request) {
  try {
    const { text, context } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ ok: false, error: "Empty transcript" }, { status: 400 });
    }
    let message = "";
    if (Array.isArray(context) && context.length > 0) {
      message += `[Context: ${context.join(" → ")}]\n`;
    }
    message += `[Voice] ${text}`;

    await execFileAsync(OPENCLAW_BIN, [
      "message", "send", "--channel", "slack", "--account", SLACK_ACCOUNT,
      "-m", message, "-t", SLACK_CHANNEL
    ], {
      timeout: 15000,
      env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` }
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
