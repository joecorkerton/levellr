import express, { type Express, type Request, type Response } from "express";
import {
  createBM25Index,
  loadCommunityMessagesSync,
  type BM25Candidate,
  type BM25Index,
  type BM25Intent,
  type SentimentTimeWindow,
} from "./retrieval/bm25.js";

export interface ServerConfig {
  port: number;
  clientOrigin: string;
  /** Kept server-side for the future synthesis integration. */
  geminiApiKey?: string;
  answerModel: string;
  embeddingModel: string;
}

export interface HealthResponse {
  status: "ok";
  service: "community-pulse-api";
  queryStatus: "retrieval_ready";
}

export interface QueryRequest {
  query: string;
}

interface QueryMetadata {
  originalQuery: string;
  searchQuery: string;
  intent: BM25Intent;
  dateWindow: SentimentTimeWindow | null;
}

export interface QueryRetrievalResponse {
  status: "retrieved";
  code: "RETRIEVAL_READY";
  retrievalMode: "bm25";
  message: "Candidate retrieval is ready; no grounded answer has been synthesized.";
  query: QueryMetadata;
  candidates: BM25Candidate[];
}

export interface QueryEmptyResponse {
  status: "empty";
  code: "NO_RESULTS";
  retrievalMode: "bm25";
  message: "No Community message candidates matched this query and time window.";
  query: QueryMetadata;
  candidates: [];
}

export interface InvalidQueryResponse {
  status: "error";
  code: "INVALID_QUERY";
  message: string;
}

export type QueryResponse = QueryRetrievalResponse | QueryEmptyResponse | InvalidQueryResponse;

export interface AppDependencies {
  retrievalIndex?: BM25Index;
}

export function createApp(config: ServerConfig, dependencies: AppDependencies = {}): Express {
  const retrievalIndex =
    dependencies.retrievalIndex ?? createBM25Index(loadCommunityMessagesSync());
  const app = express();

  app.use((request, response, next) => {
    response.setHeader("Access-Control-Allow-Origin", config.clientOrigin);
    response.setHeader("Access-Control-Allow-Headers", "content-type");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

    if (request.method === "OPTIONS") {
      response.sendStatus(204);
      return;
    }

    next();
  });
  app.use(express.json({ limit: "16kb" }));

  app.get("/api/health", (_request: Request, response: Response<HealthResponse>) => {
    response.json({
      status: "ok",
      service: "community-pulse-api",
      queryStatus: "retrieval_ready",
    });
  });

  app.post(
    "/api/query",
    (request: Request<unknown, QueryResponse, Partial<QueryRequest>>, response: Response<QueryResponse>) => {
      if (typeof request.body?.query !== "string" || request.body.query.trim().length === 0) {
        response.status(400).json({
          status: "error",
          code: "INVALID_QUERY",
          message: "Enter a manager query before asking Community Pulse.",
        });
        return;
      }

      const result = retrievalIndex.search(request.body.query.trim());
      const query = {
        originalQuery: result.parsedQuery.originalQuery,
        searchQuery: result.parsedQuery.searchQuery,
        intent: result.parsedQuery.intent,
        dateWindow: result.parsedQuery.dateWindow,
      } satisfies QueryMetadata;

      if (result.candidates.length === 0) {
        response.json({
          status: "empty",
          code: "NO_RESULTS",
          retrievalMode: "bm25",
          message: "No Community message candidates matched this query and time window.",
          query,
          candidates: [],
        });
        return;
      }

      response.json({
        status: "retrieved",
        code: "RETRIEVAL_READY",
        retrievalMode: "bm25",
        message: "Candidate retrieval is ready; no grounded answer has been synthesized.",
        query,
        candidates: result.candidates,
      });
    },
  );

  return app;
}
