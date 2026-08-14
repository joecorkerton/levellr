import express, { type Express, type Request, type Response } from "express";

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
  queryStatus: "not_ready";
}

export interface QueryRequest {
  query: string;
}

export interface QueryNotReadyResponse {
  status: "not_ready";
  code: "QUERY_NOT_READY";
  message: string;
}

export interface InvalidQueryResponse {
  status: "error";
  code: "INVALID_QUERY";
  message: string;
}

export type QueryResponse = QueryNotReadyResponse | InvalidQueryResponse;

const notReadyResponse: QueryNotReadyResponse = {
  status: "not_ready",
  code: "QUERY_NOT_READY",
  message:
    "Community Pulse answers are not connected yet. Retrieval and grounded synthesis will be added next.",
};

export function createApp(config: ServerConfig): Express {
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
      queryStatus: "not_ready",
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

      // Deliberately do not call a model or imply that this scaffold has analyzed messages.
      response.json(notReadyResponse);
    },
  );

  return app;
}
