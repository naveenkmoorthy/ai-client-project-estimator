# AI Client Project Estimator

A minimal full-stack starter for collecting project requirements and returning an AI-assisted estimation package (task breakdown, schedule, pricing, risks, and proposal draft).

## Project Structure

- `backend/` API endpoint skeletons and validation stubs.
- `frontend/` Browser UI for submitting project details and viewing estimate sections.
- `shared/` Shared request/response contract and prompt-oriented schema definitions.

## Local Run Instructions

### 1) Start the backend API

Backend requirements:

- Node.js 18+ (for `fetch` support used by tests).
- No extra document-generation packages are required in this scaffold: PDF and DOCX/DOC exports are produced by `backend/services/exporter.js` using in-repo logic and Node buffers.

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

## Exporting Results

After generating a draft, open the **Delivery Plan Snapshot** results panel and use the export buttons in the top-right of that section:

- **Export PDF** → downloads a PDF file.
- **Export DOCX** → downloads a Word document (`.docx`, DOC-compatible in Microsoft Word / Google Docs).

Expected download filename patterns (from `Content-Disposition`):

- `project-estimate-YYYY-MM-DD.pdf`
- `project-estimate-YYYY-MM-DD.docx`

### Export API Endpoints

#### `POST /export/pdf`

- **Route:** `/export/pdf`
- **Request body shape:**
  - Accepts either:
    - A full estimate object (generated sections such as `taskBreakdown`, `timeline`, `costEstimate`, `riskFlags`, and one of `proposalMarkdown`/`proposalPlainText`/`proposalDraft`), or
    - Raw estimator input (`projectDescription`, `budget.amount`, `budget.currency`, `deadline`) which the backend converts into an estimate before export.
  - Can be provided as the root JSON object or nested under `estimateData` / `estimate`.
- **Success response:**
  - Status: `200 OK`
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="project-estimate-YYYY-MM-DD.pdf"`
- **Common error responses:**
  - `400 ValidationError` when payload is missing required fields or has invalid types.
  - `400 BadRequest` for malformed JSON.

#### `POST /export/docx`

- **Route:** `/export/docx`
- **Request body shape:** same as `/export/pdf`.
- **Success response:**
  - Status: `200 OK`
  - `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  - `Content-Disposition: attachment; filename="project-estimate-YYYY-MM-DD.docx"`
- **Common error responses:**
  - `400 ValidationError` when payload is missing required fields or has invalid types.
  - `400 BadRequest` for malformed JSON.
  - `404 NotFound` for unsupported export routes (for example, `/export/unknown`).

## Environment Variables

You can manage env vars with a root `.env` file. The backend now loads this file automatically on startup.

- `OPENAI_API_KEY` (or equivalent provider key, if you swap model providers).
- `PORT` (optional, defaults to `3001`).

Use the provided `.env` / `.env.example` values as a starting point:

```bash
OPENAI_API_KEY="your-key"
PORT=3001
```

Environment variables set in your shell still take precedence over `.env` values.

> Note: This scaffold currently returns mock estimator output. Add provider SDK wiring and prompt logic in `backend/server.js` and templates under `shared/`.

## Running Tests

Run the backend automated test suite from the repo root:

```bash
node --test backend/tests/*.test.js
```

This is the same command you can use in CI.
