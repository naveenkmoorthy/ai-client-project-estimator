# AI Client Project Estimator

A minimal full-stack starter for collecting project requirements and returning an AI-assisted estimation package (task breakdown, schedule, pricing, risks, and proposal draft).

## Project Structure

- `backend/` API endpoint skeletons and validation stubs.
- `frontend/` Browser UI for submitting project details and viewing estimate sections.
- `shared/` Shared request/response contract and prompt-oriented schema definitions.

## Local Run Instructions

### 1) Start the backend API

```bash
cd backend
node server.js
```

The API runs on `http://localhost:3001` by default.

### 2) Start the frontend

Use any static file server from the repo root. Example:

```bash
python3 -m http.server 3000
```

Then open `http://localhost:3000/frontend/`.

### 3) Submit an estimate request

Fill out the form and submit. The frontend sends a `POST` request to `http://localhost:3001/estimate` and renders all output sections.

## Environment Variables

Set these before running the backend:

- `OPENAI_API_KEY` (or equivalent provider key, if you swap model providers).
- `PORT` (optional, defaults to `3001`).

Example:

```bash
export OPENAI_API_KEY="your-key"
export PORT=3001
```

> Note: This scaffold currently returns mock estimator output. Add provider SDK wiring and prompt logic in `backend/server.js` and templates under `shared/`.

## Running Tests

Run the backend automated test suite from the repo root:

```bash
node --test backend/tests/*.test.js
```

This is the same command you can use in CI.
