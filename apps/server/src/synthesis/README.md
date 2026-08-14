# Gemini synthesis smoke check

The adapter is server-only and reads `GEMINI_API_KEY` from the ignored root `.env`.
It defaults to `gemini-2.5-flash`; set `GEMINI_ANSWER_MODEL` only when explicitly choosing another configured answer model.

With a local key, run the credential-free automated contract tests first:

```sh
npm test --workspace @community-pulse/server -- src/synthesis/gemini-adapter.test.ts
```

For a live smoke request, use a temporary local script (do not commit it or print/save its response):

```sh
GEMINI_API_KEY="$(grep '^GEMINI_API_KEY=' .env | cut -d= -f2-)" \
  node --import tsx -e 'import { createGeminiModelClient, GEMINI_RESPONSE_SCHEMA } from "./apps/server/src/synthesis/gemini-adapter.ts"; const client=createGeminiModelClient(process.env.GEMINI_API_KEY); const response=await client.generateContent({model: process.env.GEMINI_ANSWER_MODEL || "gemini-2.5-flash", contents: JSON.stringify({managerQuery:"What is exciting?", request:{intent:"excitement",dateWindow:null}, evidence:[{rootId:"smoke-root",evidence:[{id:"smoke-evidence",rootId:"smoke-root",author:{id:"u",name:"A"},channel:"general",timestamp:"2026-08-11T00:00:00.000Z",reply_to:null,role:"evidence",excerpt:"The restored mode is fantastic."}],context:[],omittedOlderAncestorCount:0}]}), config:{responseMimeType:"application/json",responseSchema:GEMINI_RESPONSE_SCHEMA}}); const parsed=JSON.parse(response.text || ""); if(parsed.findings?.[0]?.supportingCitations?.[0]?.id !== "smoke-evidence") throw new Error("smoke citation validation failed"); console.log("Gemini smoke check passed");'
```

The command validates a minimal cited response and prints no model output. Never put the key in a committed file.
