# Scaffold the React and TypeScript application

Type: task
Status: ready-for-agent
Blocked by: none

## Goal

Create the runnable local foundation for the 90-minute Community Pulse vertical slice: a React frontend, a TypeScript backend, and developer setup documentation. The result should make later retrieval and synthesis work straightforward without committing to the vector or conversation-evidence implementation.

## Scope

- Set up a TypeScript workspace with separately runnable frontend and backend development commands.
- Add a minimal React screen with a manager-question input and an explicit pre-integration/empty state.
- Add a TypeScript API with a health endpoint and a typed placeholder endpoint for future manager queries; it must not present fabricated analysis as grounded.
- Load environment configuration on the server only and validate/document the required variables without exposing `GEMINI_API_KEY` to the client.
- Update `README.md` with the shortest local run instructions and clearly state that answers, retrieval, and data ingestion have not yet been connected.
- Add a basic automated check that the API health endpoint and frontend build/start path work.

## Deferred

- Postgres, `pgvector`, migrations, Docker, and all vector schema work.
- Gemini embedding jobs, embedding cache/seeding, semantic search, BM25, RRF, and date-window retrieval.
- Conversation projection, ancestor hydration, evidence-pack selection, Gemini synthesis, citation validation, and the conversation viewer.
- Authentication, persistence beyond later retrieval needs, dashboards, and recommendation features.

## Acceptance criteria

- A fresh clone can install dependencies, start the frontend and backend locally, and reach the health endpoint using the README instructions.
- The frontend is visibly a Community Pulse starting point, but makes no claim to return a grounded answer yet.
- The query API returns an explicit typed `not_ready`/pre-integration result rather than calling a model or inventing a pulse.
- No API key is bundled into or readable from client-side code.
- The project has a repeatable typecheck/build or test command covering the scaffold.

## Dependencies

This can begin immediately. It deliberately does not depend on [Set the conversation-aware evidence pack](05-set-conversation-aware-evidence-pack.md), whose rules will guide a later retrieval-and-synthesis ticket.

## Comments
