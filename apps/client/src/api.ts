export interface CommunityAuthor { id: string; name: string }
export interface CommunityMessage { id: string; community_id: string; channel: string; author: CommunityAuthor; timestamp: string; text: string; reactions: { emoji: string; count: number }[]; reply_to: string | null }
export interface QueryMetadata { originalQuery: string; searchQuery: string; intent: "excitement" | "frustration" | "mixed" | "unknown"; dateWindow: { days: number; start: string; end: string } | null }
export interface ViewerTurn { id: string; rootId: string; author: CommunityAuthor; channel: string; timestamp: string; reply_to: string | null; role: "evidence" | "context" | "not_sent_to_synthesis"; excerpt: string; text: string }
export interface ConversationViewer { rootId: string; turns: ViewerTurn[] }
export interface Citation { id: string; rootId: string; author: CommunityAuthor; channel: string; timestamp: string; excerpt: string }
export interface Finding { theme: string; stance: "positive" | "negative" | "mixed" | "neutral"; rationale: string; supportingCitations: Citation[]; rebuttingCitations: Citation[] }
export interface Conversation { rootId: string; evidence: { id: string; rootId: string; author: CommunityAuthor; channel: string; timestamp: string; reply_to: string | null; role: "evidence" | "context"; excerpt: string }[]; context: { id: string; rootId: string; author: CommunityAuthor; channel: string; timestamp: string; reply_to: string | null; role: "evidence" | "context"; excerpt: string }[]; omittedOlderAncestorCount: number }
export interface QueryReadyResponse { status: "ready"; retrievalMode: "bm25"; parsedQuery: QueryMetadata; findings: Finding[]; viewer: ConversationViewer[] }
export interface QueryInsufficientResponse { status: "insufficient_evidence"; message: string; retrievalMode: "bm25"; parsedQuery: QueryMetadata; conversations: Conversation[]; viewer: ConversationViewer[]; inspectableCandidates: CommunityMessage[] }
export type FailureStatus = "llm_unavailable" | "llm_quota_exhausted" | "invalid_model_output";
export interface QueryFailureResponse { status: FailureStatus; message: string; retrievalMode: "bm25"; parsedQuery: QueryMetadata; conversations: Conversation[]; viewer: ConversationViewer[] }
export interface QueryErrorResponse { status: "error"; code: "INVALID_QUERY"; message: string }
export type QueryResponse = QueryReadyResponse | QueryInsufficientResponse | QueryFailureResponse | QueryErrorResponse;

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export async function submitManagerQuery(query: string): Promise<QueryResponse> {
  const response = await fetch(`${apiBaseUrl}/api/query`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query }) });
  const payload: unknown = await response.json();
  if (!isQueryResponse(payload)) throw new Error("The API returned an unexpected response.");
  if (!response.ok) throw new Error(payload.status === "error" ? payload.message : "The API request failed.");
  return payload;
}

function isQueryResponse(value: unknown): value is QueryResponse {
  if (!record(value)) return false;
  if (value.status === "error") return value.code === "INVALID_QUERY" && typeof value.message === "string";
  if (value.status === "ready") return value.retrievalMode === "bm25" && queryMetadata(value.parsedQuery) && findings(value.findings) && viewer(value.viewer);
  if (value.status === "insufficient_evidence") return common(value) && messages(value.inspectableCandidates) && conversations(value.conversations);
  return (value.status === "llm_unavailable" || value.status === "llm_quota_exhausted" || value.status === "invalid_model_output") && common(value);
}
function common(value: Record<string, any>): boolean { return typeof value.message === "string" && value.retrievalMode === "bm25" && queryMetadata(value.parsedQuery) && conversations(value.conversations) && viewer(value.viewer); }
function queryMetadata(value: unknown): value is QueryMetadata { return record(value) && typeof value.originalQuery === "string" && typeof value.searchQuery === "string" && ["excitement", "frustration", "mixed", "unknown"].includes(value.intent) && (value.dateWindow === null || record(value.dateWindow) && typeof value.dateWindow.days === "number" && typeof value.dateWindow.start === "string" && typeof value.dateWindow.end === "string"); }
function viewer(value: unknown): boolean { return Array.isArray(value) && value.every((item) => record(item) && typeof item.rootId === "string" && Array.isArray(item.turns) && item.turns.every(turn)); }
function conversations(value: unknown): boolean { return Array.isArray(value) && value.every((item) => record(item) && typeof item.rootId === "string" && Array.isArray(item.evidence) && Array.isArray(item.context) && typeof item.omittedOlderAncestorCount === "number"); }
function findings(value: unknown): boolean { return Array.isArray(value) && value.length > 0 && value.every((item) => record(item) && typeof item.theme === "string" && ["positive", "negative", "mixed", "neutral"].includes(item.stance) && typeof item.rationale === "string" && citations(item.supportingCitations) && citations(item.rebuttingCitations)); }
function citations(value: unknown): boolean { return Array.isArray(value) && value.every((item) => record(item) && typeof item.id === "string" && typeof item.rootId === "string" && record(item.author) && typeof item.author.name === "string" && typeof item.channel === "string" && typeof item.timestamp === "string" && typeof item.excerpt === "string"); }
function messages(value: unknown): boolean { return Array.isArray(value) && value.every((item) => record(item) && typeof item.id === "string" && typeof item.text === "string" && record(item.author) && typeof item.channel === "string" && typeof item.timestamp === "string"); }
function turn(value: unknown): value is Record<string, any> { return record(value) && typeof value.id === "string" && typeof value.rootId === "string" && record(value.author) && typeof value.author.name === "string" && typeof value.text === "string" && ["evidence", "context", "not_sent_to_synthesis"].includes(value.role); }
function record(value: unknown): value is Record<string, any> { return typeof value === "object" && value !== null && !Array.isArray(value); }
