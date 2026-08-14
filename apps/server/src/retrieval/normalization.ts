export function normalizeBM25Text(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function tokenizeBM25Text(value: string): string[] {
  const normalized = normalizeBM25Text(value);
  return normalized ? normalized.split(" ") : [];
}
