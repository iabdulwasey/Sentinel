export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { guard, ok, fail } from "@/lib/api";
import { answerQuestion } from "@/surfaces/assistant/assistant";

export async function POST(req: NextRequest) {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  const { question, market, history } = (await req.json().catch(() => ({}))) as { question?: string; market?: string; history?: Array<{ role: string; text: string }> };
  if (!question || question.trim().length < 2) return fail("Ask a question.");
  try {
    const answer = await answerQuestion(question, market, Array.isArray(history) ? history : undefined);
    return ok(answer);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "The assistant could not complete the request.", 500);
  }
}
