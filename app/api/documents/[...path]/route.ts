export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api";
import { storage } from "@/engine/storage";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  const { path } = await ctx.params;
  const ref = path.join("/");
  try {
    const bytes = await storage().getBytes(ref);
    const ct = ref.endsWith(".png") ? "image/png" : ref.endsWith(".jpg") || ref.endsWith(".jpeg") ? "image/jpeg" : "application/pdf";
    return new NextResponse(new Uint8Array(bytes), { headers: { "content-type": ct, "cache-control": "private, max-age=120" } });
  } catch {
    return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
  }
}
