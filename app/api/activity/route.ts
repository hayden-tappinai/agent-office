import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

const ACTIVITY_FILE = "/Users/whyre/.openclaw/workspace/agent-activity.json";

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

export async function GET() {
  try {
    if (!existsSync(ACTIVITY_FILE)) {
      return NextResponse.json({
        activeAgents: [],
        recentCompletions: [],
      } satisfies ActivityData);
    }

    const raw = await readFile(ACTIVITY_FILE, "utf-8");
    const data: ActivityData = JSON.parse(raw);

    // Filter completions to only those within last 30 seconds (for the ✅ animation)
    const now = Date.now();
    const recentCompletions = (data.recentCompletions || []).filter((c) => {
      const completedAt = new Date(c.completedAt).getTime();
      return now - completedAt < 30_000;
    });

    return NextResponse.json({
      activeAgents: data.activeAgents || [],
      recentCompletions,
    } satisfies ActivityData);
  } catch {
    return NextResponse.json({
      activeAgents: [],
      recentCompletions: [],
    });
  }
}
