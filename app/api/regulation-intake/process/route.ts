export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import "@/surfaces/all";
import { startPipeline } from "@/engine/pipeline/runner";
import { storage } from "@/engine/storage";
import { guard, ok, fail } from "@/lib/api";
import { db } from "@/lib/db";

/**
 * Surface C entrypoint — upload a regulation (PDF/image multipart, or pasted text) and kick off
 * the regulation-intake pipeline. Returns 202 + { importId, runId }; the workspace's PipelineStepper
 * drives the stages. The proposed ruleset is a quarantined draft until a human activates it.
 */
export async function POST(req: NextRequest) {
  const user = await guard();
  if (user instanceof NextResponse) return user;

  let fileName: string | undefined;
  let mimeType: string | undefined;
  let storageRef: string | undefined;
  let sha256: string | undefined;
  let byteSize: number | undefined;
  let rawText: string | undefined;

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    const rt = form.get("rawText");
    if (typeof rt === "string" && rt.trim()) rawText = rt;
    if (file && file instanceof File && file.size > 0) {
      const buf = Buffer.from(await file.arrayBuffer());
      fileName = file.name;
      mimeType = file.type || "application/pdf";
      byteSize = buf.length;
      sha256 = crypto.createHash("sha256").update(buf).digest("hex");
      const safe = file.name.replace(/[^\w.\-]/g, "_");
      const stored = await storage().put(`regulations/${crypto.randomUUID()}-${safe}`, buf, mimeType);
      storageRef = stored.ref;
    }
  } else {
    const body = (await req.json().catch(() => ({}))) as { rawText?: string; fileName?: string };
    if (body.rawText?.trim()) rawText = body.rawText;
    fileName = body.fileName;
  }

  if (!storageRef && !rawText) return fail("Provide a regulation file (PDF/image) or rawText.", 400);

  const count = await db.rulesetImport.count();
  const reference = `REG-IMP-${String(count + 1).padStart(4, "0")}`;
  const imp = await db.rulesetImport.create({
    data: { reference, fileName, mimeType, storageRef, sha256, byteSize, rawText, status: "RECEIVED" },
  });

  const runId = await startPipeline("REGINTAKE", imp.id);
  return ok({ importId: imp.id, runId, reference }, { status: 202 });
}
