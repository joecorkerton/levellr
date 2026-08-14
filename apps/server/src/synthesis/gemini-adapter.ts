import { GoogleGenAI, Type } from "@google/genai";
import type {
  ConversationEvidencePack,
  InsufficientEvidence,
  ConversationViewer,
  SerializedConversation,
  SerializedTurn,
} from "../retrieval/conversation-pack.js";
import type { ParsedManagerQuery } from "../retrieval/bm25.js";

export const DEFAULT_ANSWER_MODEL = "gemini-2.5-flash-lite";

export type Stance = "positive" | "negative" | "mixed" | "neutral";

export interface Citation {
  id: string;
  rootId: string;
  author: { id: string; name: string };
  channel: string;
  timestamp: string;
  excerpt: string;
}

export interface ThemeFinding {
  theme: string;
  stance: Stance;
  rationale: string;
  supportingCitations: Citation[];
  rebuttingCitations: Citation[];
}

export interface SentimentPulseDraft {
  status: "ready";
  retrievalMode: ConversationEvidencePack["retrievalMode"];
  parsedQuery: ParsedManagerQuery;
  findings: ThemeFinding[];
  viewer: ConversationViewer[];
}

export type SynthesisFailureCode = "llm_unavailable" | "llm_quota_exhausted" | "invalid_model_output";

export interface SynthesisFailure {
  status: SynthesisFailureCode;
  message: string;
  retrievalMode: ConversationEvidencePack["retrievalMode"];
  parsedQuery: ParsedManagerQuery;
  conversations: SerializedConversation[];
  viewer: ConversationViewer[];
}

export interface InsufficientEvidenceResult {
  status: "insufficient_evidence";
  retrievalMode: ConversationEvidencePack["retrievalMode"];
  parsedQuery: ParsedManagerQuery;
  conversations: SerializedConversation[];
  viewer: ConversationViewer[];
  inspectableCandidates: InsufficientEvidence["inspectableCandidates"];
}

export type SynthesisResult = SentimentPulseDraft | SynthesisFailure | InsufficientEvidenceResult;

export interface GenerateContentRequest {
  model: string;
  contents: string;
  config: {
    responseMimeType: "application/json";
    responseSchema: typeof GEMINI_RESPONSE_SCHEMA;
  };
}

export interface GeminiModelClient {
  generateContent(request: GenerateContentRequest): Promise<{ text?: string }>;
}

export interface SynthesisInput {
  managerQuery: string;
  evidencePack: ConversationEvidencePack | InsufficientEvidence;
}

export interface GeminiAdapterOptions {
  apiKey?: string;
  model?: string;
  client?: GeminiModelClient;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
}

export const GEMINI_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    findings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          theme: { type: Type.STRING },
          stance: { type: Type.STRING, enum: ["positive", "negative", "mixed", "neutral"] },
          rationale: { type: Type.STRING },
          supportingCitations: { type: Type.ARRAY, items: citationReferenceSchema() },
          rebuttingCitations: { type: Type.ARRAY, items: citationReferenceSchema() },
        },
        required: ["theme", "stance", "rationale", "supportingCitations", "rebuttingCitations"],
      },
    },
  },
  required: ["findings"],
} as const;

interface CitationReference { id: string; rootId: string }

export function createGeminiModelClient(apiKey: string): GeminiModelClient {
  const ai = new GoogleGenAI({ apiKey });
  return {
    async generateContent(request) {
      const response = await ai.models.generateContent(request);
      return { text: response.text };
    },
  };
}

export async function synthesizeSentimentPulse(input: SynthesisInput, options: GeminiAdapterOptions = {}): Promise<SynthesisResult> {
  if (input.evidencePack.status === "insufficient_evidence") {
    return { status: "insufficient_evidence", retrievalMode: input.evidencePack.retrievalMode, parsedQuery: input.evidencePack.parsedQuery, conversations: input.evidencePack.conversations, viewer: input.evidencePack.viewer, inspectableCandidates: input.evidencePack.inspectableCandidates };
  }
  const base = safeBase(input.evidencePack);
  if (!options.client && !options.apiKey?.trim()) {
    return failure("llm_unavailable", "Gemini is unavailable because GEMINI_API_KEY is not configured.", base);
  }

  const client = options.client ?? createGeminiModelClient(options.apiKey!.trim());
  const request: GenerateContentRequest = {
    model: options.model?.trim() || DEFAULT_ANSWER_MODEL,
    contents: buildPrompt(input.managerQuery, input.evidencePack),
    config: { responseMimeType: "application/json", responseSchema: GEMINI_RESPONSE_SCHEMA },
  };
  const deadline = (options.now ?? Date.now)() + 10_000;
  let response: { text?: string } | undefined;
  let attempt = 0;
  while (attempt < 2) {
    try {
      response = await withDeadline(client.generateContent(request), deadline, options.now ?? Date.now);
      break;
    } catch (error) {
      if (isQuotaError(error)) return failure("llm_quota_exhausted", "Gemini quota is temporarily unavailable.", base);
      if (isAuthError(error) || !isTransientError(error) || attempt === 1 || (options.now ?? Date.now)() >= deadline) {
        return failure("llm_unavailable", "Gemini is temporarily unavailable.", base);
      }
      attempt += 1;
      await (options.sleep ?? defaultSleep)(250);
    }
  }

  const parsed = parseModelOutput(response?.text);
  if (!parsed) return failure("invalid_model_output", "Gemini returned an invalid grounded answer.", base);
  const findings = validateAndHydrateFindings(parsed, input.evidencePack.conversations);
  if (!findings) return failure("invalid_model_output", "Gemini returned citations or claims outside the grounded answer contract.", base);
  return { status: "ready", retrievalMode: input.evidencePack.retrievalMode, parsedQuery: input.evidencePack.parsedQuery, findings, viewer: input.evidencePack.viewer };
}

function citationReferenceSchema() {
  return { type: Type.OBJECT, properties: { id: { type: Type.STRING }, rootId: { type: Type.STRING } }, required: ["id", "rootId"] };
}

function safeBase(pack: ConversationEvidencePack) {
  return { retrievalMode: pack.retrievalMode, parsedQuery: pack.parsedQuery, conversations: pack.conversations, viewer: pack.viewer };
}
function failure(status: SynthesisFailureCode, message: string, base: ReturnType<typeof safeBase>): SynthesisFailure { return { status, message, ...base }; }

function buildPrompt(managerQuery: string, pack: ConversationEvidencePack): string {
  const material = pack.conversations.map(({ rootId, evidence, context, omittedOlderAncestorCount }) => ({ rootId, evidence, context, omittedOlderAncestorCount }));
  return [
    "You are the grounded Community Pulse synthesizer.",
    "Return JSON matching the supplied response schema, with qualitative theme findings only.",
    "Use only the supplied in-window evidence. Only evidence ids may be cited; context is non-citable.",
    "Retain material disagreement with mixed stance and rebutting citations. A Conversation may contribute once per theme.",
    "Do not claim percentages, global sentiment, majority views, or raw message counts. Do not make recommendations.",
    JSON.stringify({ managerQuery, request: { intent: pack.parsedQuery.intent, dateWindow: pack.parsedQuery.dateWindow }, evidence: material }),
  ].join("\n");
}

function parseModelOutput(text: string | undefined): unknown {
  if (!text?.trim()) return undefined;
  try { return JSON.parse(text); } catch { return undefined; }
}

function validateAndHydrateFindings(value: unknown, conversations: readonly SerializedConversation[]): ThemeFinding[] | undefined {
  if (!isRecord(value) || !Array.isArray(value.findings) || value.findings.length === 0) return undefined;
  const evidence = new Map<string, SerializedTurn>();
  for (const conversation of conversations) for (const turn of conversation.evidence) evidence.set(turn.id, turn);
  const themes = new Set<string>();
  const findings: ThemeFinding[] = [];
  for (const raw of value.findings) {
    if (!isRecord(raw) || typeof raw.theme !== "string" || !raw.theme.trim() || themes.has(raw.theme.trim().toLocaleLowerCase()) || !isStance(raw.stance) || typeof raw.rationale !== "string" || !raw.rationale.trim() || containsForbiddenClaim(`${raw.theme} ${raw.rationale}`)) return undefined;
    const supporting = hydrateCitations(raw.supportingCitations, evidence);
    const rebutting = hydrateCitations(raw.rebuttingCitations, evidence);
    if (!supporting || !rebutting || supporting.length < 1 || supporting.length > 2 || rebutting.length > 2) return undefined;
    const roots = new Set([...supporting, ...rebutting].map((citation) => citation.rootId));
    if (roots.size !== supporting.length + rebutting.length || (raw.stance === "mixed" && rebutting.length === 0)) return undefined;
    themes.add(raw.theme.trim().toLocaleLowerCase());
    findings.push({ theme: raw.theme.trim(), stance: raw.stance, rationale: raw.rationale.trim(), supportingCitations: supporting, rebuttingCitations: rebutting });
  }
  return findings;
}

function hydrateCitations(value: unknown, evidence: Map<string, SerializedTurn>): Citation[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = new Set<string>();
  const result: Citation[] = [];
  for (const raw of value) {
    if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.rootId !== "string" || ids.has(raw.id)) return undefined;
    const turn = evidence.get(raw.id);
    if (!turn || turn.rootId !== raw.rootId) return undefined;
    ids.add(raw.id);
    result.push({ id: turn.id, rootId: turn.rootId, author: turn.author, channel: turn.channel, timestamp: turn.timestamp, excerpt: turn.excerpt });
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, any> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function isStance(value: unknown): value is Stance { return value === "positive" || value === "negative" || value === "mixed" || value === "neutral"; }
function containsForbiddenClaim(value: string): boolean { return /%|percentage|global sentiment|raw message counts?|message counts?|\bmajority\b|\bminority\b/i.test(value); }
function isAuthError(error: unknown): boolean { return errorStatus(error) === 401 || errorStatus(error) === 403; }
function isQuotaError(error: unknown): boolean { return errorStatus(error) === 429 || /\b429\b|quota|rate.?limit|resource exhausted/i.test(errorMessage(error)); }
function isTransientError(error: unknown): boolean { const status = errorStatus(error); return status === undefined || status >= 500 || /timeout|network|fetch failed|temporar/i.test(errorMessage(error)); }
function errorStatus(error: unknown): number | undefined { if (!isRecord(error)) return undefined; const status = error.status ?? error.code; return typeof status === "number" ? status : undefined; }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
async function withDeadline<T>(promise: Promise<T>, deadline: number, now: () => number): Promise<T> {
  const remaining = deadline - now();
  if (remaining <= 0) throw new Error("request deadline exceeded");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error("request timeout")), remaining); })]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
function defaultSleep(milliseconds: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
