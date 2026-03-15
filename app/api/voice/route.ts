import { NextResponse } from "next/server";
import { execSync } from "child_process";

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ ok: false, error: "Empty transcript" }, { status: 400 });
    }
    const escaped = text.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
    execSync(
      `openclaw message send --channel slack --target C0ALJCWBHLN -m "[Voice] ${escaped}"`,
      { timeout: 10000 }
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
