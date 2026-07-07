# MicroAccess Smart Metering - Build Instructions

## Mission
Build production-ready software for MSM now. Do not produce extra planning documents unless explicitly requested.

## Operating Mode
- Implementation-first: when asked for a feature, write code, tests, and wiring.
- Keep explanations short and practical.
- Do not block on optional "if/any" brainstorming. Make reasonable decisions and proceed.
- Prefer shipping vertical slices end-to-end over partial scaffolding.

## Product Scope
MSM has two user-facing products and one backend:
1. Management Web App (SvelteKit + TypeScript)
2. Customer Mobile App (Flutter + Dart)
3. Backend API (Node.js + Fastify + TypeScript)

## Source of Truth
- Product requirements: README.md
- Endpoint mapping: STEAMA_API_CATEGORIZATION.md
- Architecture and flows: TECHNICAL_ARCHITECTURE.md
- Stack decisions: TECH_STACK_FINAL.md, TECH_STACK_ON_PREM.md

If there is conflict, follow the live API behavior and update code/docs to match.

## Non-Negotiable Integration Rules
- Clients (web/mobile) authenticate only with MSM backend JWT.
- Only MSM backend talks to Steama APIs.
- Use backend-managed Steama token from /get-token.
- Customer top-up create endpoint: /customers/{id}/transactions/.
- Treat /customer-transactions/ as non-canonical for this tenant.
- Respect observed provider rate limit (10 requests/second).

## Purchase Lifecycle Contract
Implement and preserve these states:
- initiated
- payment_confirmed_credit_pending
- credited
- failed
- reconciled

Rules:
- Show user success only when state is credited.
- All provider credit posts must be idempotent.
- Retries are required for pending credit state.
- Every transition must be audit-logged with correlation ID.

## Engineering Standards
- TypeScript strict mode for backend/web.
- Validate request/response schemas (Zod).
- Use structured logging with request IDs.
- UI rule: do not use gradient colors; use solid brand colors and clear contrast.
- Add tests with every feature:
  - Backend: unit + integration (Vitest/Jest + Supertest)
  - Web: component/unit (Vitest + Testing Library)
  - Mobile: widget/integration tests where practical
- No hardcoded secrets or tokens in source or docs.

## Architecture Boundaries
- Backend owns provider integration, retries, reconciliation, and audit trail.
- Web/mobile never call Steama directly.
- Database model must support user-to-meter mapping and provider customer mapping.
- Reconciliation jobs must be safe to rerun (no double-credit).

## Build Priority (Now)
1. Backend foundation (auth, users, customer-meter mapping, Steama client)
2. Purchase pipeline (payment callback to provider credit posting with idempotency)
3. Mobile buy-units + transaction history
4. Web operations dashboard + reconciliation views
5. Alerts/notifications + reporting exports

## Done Criteria for Any Feature
- Code compiles and passes tests.
- Zero TypeScript errors, zero lint errors, and all tests passing are mandatory before a task is marked done.
- API contracts documented in code (schema/types).
- Error paths and retries handled.
- Audit log and observability included where relevant.
- UI states include loading, empty, error, success.

## Response Style for Copilot
- Be direct.
- Prefer actionable code changes over long narrative.
- If assumptions are needed, state them in 1-3 lines and continue implementation.
