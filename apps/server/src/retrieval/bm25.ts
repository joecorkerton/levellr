import { access, readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BM25_LEXICON_V1, type BM25Intent } from "./lexicon.js";
import { normalizeBM25Text, tokenizeBM25Text } from "./normalization.js";

export { normalizeBM25Text, tokenizeBM25Text } from "./normalization.js";
export type { BM25Intent } from "./lexicon.js";

export const BM25_K1 = 1.2;
export const BM25_B = 0.75;
export const BM25_RESULT_LIMIT = 20;

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

export interface SentimentTimeWindow {
  days: number;
  start: string;
  end: string;
}

export interface ParsedManagerQuery {
  originalQuery: string;
  searchQuery: string;
  intent: BM25Intent;
  dateWindow: SentimentTimeWindow | null;
}

export interface BM25Candidate {
  rank: number;
  score: number;
  source: CommunityMessage;
}

export interface BM25SearchResult {
  parsedQuery: ParsedManagerQuery;
  candidates: BM25Candidate[];
}

interface IndexedMessage {
  source: CommunityMessage;
  timestampMs: number;
  allTokens: string[];
  terms: string[];
  termFrequency: Map<string, number>;
}

export interface BM25Index {
  readonly latestTimestamp: string;
  readonly size: number;
  search(query: string): BM25SearchResult;
}

const DATE_PHRASE = /\blast\s+(\d+)\s+days?\b/iu;

export async function loadCommunityMessages(filePath?: string): Promise<CommunityMessage[]> {
  const contents = await readFile(filePath ?? (await resolveMessagesPath()), "utf8");
  return parseCommunityMessages(contents);
}

export function loadCommunityMessagesSync(filePath?: string): CommunityMessage[] {
  const contents = readFileSync(filePath ?? defaultMessagesPath(), "utf8");
  return parseCommunityMessages(contents);
}

function parseCommunityMessages(contents: string): CommunityMessage[] {
  const parsed: unknown = JSON.parse(contents);

  if (!Array.isArray(parsed)) {
    throw new Error("messages.json must contain an array of Community messages");
  }

  return parsed.map(parseCommunityMessage);
}

export function createBM25Index(messages: readonly CommunityMessage[]): BM25Index {
  const indexedMessages = messages.map(indexMessage).sort(compareTimestampDescending);

  if (indexedMessages.length === 0) {
    throw new Error("Cannot build a BM25 index without Community messages");
  }

  const latestMessage = indexedMessages[0];

  return {
    latestTimestamp: latestMessage.source.timestamp,
    size: indexedMessages.length,
    search(query: string): BM25SearchResult {
      const parsedQuery = parseManagerQuery(query, latestMessage.source.timestamp);
      return {
        parsedQuery,
        candidates: rankCandidates(indexedMessages, parsedQuery),
      };
    },
  };
}

export function parseManagerQuery(query: string, latestTimestamp: string): ParsedManagerQuery {
  const dateMatch = query.match(DATE_PHRASE);
  const searchQuery = normalizeBM25Text(query.replace(DATE_PHRASE, " "));
  const latestTimestampMs = parseTimestamp(latestTimestamp, "latest dataset timestamp");

  let dateWindow: SentimentTimeWindow | null = null;
  if (dateMatch) {
    const days = Number(dateMatch[1]);
    const windowStart = new Date(latestTimestampMs - days * 24 * 60 * 60 * 1000);
    dateWindow = {
      days,
      start: windowStart.toISOString(),
      end: new Date(latestTimestampMs).toISOString(),
    };
  }

  return {
    originalQuery: query,
    searchQuery,
    intent: classifyIntent(searchQuery),
    dateWindow,
  };
}

function rankCandidates(indexedMessages: readonly IndexedMessage[], parsedQuery: ParsedManagerQuery): BM25Candidate[] {
  const queryTokens = tokenizeBM25Text(parsedQuery.searchQuery);
  const stopWords = new Set(BM25_LEXICON_V1.stopWords);
  const queryTerms = [...new Set(queryTokens.filter((token) => !stopWords.has(token)))];

  if (queryTerms.length === 0) {
    return [];
  }

  const windowStartMs = parsedQuery.dateWindow ? Date.parse(parsedQuery.dateWindow.start) : Number.NEGATIVE_INFINITY;
  const windowEndMs = parsedQuery.dateWindow ? Date.parse(parsedQuery.dateWindow.end) : Number.POSITIVE_INFINITY;
  const eligible = indexedMessages.filter(
    (message) => message.timestampMs >= windowStartMs && message.timestampMs <= windowEndMs,
  );

  if (eligible.length === 0) {
    return [];
  }

  const documentFrequency = new Map<string, number>();
  for (const message of eligible) {
    for (const term of new Set(message.terms)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const averageDocumentLength =
    eligible.reduce((total, message) => total + message.terms.length, 0) / eligible.length;
  const intentMarkers = markersForIntent(parsedQuery.intent);
  const descriptiveTermCount = countDescriptiveTerms(queryTokens, stopWords);
  const hasDescriptiveIntent =
    descriptiveTermCount >= 3 && hasAnyMarker(queryTokens, allIntentMarkersForQuery(parsedQuery.searchQuery));
  const queryPhrases = findQueryPhrases(queryTokens, stopWords);

  const ranked = eligible.flatMap((message) => {
    const matchedTermCount = queryTerms.reduce(
      (count, term) => count + (message.termFrequency.has(term) ? 1 : 0),
      0,
    );

    if (matchedTermCount === 0) {
      return [];
    }

    const baseScore = queryTerms.reduce((score, term) => {
      const termFrequency = message.termFrequency.get(term) ?? 0;
      if (termFrequency === 0) {
        return score;
      }

      const documentFrequencyValue = documentFrequency.get(term) ?? 0;
      const inverseDocumentFrequency = Math.log(
        1 + (eligible.length - documentFrequencyValue + 0.5) / (documentFrequencyValue + 0.5),
      );
      const denominator =
        termFrequency + BM25_K1 * (1 - BM25_B + BM25_B * (message.terms.length / averageDocumentLength));
      return score + inverseDocumentFrequency * (termFrequency * (BM25_K1 + 1)) / denominator;
    }, 0);

    const phraseBonus = queryPhrases.some((phrase) => containsPhrase(message.allTokens, phrase)) ? 2 : 0;
    const descriptiveIntentBonus =
      hasDescriptiveIntent && hasAnyMarker(message.allTokens, intentMarkers) ? 0.5 : 0;
    const shortMessageAdjustment = message.allTokens.length <= 2 ? -0.5 : 0;

    return [
      {
        source: message.source,
        score: baseScore + phraseBonus + descriptiveIntentBonus + shortMessageAdjustment,
        timestampMs: message.timestampMs,
      },
    ];
  });

  return ranked
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.timestampMs !== left.timestampMs) return right.timestampMs - left.timestampMs;
      return left.source.id < right.source.id ? -1 : left.source.id > right.source.id ? 1 : 0;
    })
    .slice(0, BM25_RESULT_LIMIT)
    .map((candidate, index) => ({
      rank: index + 1,
      score: candidate.score,
      source: candidate.source,
    }));
}

function indexMessage(source: CommunityMessage): IndexedMessage {
  const allTokens = tokenizeBM25Text(source.text);
  const stopWords = new Set(BM25_LEXICON_V1.stopWords);
  const terms = allTokens.filter((token) => !stopWords.has(token));
  const termFrequency = new Map<string, number>();

  for (const term of terms) {
    termFrequency.set(term, (termFrequency.get(term) ?? 0) + 1);
  }

  return {
    source,
    timestampMs: parseTimestamp(source.timestamp, `message ${source.id}`),
    allTokens,
    terms,
    termFrequency,
  };
}

function classifyIntent(query: string): BM25Intent {
  const tokens = tokenizeBM25Text(query);
  const excitement = hasAnyMarker(tokens, BM25_LEXICON_V1.excitementMarkers);
  const frustration = hasAnyMarker(tokens, BM25_LEXICON_V1.frustrationMarkers);

  if (excitement && frustration) return "mixed";
  if (excitement) return "excitement";
  if (frustration) return "frustration";
  return "unknown";
}

function markersForIntent(intent: BM25Intent): readonly string[] {
  if (intent === "excitement") return BM25_LEXICON_V1.excitementMarkers;
  if (intent === "frustration") return BM25_LEXICON_V1.frustrationMarkers;
  if (intent === "mixed") return [...BM25_LEXICON_V1.excitementMarkers, ...BM25_LEXICON_V1.frustrationMarkers];
  return [];
}

function allIntentMarkersForQuery(query: string): readonly string[] {
  const tokens = tokenizeBM25Text(query);
  return [...BM25_LEXICON_V1.excitementMarkers, ...BM25_LEXICON_V1.frustrationMarkers].filter((marker) =>
    hasAnyMarker(tokens, [marker]),
  );
}

function countDescriptiveTerms(queryTokens: readonly string[], stopWords: ReadonlySet<string>): number {
  const markerTokens = new Set(
    [...BM25_LEXICON_V1.excitementMarkers, ...BM25_LEXICON_V1.frustrationMarkers].flatMap((marker) =>
      tokenizeBM25Text(marker),
    ),
  );
  return new Set(queryTokens.filter((token) => !stopWords.has(token) && !markerTokens.has(token))).size;
}

function findQueryPhrases(queryTokens: readonly string[], stopWords: ReadonlySet<string>): string[][] {
  const phrases: string[][] = [];
  for (let index = 0; index < queryTokens.length - 1; index += 1) {
    if (stopWords.has(queryTokens[index]) || stopWords.has(queryTokens[index + 1])) continue;
    phrases.push([queryTokens[index], queryTokens[index + 1]]);
  }
  return phrases;
}

function hasAnyMarker(tokens: readonly string[], markers: readonly string[]): boolean {
  return markers.some((marker) => {
    const markerTokens = tokenizeBM25Text(marker);
    if (containsPhrase(tokens, markerTokens)) return true;

    // The fixed lexicon contains inflection roots such as "frustrated" and
    // "frustrating"; accept the common noun "frustrations" without adding a
    // fourth runtime lexicon or changing the exported v1 lists.
    return (
      markerTokens.length === 1 &&
      markerTokens[0].startsWith("frustrat") &&
      tokens.some((token) => token.startsWith("frustrat"))
    );
  });
}

function containsPhrase(tokens: readonly string[], phrase: readonly string[]): boolean {
  if (phrase.length === 0 || phrase.length > tokens.length) return false;
  return tokens.some((_, index) => phrase.every((token, offset) => tokens[index + offset] === token));
}

function compareTimestampDescending(left: IndexedMessage, right: IndexedMessage): number {
  if (right.timestampMs !== left.timestampMs) return right.timestampMs - left.timestampMs;
  return left.source.id < right.source.id ? -1 : left.source.id > right.source.id ? 1 : 0;
}

function parseTimestamp(value: string, label: string): number {
  const timestampMs = Date.parse(value);
  if (!Number.isFinite(timestampMs)) {
    throw new Error(`${label} must be a valid ISO timestamp`);
  }
  return timestampMs;
}

function parseCommunityMessage(value: unknown): CommunityMessage {
  if (typeof value !== "object" || value === null) {
    throw new Error("messages.json contains an invalid Community message");
  }

  const message = value as Partial<CommunityMessage>;
  if (
    typeof message.id !== "string" ||
    typeof message.community_id !== "string" ||
    typeof message.channel !== "string" ||
    typeof message.timestamp !== "string" ||
    typeof message.text !== "string" ||
    !message.author ||
    typeof message.author.id !== "string" ||
    typeof message.author.name !== "string" ||
    !Array.isArray(message.reactions) ||
    !message.reactions.every(
      (reaction) =>
        typeof reaction === "object" &&
        reaction !== null &&
        typeof reaction.emoji === "string" &&
        typeof reaction.count === "number",
    ) ||
    (message.reply_to !== null && typeof message.reply_to !== "string")
  ) {
    throw new Error("messages.json contains an invalid Community message");
  }

  parseTimestamp(message.timestamp, `message ${message.id}`);
  return message as CommunityMessage;
}

function defaultMessagesPath(): string {
  const rootPath = resolve(process.cwd(), "messages.json");
  return existsSync(rootPath) ? rootPath : resolve(process.cwd(), "../../messages.json");
}

export async function resolveMessagesPath(): Promise<string> {
  const candidates = [defaultMessagesPath(), resolve(process.cwd(), "../../messages.json")];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next known workspace-relative location.
    }
  }
  throw new Error("Could not find messages.json");
}
