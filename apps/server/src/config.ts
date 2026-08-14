import dotenv from "dotenv";
import { resolve } from "node:path";
import type { ServerConfig } from "./app.js";

// Configuration is loaded by the server entrypoint only. The client receives no
// GEMINI_* values because Vite only exposes variables prefixed with VITE_.
dotenv.config({ path: resolve(process.cwd(), ".env") });
dotenv.config({ path: resolve(process.cwd(), "../../.env") });

const DEFAULT_ANSWER_MODEL = "gemini-2.5-flash";
const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001";

export function loadServerConfig(environment: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: parsePort(environment.PORT),
    clientOrigin: environment.CLIENT_ORIGIN?.trim() || "http://localhost:5173",
    geminiApiKey: optionalValue(environment.GEMINI_API_KEY),
    answerModel: environment.GEMINI_ANSWER_MODEL?.trim() || DEFAULT_ANSWER_MODEL,
    embeddingModel: environment.GEMINI_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL,
  };
}

function parsePort(value: string | undefined): number {
  const port = value === undefined ? 3001 : Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return port;
}

function optionalValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}
