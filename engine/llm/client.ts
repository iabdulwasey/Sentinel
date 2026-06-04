import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db } from "../../lib/db";
import type { AgentName } from "../types/enums";
import { routeModel, type RouteHints } from "./router";
import { getPrompt, renderTemplate } from "./prompts";
import { computeCostMicroUsd, TIER_TIMEOUT_MS, type ModelId, MODEL_BY_TIER } from "./models";

/**
 * The ONE place the Anthropic SDK is used. Resolves model (router) + prompt (registry),
 * caches the system+ruleset prefix, forces structured output via tool-use, retries with
 * backoff, and writes a cost-ledger row on every terminal outcome. Nothing else imports the SDK.
 */

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set — required for live AI operations.");
  _client = new Anthropic({ apiKey });
  return _client;
}

export interface DocBlock {
  mediaType: string; // application/pdf | image/png | image/jpeg
  base64: string;
}

export interface CallLlmArgs<T> {
  agent: AgentName;
  stage: string;
  promptId: string;
  promptVersion?: number;
  vars?: Record<string, unknown>;
  schema?: z.ZodType<T>;
  schemaName?: string;
  documents?: DocBlock[];
  /** large static context (e.g. the ruleset) appended to the system prompt and cached. */
  cacheableContext?: string;
  hints?: RouteHints;
  modelOverride?: ModelId;
  maxTokens?: number;
  link?: { authorityRequestId?: string; partnerId?: string; documentId?: string; pipelineRunId?: string };
}

export interface LlmResult<T> {
  data: T;
  text: string;
  model: ModelId;
  promptVersion: string;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };
  latencyMs: number;
  confidence?: number;
  costMicroUsd: number;
  aiCallId: string;
}

function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  const js = z.toJSONSchema(schema, { target: "draft-2020-12" }) as Record<string, unknown>;
  delete js["$schema"];
  return js;
}

function extractConfidence(data: unknown): number | undefined {
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (typeof o.confidence === "number") return o.confidence;
    if (typeof o.overallConfidence === "number") return o.overallConfidence;
  }
  return undefined;
}

const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 529]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function callLlm<T = string>(args: CallLlmArgs<T>): Promise<LlmResult<T>> {
  const prompt = getPrompt(args.promptId, args.promptVersion);
  const model = routeModel(args.agent, args.hints, args.modelOverride);
  const tier = (Object.keys(MODEL_BY_TIER) as Array<keyof typeof MODEL_BY_TIER>).find((t) => MODEL_BY_TIER[t] === model) ?? "balanced";
  const maxTokens = args.maxTokens ?? 4096;

  const systemText = args.cacheableContext
    ? `${prompt.system}\n\n--- MARKET RULESET CONTEXT ---\n${args.cacheableContext}`
    : prompt.system;
  const userText = renderTemplate(prompt.user, args.vars ?? {});

  const userContent: Anthropic.ContentBlockParam[] = [];
  for (const d of args.documents ?? []) {
    if (d.mediaType === "application/pdf") {
      userContent.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: d.base64 } });
    } else {
      userContent.push({
        type: "image",
        source: { type: "base64", media_type: d.mediaType as "image/png" | "image/jpeg", data: d.base64 },
      });
    }
  }
  userContent.push({ type: "text", text: userText });

  const toolName = args.schemaName ?? "emit_result";
  const tools = args.schema
    ? [{ name: toolName, description: "Return the structured result.", input_schema: jsonSchemaFor(args.schema) as Anthropic.Tool.InputSchema }]
    : undefined;

  const requestHash = crypto
    .createHash("sha256")
    .update(model + systemText + userText)
    .digest("hex")
    .slice(0, 32);

  const start = Date.now();
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await client().messages.create(
        {
          model,
          max_tokens: maxTokens,
          system: [{ type: "text", text: systemText, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: userContent }],
          ...(tools ? { tools, tool_choice: { type: "tool" as const, name: toolName } } : {}),
        },
        { timeout: TIER_TIMEOUT_MS[tier] },
      );

      const latencyMs = Date.now() - start;
      const usage = {
        inputTokens: res.usage.input_tokens ?? 0,
        outputTokens: res.usage.output_tokens ?? 0,
        cacheReadTokens: res.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: res.usage.cache_creation_input_tokens ?? 0,
      };
      const costMicroUsd = computeCostMicroUsd(model, usage);

      let data: T;
      let text = "";
      if (args.schema) {
        const toolBlock = res.content.find((b) => b.type === "tool_use");
        if (!toolBlock || toolBlock.type !== "tool_use") throw new Error("Model did not return the structured tool output.");
        data = args.schema.parse(toolBlock.input);
        text = JSON.stringify(data);
      } else {
        text = res.content.filter((b) => b.type === "text").map((b) => (b as Anthropic.TextBlock).text).join("\n");
        data = text as unknown as T;
      }
      const confidence = extractConfidence(data);

      const log = await db.aiCallLog.create({
        data: {
          authorityRequestId: args.link?.authorityRequestId,
          partnerId: args.link?.partnerId,
          documentId: args.link?.documentId,
          pipelineRunId: args.link?.pipelineRunId,
          agent: args.agent,
          stage: args.stage,
          model,
          promptId: prompt.id,
          promptVersion: `v${prompt.version}`,
          tokensIn: usage.inputTokens,
          tokensOut: usage.outputTokens,
          cacheReadTokens: usage.cacheReadTokens,
          cacheWriteTokens: usage.cacheWriteTokens,
          latencyMs,
          costMicroUsd,
          confidence,
          requestHash,
          ok: true,
        },
      });

      return { data, text, model, promptVersion: `v${prompt.version}`, usage, latencyMs, confidence, costMicroUsd, aiCallId: log.id };
    } catch (err) {
      lastErr = err;
      const status = err instanceof Anthropic.APIError ? err.status : undefined;
      const retryable = status === undefined || RETRYABLE.has(status);
      if (attempt < 3 && retryable) {
        await sleep(800 * Math.pow(2, attempt) + Math.floor(Math.random() * 400));
        continue;
      }
      break;
    }
  }

  // terminal failure — record it
  await db.aiCallLog
    .create({
      data: {
        authorityRequestId: args.link?.authorityRequestId,
        partnerId: args.link?.partnerId,
        documentId: args.link?.documentId,
        pipelineRunId: args.link?.pipelineRunId,
        agent: args.agent,
        stage: args.stage,
        model,
        promptId: prompt.id,
        promptVersion: `v${prompt.version}`,
        tokensIn: 0,
        tokensOut: 0,
        latencyMs: Date.now() - start,
        costMicroUsd: 0,
        requestHash,
        ok: false,
        errorText: lastErr instanceof Error ? lastErr.message : String(lastErr),
      },
    })
    .catch(() => {});
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
