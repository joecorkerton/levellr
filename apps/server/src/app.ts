import express, { type Express, type Request, type Response } from "express";
import {
  createBM25Index,
  loadCommunityMessagesSync,
  type BM25Index,
  type CommunityMessage,
} from "./retrieval/bm25.js";
import {
  prepareConversationEvidencePack,
  type ConversationViewer,
  type SerializedConversation,
} from "./retrieval/conversation-pack.js";
import {
  synthesizeSentimentPulse,
  type SentimentPulseDraft,
  type SynthesisFailure,
  type SynthesisResult,
} from "./synthesis/gemini-adapter.js";

export interface ServerConfig {
  port: number;
  clientOrigin: string;
  geminiApiKey?: string;
  answerModel: string;
  embeddingModel: string;
}

export interface HealthResponse {
  status: "ok";
  service: "community-pulse-api";
  queryStatus: "grounded_answer_ready";
}

export interface QueryRequest { query: string }

export interface QueryMetadata {
  originalQuery: string;
  searchQuery: string;
  intent: "excitement" | "frustration" | "mixed" | "unknown";
  dateWindow: { days: number; start: string; end: string } | null;
}

export interface QuerySuccessResponse extends Omit<SentimentPulseDraft, "retrievalMode"> {
  status: "ready";
  retrievalMode: "bm25";
}

export interface QueryInsufficientEvidenceResponse {
  status: "insufficient_evidence";
  message: string;
  retrievalMode: "bm25";
  parsedQuery: QueryMetadata;
  conversations: SerializedConversation[];
  viewer: ConversationViewer[];
  inspectableCandidates: CommunityMessage[];
}

export interface QuerySynthesisFailureResponse extends SynthesisFailure {}

export interface InvalidQueryResponse {
  status: "error";
  code: "INVALID_QUERY";
  message: string;
}

export type QueryResponse =
  | QuerySuccessResponse
  | QueryInsufficientEvidenceResponse
  | QuerySynthesisFailureResponse
  | InvalidQueryResponse;

export type Synthesize = typeof synthesizeSentimentPulse;

export interface AppDependencies {
  retrievalIndex?: BM25Index;
  messages?: readonly CommunityMessage[];
  synthesize?: Synthesize;
}

export function createApp(config: ServerConfig, dependencies: AppDependencies = {}): Express {
  const messages = dependencies.messages ?? loadCommunityMessagesSync();
  const retrievalIndex = dependencies.retrievalIndex ?? createBM25Index(messages);
  const synthesize = dependencies.synthesize ?? synthesizeSentimentPulse;
  const app = express();

  app.use((request, response, next) => {
    response.setHeader("Access-Control-Allow-Origin", config.clientOrigin);
    response.setHeader("Access-Control-Allow-Headers", "content-type");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (request.method === "OPTIONS") { response.sendStatus(204); return; }
    next();
  });
  app.use(express.json({ limit: "16kb" }));

  app.get("/api/health", (_request: Request, response: Response<HealthResponse>) => {
    response.json({ status: "ok", service: "community-pulse-api", queryStatus: "grounded_answer_ready" });
  });

  app.post(
    "/api/query",
    async (request: Request<unknown, QueryResponse, Partial<QueryRequest>>, response: Response<QueryResponse>) => {
      if (typeof request.body?.query !== "string" || request.body.query.trim().length === 0) {
        response.status(400).json({ status: "error", code: "INVALID_QUERY", message: "Enter a manager query before asking Community Pulse." });
        return;
      }

      const managerQuery = request.body.query.trim();
      const retrieval = retrievalIndex.search(managerQuery);
      const evidencePack = prepareConversationEvidencePack({
        retrievalMode: "bm25",
        parsedQuery: retrieval.parsedQuery,
        candidates: retrieval.candidates,
        messages,
      });
      if (evidencePack.status === "insufficient_evidence") {
        response.json(toQueryResponse(evidencePack));
        return;
      }

      const result: SynthesisResult = await synthesize(
        { managerQuery, evidencePack },
        { apiKey: config.geminiApiKey, model: config.answerModel },
      );

      response.json(toQueryResponse(result));
    },
  );

  return app;
}

function toQueryResponse(result: SynthesisResult): QueryResponse {
  if (result.status === "insufficient_evidence") {
    return {
      status: "insufficient_evidence",
      message: "There is not enough distinct Conversation evidence to produce a grounded Sentiment pulse.",
      retrievalMode: "bm25",
      parsedQuery: result.parsedQuery,
      conversations: result.conversations,
      viewer: result.viewer,
      inspectableCandidates: result.inspectableCandidates.map((message) => safeMessage(message)),
    };
  }
  if (result.status === "ready") {
    return {
      status: "ready",
      retrievalMode: "bm25",
      parsedQuery: result.parsedQuery,
      findings: result.findings,
      viewer: result.viewer,
    };
  }
  return {
    status: result.status,
    message: result.message,
    retrievalMode: "bm25",
    parsedQuery: result.parsedQuery,
    conversations: result.conversations,
    viewer: result.viewer,
  };
}

function safeMessage(message: CommunityMessage): CommunityMessage {
  return {
    id: message.id,
    community_id: message.community_id,
    channel: message.channel,
    author: message.author,
    timestamp: message.timestamp,
    text: message.text,
    reactions: message.reactions,
    reply_to: message.reply_to,
  };
}
