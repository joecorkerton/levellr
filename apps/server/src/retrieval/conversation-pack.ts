import { normalizeBM25Text, type BM25Candidate, type BM25SearchResult, type CommunityMessage, type ParsedManagerQuery } from "./bm25.js";

export type RetrievalMode = "bm25" | "hybrid";
export type TurnRole = "evidence" | "context" | "not_sent_to_synthesis";

export interface EvidencePackInput {
  retrievalMode: RetrievalMode;
  parsedQuery: ParsedManagerQuery;
  candidates: readonly BM25Candidate[];
  messages: readonly CommunityMessage[];
}

interface TurnFields {
  id: string;
  rootId: string;
  author: { id: string; name: string };
  channel: string;
  timestamp: string;
  reply_to: string | null;
  excerpt: string;
}

export interface SerializedTurn extends TurnFields {
  role: Exclude<TurnRole, "not_sent_to_synthesis">;
}

export interface ViewerTurn extends TurnFields {
  role: TurnRole;
  text: string;
}

export interface ConversationViewer {
  rootId: string;
  turns: ViewerTurn[];
}

export interface SerializedConversation {
  rootId: string;
  evidence: SerializedTurn[];
  context: SerializedTurn[];
  omittedOlderAncestorCount: number;
}

export interface ConversationEvidencePack {
  status: "ready";
  retrievalMode: RetrievalMode;
  parsedQuery: ParsedManagerQuery;
  conversations: SerializedConversation[];
  viewer: ConversationViewer[];
  sourceTextCharacters: number;
  requestEnvelopeCharacters: number;
}

export interface InsufficientEvidence {
  status: "insufficient_evidence";
  retrievalMode: RetrievalMode;
  parsedQuery: ParsedManagerQuery;
  conversations: SerializedConversation[];
  viewer: ConversationViewer[];
  inspectableCandidates: CommunityMessage[];
}

export type ConversationPackResult = ConversationEvidencePack | InsufficientEvidence;

const MAX_CONVERSATIONS = 6;
const MAX_EVIDENCE_PER_CONVERSATION = 2;
const MAX_CONTEXT_PER_CONVERSATION = 3;
const MAX_EVIDENCE_PER_AUTHOR = 2;
const MAX_EVIDENCE_PER_CHANNEL = 4;
const MAX_SOURCE_TEXT = 12_600;
const MAX_REQUEST_ENVELOPE = 20_000;

interface ResolvedMessage {
  message: CommunityMessage;
  rootId: string;
  path: CommunityMessage[];
}

interface SelectedConversation {
  rootId: string;
  representative: BM25Candidate;
  evidence: CommunityMessage[];
  members: ResolvedMessage[];
}

/** Project ranked message retrieval into the bounded, model-facing Conversation pack. */
export function prepareConversationEvidencePack(input: EvidencePackInput | (BM25SearchResult & { messages: readonly CommunityMessage[]; retrievalMode?: RetrievalMode })): ConversationPackResult {
  const retrievalMode = "retrievalMode" in input && input.retrievalMode ? input.retrievalMode : "bm25";
  const parsedQuery = input.parsedQuery;
  const messages = input.messages;
  const byId = new Map(messages.map((message) => [message.id, message]));
  const resolved = new Map<string, ResolvedMessage | null>();

  const resolve = (message: CommunityMessage, visiting = new Set<string>()): ResolvedMessage | null => {
    const cached = resolved.get(message.id);
    if (cached !== undefined) return cached;
    if (visiting.has(message.id)) return null;
    visiting.add(message.id);
    if (message.reply_to === null) {
      const result = { message, rootId: message.id, path: [message] };
      resolved.set(message.id, result);
      return result;
    }
    const parent = byId.get(message.reply_to);
    if (!parent || parent.channel !== message.channel || Date.parse(parent.timestamp) > Date.parse(message.timestamp)) {
      resolved.set(message.id, null);
      return null;
    }
    const parentResult = resolve(parent, visiting);
    if (!parentResult) {
      resolved.set(message.id, null);
      return null;
    }
    const result = { message, rootId: parentResult.rootId, path: [...parentResult.path, message] };
    resolved.set(message.id, result);
    return result;
  };

  const valid = messages.flatMap((message) => {
    const result = resolve(message);
    return result ? [result] : [];
  });
  const membersByRoot = new Map<string, ResolvedMessage[]>();
  for (const item of valid) membersByRoot.set(item.rootId, [...(membersByRoot.get(item.rootId) ?? []), item]);
  for (const members of membersByRoot.values()) members.sort(compareMessageAscending);

  const start = parsedQuery.dateWindow ? Date.parse(parsedQuery.dateWindow.start) : Number.NEGATIVE_INFINITY;
  const end = parsedQuery.dateWindow ? Date.parse(parsedQuery.dateWindow.end) : Number.POSITIVE_INFINITY;
  const candidates = input.candidates
    .filter((candidate) => {
      const time = Date.parse(candidate.source.timestamp);
      return time >= start && time <= end && resolved.get(candidate.source.id) != null;
    })
    .map((candidate) => ({ candidate, resolved: resolved.get(candidate.source.id)! }));

  const byRoot = new Map<string, { representative: BM25Candidate; hits: typeof candidates }>();
  for (const hit of candidates) {
    const current = byRoot.get(hit.resolved.rootId);
    if (!current) {
      byRoot.set(hit.resolved.rootId, { representative: hit.candidate, hits: [hit] });
    } else {
      current.hits.push(hit);
      if (compareRepresentative(hit.candidate, current.representative) < 0) current.representative = hit.candidate;
    }
  }
  const ranked = [...byRoot.entries()].sort((a, b) => compareRepresentative(a[1].representative, b[1].representative) || a[0].localeCompare(b[0]));
  const authors = new Map<string, number>();
  const channels = new Map<string, number>();
  const texts = new Set<string>();
  const selected: SelectedConversation[] = [];

  for (const [rootId, group] of ranked) {
    if (selected.length === MAX_CONVERSATIONS) break;
    const representative = group.representative;
    if (!canSelect(representative.source, authors, channels, texts)) continue;
    const evidence = [representative.source];
    addCaps(representative.source, authors, channels, texts);
    const alternatives = group.hits
      .filter((hit) => hit.candidate.source.id !== representative.source.id)
      .sort((a, b) => (a.candidate.source.author.id === representative.source.author.id ? 1 : 0) - (b.candidate.source.author.id === representative.source.author.id ? 1 : 0) || compareCandidate(a.candidate, b.candidate));
    const second = alternatives.find((hit) => canSelect(hit.candidate.source, authors, channels, texts)) ?? alternatives.find((hit) => canSelect(hit.candidate.source, authors, channels, texts));
    if (second) {
      evidence.push(second.candidate.source);
      addCaps(second.candidate.source, authors, channels, texts);
    }
    selected.push({ rootId, representative, evidence, members: membersByRoot.get(rootId) ?? [] });
  }

  const conversations = selected.map((item) => serializeConversation(item, start));
  const trimmed = trimEnvelope(conversations, retrievalMode, parsedQuery);
  const viewer = selected.map((item) => makeViewer(item, trimmed.conversations.find((conversation) => conversation.rootId === item.rootId)!));
  const resultBase = { retrievalMode, parsedQuery, conversations: trimmed.conversations, viewer };
  if (selected.length < 2) {
    return { status: "insufficient_evidence", ...resultBase, inspectableCandidates: candidates.map(({ candidate }) => candidate.source) };
  }
  const sourceTextCharacters = trimmed.conversations.reduce((sum, conversation) => sum + conversation.evidence.reduce((n, turn) => n + turn.excerpt.length, 0) + conversation.context.reduce((n, turn) => n + turn.excerpt.length, 0), 0);
  return { status: "ready", ...resultBase, sourceTextCharacters, requestEnvelopeCharacters: JSON.stringify({ retrievalMode, parsedQuery, conversations: trimmed.conversations }).length };
}

function serializeConversation(item: SelectedConversation, windowStart: number): SerializedConversation {
  const selectedIds = new Set(item.evidence.map((message) => message.id));
  const older = new Map<string, CommunityMessage>();
  const paths = item.evidence.map((evidence) => {
    const resolved = item.members.find((member) => member.message.id === evidence.id)!;
    return resolved.path.slice(0, -1).reverse().filter((ancestor) => Date.parse(ancestor.timestamp) < windowStart);
  });
  for (const path of paths) {
    const root = path[path.length - 1];
    if (root) older.set(root.id, root);
  }
  for (let depth = 0; depth < Math.max(0, ...paths.map((path) => path.length)); depth += 1) {
    for (const path of paths) {
      const ancestor = path[depth];
      if (ancestor) older.set(ancestor.id, ancestor);
    }
  }
  const retainedContext = [...older.values()].slice(0, MAX_CONTEXT_PER_CONVERSATION).sort(compareCommunityMessageAscending);
  return {
    rootId: item.rootId,
    evidence: item.evidence.map((message) => turn(message, item.rootId, "evidence", 600)),
    context: retainedContext.map((message) => turn(message, item.rootId, "context", 300)),
    omittedOlderAncestorCount: Math.max(0, older.size - retainedContext.length),
  };
}

function makeViewer(item: SelectedConversation, pack: SerializedConversation): ConversationViewer {
  const evidence = new Set(pack.evidence.map((turn) => turn.id));
  const context = new Set(pack.context.map((turn) => turn.id));
  return { rootId: item.rootId, turns: item.members.map(({ message }) => viewerTurn(message, item.rootId, evidence.has(message.id) ? "evidence" : context.has(message.id) ? "context" : "not_sent_to_synthesis")) };
}

function turn(message: CommunityMessage, rootId: string, role: Exclude<TurnRole, "not_sent_to_synthesis">, limit: number): SerializedTurn {
  return { id: message.id, rootId, author: message.author, channel: message.channel, timestamp: message.timestamp, reply_to: message.reply_to, role, excerpt: message.text.slice(0, limit) };
}

function viewerTurn(message: CommunityMessage, rootId: string, role: TurnRole): ViewerTurn {
  return { id: message.id, rootId, author: message.author, channel: message.channel, timestamp: message.timestamp, reply_to: message.reply_to, role, excerpt: message.text.slice(0, 600), text: message.text };
}

function trimEnvelope(conversations: SerializedConversation[], retrievalMode: RetrievalMode, parsedQuery: ParsedManagerQuery): { conversations: SerializedConversation[] } {
  const copy = conversations.map((conversation) => ({ ...conversation, evidence: [...conversation.evidence], context: [...conversation.context] }));
  while (JSON.stringify({ retrievalMode, parsedQuery, conversations: copy }).length > MAX_REQUEST_ENVELOPE) {
    const target = [...copy].reverse().find((conversation) => conversation.evidence.length > 1);
    if (!target) break;
    target.evidence.pop();
  }
  return { conversations: copy };
}

function canSelect(message: CommunityMessage, authors: Map<string, number>, channels: Map<string, number>, texts: Set<string>): boolean {
  return (authors.get(message.author.id) ?? 0) < MAX_EVIDENCE_PER_AUTHOR && (channels.get(message.channel) ?? 0) < MAX_EVIDENCE_PER_CHANNEL && !texts.has(normalizeBM25Text(message.text));
}
function addCaps(message: CommunityMessage, authors: Map<string, number>, channels: Map<string, number>, texts: Set<string>): void {
  authors.set(message.author.id, (authors.get(message.author.id) ?? 0) + 1); channels.set(message.channel, (channels.get(message.channel) ?? 0) + 1); texts.add(normalizeBM25Text(message.text));
}
function compareCandidate(a: BM25Candidate, b: BM25Candidate): number { return a.rank - b.rank || b.score - a.score || compareTimestampId(a.source, b.source); }
function compareRepresentative(a: BM25Candidate, b: BM25Candidate): number { return b.score - a.score || Date.parse(b.source.timestamp) - Date.parse(a.source.timestamp) || a.source.id.localeCompare(b.source.id); }
function compareMessageAscending(a: ResolvedMessage, b: ResolvedMessage): number { return compareTimestampId(a.message, b.message); }
function compareCommunityMessageAscending(a: CommunityMessage, b: CommunityMessage): number { return compareTimestampId(a, b); }
function compareTimestampId(a: CommunityMessage, b: CommunityMessage): number { return Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.id.localeCompare(b.id); }
