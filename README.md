# Crew Sync — Agentic AI Campus Club Coordinator

Crew Sync is an agentic campus club coordination platform built to solve multi-club scheduling clashes, surface declining club health, recommend cross-club collaborations, match volunteers without double-booking, and generate verified post-event reports with human-in-the-loop approval.

## Architecture (Sense → Think → Act → Explain)

- **Backend (`backend/`)**: Node.js, Express, Mongoose (MongoDB).
  - **Models**: `Club`, `Event` (with `startAt`, `endAt`, normalized `venue`, `openRoles`), `Volunteer`, `EventParticipant`, `DecisionLog`.
  - **Agent Modules (`backend/agent/`)**:
    1. `clash.js`: Detects time/venue overlaps and same-club double-bookings, and finds the nearest conflict-free campus venue/slot.
    2. `health.js`: Computes club health scores from last-event age, membership trajectory, and 30-day post activity; flags quiet clubs (≥ 60 days inactive & declining membership).
    3. `collaborate.js`: Weighted cross-club compatibility scoring (`+30` shared tags, `+15` complementary categories, `+10` calendar window fit, `+5` audience overlap) for clash-merges and quiet-club revivals.
    4. `match.js`: Scores volunteers against event `openRoles` (`+5` per matching skill, `+15` availability fit, `-40` clash/overload penalty).
    5. `report.js`: Aggregates verified participant & attendance rows into summary totals and drafts a one-page plain-language post-event report.
    6. `llm.js`: Single AI gateway powered by `@openrouter/sdk` (`openrouter.alpha.decisions.create`) using `perplexity/pplx-decider-flash-v1.3:free` for typed decisions (`noul`, `choice`, `score`) across every module, with deterministic tool-grounded fallback when no API key is configured.
    7. `orchestrator.js`: Coordinates the Sense → Think → Act → Explain loop and executes approved `DecisionLog` actions.
- **Frontend (`frontend/`)**: React, Vite, Tailwind CSS, Lucide Icons, Framer Motion, React Hot Toast (supports Light & Dark mode).

## Setup & Running Locally

### Prerequisites
- Node.js 18+
- MongoDB running locally on `mongodb://127.0.0.1:27017`

### 1. Backend
```bash
cd backend
npm install
npm run seed
npm run dev
```
API runs on `http://localhost:5001`.

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Dashboard runs on `http://localhost:5173`.

## Tools & Frameworks Declared
- Express, Mongoose, Helmet, CORS, Morgan
- React, Vite, Tailwind CSS, Framer Motion, Lucide React, React Hot Toast, Axios
- `@openrouter/sdk` (`perplexity/pplx-decider-flash-v1.3:free` typed decisions via `OPENROUTER_API_KEY` in `backend/.env`, never hardcoded)
