import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { writeFileSync, readFileSync } from "fs";

const ACTIVITY_FILE = "/Users/whyre/.openclaw/workspace/agent-activity.json";

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ ok: false, error: "Empty transcript" }, { status: 400 });
    }

    // Update activity file — WIRE is processing voice input
    try {
      const activity = JSON.parse(readFileSync(ACTIVITY_FILE, "utf-8"));
      activity.activeAgents = [
        { id: "wire", task: `Voice: "${text.slice(0, 80)}..."`, startedAt: new Date().toISOString() }
      ];
      writeFileSync(ACTIVITY_FILE, JSON.stringify(activity, null, 2));
    } catch {}

    // Send to WIRE via openclaw CLI → routes to the Slack #hq session
    const escaped = text.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
    execSync(
      `openclaw message send --channel slack --target C0ALJCWBHLN -m "[Voice] ${escaped}"`,
      { timeout: 10000 }
    );

    return NextResponse.json({ ok: true, transcript: text });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}
