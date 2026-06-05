export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api";
import { streamAnswer } from "@/surfaces/assistant/assistant";

/**
 * Streaming assistant. Emits the markdown answer token-by-token as plain text; the model appends a
 * trailing `===DATA===` + JSON block (citations / suggestions / chart / grounded) which the client
 * splits off. One streamed LLM call — real token streaming with structured extras.
 */
export async function POST(req: NextRequest) {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  const { question, market, history } = (await req.json().catch(() => ({}))) as { question?: string; market?: string; history?: Array<{ role: string; text: string }> };
  if (!question || question.trim().length < 2) return new Response("Ask a question.", { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of streamAnswer(question, market, Array.isArray(history) ? history : undefined)) {
          controller.enqueue(encoder.encode(delta));
        }
      } catch (e) {
        controller.enqueue(encoder.encode(`\n\n_The assistant hit an error: ${e instanceof Error ? e.message : "unknown"}._`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
