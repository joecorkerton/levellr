export interface QueryNotReadyResponse {
  status: "not_ready";
  code: "QUERY_NOT_READY";
  message: string;
}

export interface QueryErrorResponse {
  status: "error";
  code: string;
  message: string;
}

export type QueryResponse = QueryNotReadyResponse | QueryErrorResponse;

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
    (candidate.status === "not_ready" || candidate.status === "error") &&
    typeof candidate.code === "string" &&
    typeof candidate.message === "string"
  );
}
