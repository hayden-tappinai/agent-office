import { NextResponse } from "next/server";

export async function POST() {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ELEVENLABS_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Get a single-use token for ElevenLabs Scribe v2 Realtime
    const response = await fetch(
      "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[scribe-token] ElevenLabs error:", response.status, errorText);
      return NextResponse.json(
        { error: `Failed to get scribe token: ${response.status}` },
        { status: 502 }
      );
    }

    const { token } = await response.json();
    return NextResponse.json({ token });
  } catch (err: any) {
    console.error("[scribe-token] Error:", err);
    return NextResponse.json(
      { error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}
