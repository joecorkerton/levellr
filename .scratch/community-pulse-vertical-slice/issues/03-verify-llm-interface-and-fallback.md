# Verify the supplied LLM interface and fallback

Type: task
Status: claimed
Blocked by: none

## Question

Using the separately supplied model identifier, SDK snippet, and temporary key, verify the minimal request/response behavior needed for constrained answer synthesis. Decide the smallest safe failure behavior for unavailable credentials, quota limits, malformed model output, and requests with insufficient evidence.

Record only the integration facts and behavior that later implementation decisions need; do not build the destination in this ticket.

## Answer

### Verification boundary

The repository/session did not contain the temporary key or a separately supplied SDK snippet, so a successful live request could not be run without inventing credentials. The user selected Google AI Studio Gemini and the local credential files are now prepared:

- `.env.example` is the committed template.
- `.env` is local-only and ignored by git.
- Set only `GEMINI_API_KEY` in `.env`; do not commit its value.

The SDK shape and failure categories below are verified against Google's current `@google/genai` source and documentation. The live success-path smoke check remains pending until `GEMINI_API_KEY` is populated.

### Integration decision

Use the server-side `@google/genai` SDK with `gemini-2.5-flash` for constrained answer synthesis. Keep `gemini-2.5-flash-lite` as an explicitly configured option for a later cost/latency experiment, not as an automatic error fallback. `gemini-embedding-001` is not needed for the chosen local lexical retrieval approach.

The minimal request/response seam is:

```ts
import {GoogleGenAI, Type} from '@google/genai';

const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});
const response = await ai.models.generateContent({
  model: process.env.GEMINI_ANSWER_MODEL ?? 'gemini-2.5-flash',
  contents: prompt,
  config: {
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {/* the later answer contract */},
      required: [/* the later answer contract */],
    },
  },
});

const raw = response.text;
// Require non-empty text, JSON.parse it, then validate the parsed value
// against the application response schema before returning it.
```

`response.text` is the only model content the application should consume. The server must parse and validate it; structured-output configuration is not a substitute for runtime validation. Pin the SDK version when the destination is built so its request configuration does not drift.

### Smallest safe failure behavior

All failures return a typed, non-success result and never turn an ungrounded or malformed model response into a grounded answer. Already retrieved evidence may remain inspectable, but no synthesized claims are returned.

| Situation | Behavior |
| --- | --- |
| Missing `GEMINI_API_KEY`, or authentication/permission failure (401/403) | Do not call or retry another model. Return `llm_unavailable` with setup guidance; preserve the retrieved evidence if present. |
| Quota/rate limit (429) | Do not silently switch to Flash-Lite or retry until the request burns more quota. Return `llm_quota_exhausted` with a temporary-unavailability message and preserve evidence. |
| Other transient provider failure (5xx/network timeout) | Allow one retry after a short capped backoff (250 ms) within a 10-second request deadline, then return `llm_unavailable`; never fabricate a local answer from the query. |
| Empty, non-JSON, or schema-invalid model output | Discard the output, log only a safe diagnostic, and return `invalid_model_output`; do not salvage prose or expose raw model text as the answer. |
| No evidence, or fewer than three distinct retrieved messages for the pulse query | Skip the model call and return `insufficient_evidence` with the requested date window and an explicit statement that no reliable grounded answer can be made. Do not claim that the community has no opinion. |

The model should receive only the manager query, parsed time window/intent, and the deterministic evidence pack from issue 01 (up to 12 excerpts). It must cite the supplied stable message IDs; later contract work must reject citations that are absent from that pack.

### Sources

- [Google Gen AI SDK README](https://github.com/googleapis/js-genai#quickstart) — server-side `GoogleGenAI` initialization and `models.generateContent`.
- [Official response-schema sample](https://github.com/googleapis/js-genai/blob/main/sdk-samples/generate_content_with_response_schema.ts) — `responseMimeType`, `responseSchema`, and `response.text`.
- [Google API key guidance](https://ai.google.dev/gemini-api/docs/generate-content/api-key) — `GOOGLE_API_KEY` takes precedence if both environment variables are set; use one key variable to avoid ambiguity.
- [Gemini API error guidance](https://ai.google.dev/gemini-api/docs/api-errors) — malformed requests, authentication failures, and quota/rate-limit categories.

## Comments

- Live verification is blocked until the temporary Google AI Studio key is entered in the ignored `.env` file.
