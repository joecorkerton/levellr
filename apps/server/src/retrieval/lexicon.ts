import { normalizeBM25Text } from "./normalization.js";

const STOP_WORDS = [
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "what",
  "with",
] as const;

const EXCITEMENT_MARKERS = [
  "excited",
  "exciting",
  "hype",
  "hyped",
  "love",
  "looking forward",
  "can't wait",
] as const;

const FRUSTRATION_MARKERS = [
  "bug",
  "bugs",
  "broken",
  "crash",
  "crashes",
  "crashing",
  "disappointed",
  "error",
  "errors",
  "frustrated",
  "frustrating",
  "issue",
  "issues",
  "underwhelming",
] as const;

export const BM25_LEXICON_V1 = Object.freeze({
  version: "v1" as const,
  stopWords: Object.freeze(STOP_WORDS.map(normalizeBM25Text)),
  excitementMarkers: Object.freeze(EXCITEMENT_MARKERS.map(normalizeBM25Text)),
  frustrationMarkers: Object.freeze(FRUSTRATION_MARKERS.map(normalizeBM25Text)),
});

export type BM25Intent = "excitement" | "frustration" | "mixed" | "unknown";
