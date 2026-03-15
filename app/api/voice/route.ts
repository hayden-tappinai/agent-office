import { NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";

const ACTIVITY_FILE = "/Users/whyre/.openclaw/workspace/agent-activity.json";
const GATEWAY_URL = "http://localhost:18789/api/message";
const GATEWAY_TOKEN = "53e6acd8e9f8adc6951c4db8eadca417f56c2387f40bb001";

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ ok: false, error: "Empty transcript" }, { status: 400 });
    }

    const transcript = text.trim();

    // 1. Update agent-activity.json to show WIRE as active
    try {
      let activityData = { activeAgents: [] as any[], recentCompletions: [] as any[] };
      if (existsSync(ACTIVITY_FILE)) {
        const raw = await readFile(ACTIVITY_FILE, "utf-8");
        activityData = JSON.parse(raw);
      }

      // Add WIRE to active agents if not already there
      const wireActive = activityData.activeAgents?.find((a: any) => a.id === "wire");
      if (!wireActive) {
        activityData.activeAgents = activityData.activeAgents || [];
        activityData.activeAgents.push({
          id: "wire",
          task: `Voice: "${transcript.length > 60 ? transcript.slice(0, 57) + "..." : transcript}"`,
          startedAt: new Date().toISOString(),
        });
      } else {
        wireActive.task = `Voice: "${transcript.length > 60 ? transcript.slice(0, 57) + "..." : transcript}"`;
        wireActive.startedAt = new Date().toISOString();
      }

      await writeFile(ACTIVITY_FILE, JSON.stringify(activityData, null, 2));
    } catch {
      // Non-fatal — continue even if activity update fails
    }

    // 2. Forward transcript to OpenClaw gateway
    const gatewayRes = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GATEWAY_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: "webchat",
        message: transcript,
        agentId: "wire",
      }),
    });

    if (!gatewayRes.ok) {
      const errText = await gatewayRes.text().catch(() => "unknown error");
      return NextResponse.json(
        { ok: false, error: `Gateway error: ${gatewayRes.status}`, detail: errText },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, transcript });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}
