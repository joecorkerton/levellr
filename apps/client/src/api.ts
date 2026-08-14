export interface CommunityAuthor {
  id: string;
  name: string;
}

export interface CommunityReaction {
  emoji: string;
  count: number;
}

export interface CommunityMessage {
  id: string;
  community_id: string;
  channel: string;
  author: CommunityAuthor;
  timestamp: string;
  text: string;
  reactions: CommunityReaction[];
  reply_to: string | null;
}

export interface QueryCandidate {
  rank: number;
  score: number;
  source: CommunityMessage;
}

export interface QueryMetadata {
  originalQuery: string;
  searchQuery: string;
  intent: "excitement" | "frustration" | "mixed" | "unknown";
  dateWindow: { days: number; start: string; end: string } | null;
}

export interface QueryRetrievalResponse {
  status: "retrieved";
  code: "RETRIEVAL_READY";
  retrievalMode: "bm25";
  message: string;
  query: QueryMetadata;
  candidates: QueryCandidate[];
}

export interface QueryEmptyResponse {
  status: "empty";
  code: "NO_RESULTS";
  retrievalMode: "bm25";
  message: string;
  query: QueryMetadata;
  candidates: [];
}

export interface QueryErrorResponse {
  status: "error";
  code: string;
  message: string;
}

export type QueryResponse = QueryRetrievalResponse | QueryEmptyResponse | QueryErrorResponse;

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export async function submitManagerQuery(query: string): Promise<QueryResponse> {
  const response = await fetch(`${apiBaseUrl}/api/query`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });

  const payload: unknown = await response.json();

  if (!isQueryResponse(payload)) {
    throw new Error("The API returned an unexpected response.");
  }

  if (!response.ok) {
    throw new Error(payload.message);
  }

  return payload;
}

function isQueryResponse(payload: unknown): payload is QueryResponse {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const candidate = payload as Partial<QueryResponse>;
  return (
    (candidate.status === "retrieved" || candidate.status === "empty" || candidate.status === "error") &&
    typeof candidate.code === "string" &&
    typeof candidate.message === "string"
  );
}
