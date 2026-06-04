import fs from "fs";
import path from "path";
import type { ModelTier } from "../types/enums";

/**
 * Prompt registry. Prompts are versioned markdown files in engine/llm/prompts/ named
 * <id>.v<version>.md with front-matter + ===SYSTEM=== / ===USER=== sections. The resolved
 * version flows into every LLM result + cost-ledger row + figure for full traceability.
 */
export interface LoadedPrompt {
  id: string;
  version: number;
  tier?: ModelTier;
  system: string;
  user: string;
}

const PROMPT_DIR = path.join(process.cwd(), "engine", "llm", "prompts");

let cache: Map<string, Map<number, LoadedPrompt>> | null = null;

function parsePromptFile(raw: string, fallbackId: string): LoadedPrompt {
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const meta: Record<string, string> = {};
  let body = raw;
  if (fm) {
    for (const line of fm[1].split("\n")) {
      const idx = line.indexOf(":");
      if (idx > 0) meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    body = fm[2];
  }
  const userSplit = body.split(/^===USER===\s*$/m);
  const systemPart = userSplit[0].replace(/^===SYSTEM===\s*$/m, "").trim();
  const userPart = (userSplit[1] ?? "").trim();
  return {
    id: meta.id ?? fallbackId,
    version: meta.version ? parseInt(meta.version, 10) : 1,
    tier: (meta.tier as ModelTier) || undefined,
    system: systemPart,
    user: userPart,
  };
}

function loadAll(): Map<string, Map<number, LoadedPrompt>> {
  if (cache) return cache;
  cache = new Map();
  let files: string[] = [];
  try {
    files = fs.readdirSync(PROMPT_DIR).filter((f) => f.endsWith(".md"));
  } catch {
    files = [];
  }
  for (const file of files) {
    const raw = fs.readFileSync(path.join(PROMPT_DIR, file), "utf8");
    const fallbackId = file.replace(/\.v\d+\.md$/, "");
    const p = parsePromptFile(raw, fallbackId);
    if (!cache.has(p.id)) cache.set(p.id, new Map());
    cache.get(p.id)!.set(p.version, p);
  }
  return cache;
}

export function getPrompt(id: string, version?: number): LoadedPrompt {
  const versions = loadAll().get(id);
  if (!versions || versions.size === 0) throw new Error(`Prompt not found: ${id}`);
  const v = version ?? Math.max(...versions.keys());
  const p = versions.get(v);
  if (!p) throw new Error(`Prompt version not found: ${id} v${v}`);
  return p;
}

/** Replace {{key}} placeholders; objects are JSON-stringified. */
export function renderTemplate(template: string, vars: Record<string, unknown> = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = vars[key];
    if (v === undefined || v === null) return "";
    return typeof v === "object" ? JSON.stringify(v, null, 2) : String(v);
  });
}
