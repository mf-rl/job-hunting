# Job Hunting Automation

This repository contains a local job-search automation system with two main
parts:

- `job-hunting-dashboard`: a FastAPI + vanilla JavaScript dashboard for
  operating and monitoring the system.
- `job-hunting-system`: the pipeline, data store, CV assets, scoring logic, and
  agent-facing scripts that search jobs, score matches, parse job descriptions,
  and generate tailored CVs.

The project is designed to run locally on WSL/Linux and is currently wired to
the Hermes agent environment at `~/.hermes`.

## What It Does

The system helps run a repeatable job-search workflow:

1. Search multiple job sources using the profile configuration.
2. Normalize, deduplicate, and country-filter listings.
3. Score listings deterministically against the candidate profile.
4. Persist known jobs so repeated scans do not lose history.
5. Let the user inspect jobs in the dashboard.
6. Parse a job description when the user chooses to promote/tailor a job.
7. Generate a tailored CV JSON through Hermes/CV Adapter.
8. Render the tailored CV as DOCX or PDF using the canonical CV template style.
9. Track runs, activity, agent status, and user decisions.

Search and first-pass matching are non-AI operations. AI tokens are only needed
when Hermes profiles are called for CV parsing/structuring, job-description
extraction, or CV tailoring.

## Repository Layout

```text
job-hunting/
  job-hunting-dashboard/
    app.py
    index.html
    static/
      css/app.css
      src/
        app/
        features/
        shared/
      templates/
    dashboard.sh
    bootstrap.sh
    forge-dashboard.service

  job-hunting-system/
    profile/profile.json
    cv/
      base_cv_raw.*
      base_cv.txt
      base_cv.json
      template_cv.pdf
      history/
    pipeline/
      run_pipeline.py
      scout_search.py
      matcher_score.py
      job_store.py
      job_reader.py
      cv_adapter.py
      promote_job.py
      promote_custom_job.py
      build_base_cv.py
      cv_docx.py
      cv_pdf.py
      scheduled_find.py
    agents/
      scout/outputs/
      matcher/outputs/
      job-reader/outputs/
      cv-adapter/outputs/
    jobs.db
    pipeline.db
    custom_jobs.db
```

## High-Level Architecture

```text
Browser
  |
  v
job-hunting-dashboard/index.html
  |
  v
Frontend ES modules
  - app/bootstrap.js
  - app/router.js
  - features/*/*
  - shared/api/apiClient.js
  |
  v
FastAPI backend: job-hunting-dashboard/app.py
  |
  +--> SQLite state
  |     - job-hunting-system/jobs.db
  |     - job-hunting-system/pipeline.db
  |     - job-hunting-system/custom_jobs.db
  |     - ~/.hermes/agent-logs.db
  |
  +--> Pipeline subprocesses
        - scout_search.py
        - matcher_score.py
        - job_reader.py
        - cv_adapter.py
        - promote_job.py
        - promote_custom_job.py
        - build_base_cv.py
```

The dashboard is the operational UI and HTTP API. The system directory owns the
business workflow, durable data, and generated artifacts.

## job-hunting-dashboard

`job-hunting-dashboard` is the local control plane. It serves the web UI,
exposes JSON APIs, starts background pipeline tasks, and reads system state from
SQLite and Hermes logs.

### Backend

Main file: `job-hunting-dashboard/app.py`

The backend is a FastAPI application bound to `127.0.0.1:51764`. It should not
be exposed publicly without adding authentication and tightening CORS.

Important default paths:

```text
HERMES_HOME          ~/.hermes
FORGE_SYSTEM_DIR     ~/job-hunting/job-hunting-system
FORGE_DASHBOARD_DIR  ~/job-hunting/job-hunting-dashboard
AGENT_LOG_DB         ~/.hermes/agent-logs.db
JOBS_DB              job-hunting-system/jobs.db
PIPELINE_DB          job-hunting-system/pipeline.db
CUSTOM_JOBS_DB       job-hunting-system/custom_jobs.db
```

All of these can be overridden with environment variables.

### Main API Areas

Operational status:

- `GET /api/health`
- `GET /api/overview`
- `GET /api/agents`
- `GET /api/activity`
- `GET /api/telemetry`
- `GET /api/pipeline`
- `GET /api/run-detail`
- `GET /api/results`

Pipeline control:

- `POST /api/run?trigger=find` starts a search/score/store run.
- `POST /api/promote` promotes a matched job into the JD-read and CV-tailoring
  flow.

CV management:

- `GET /api/cv` returns base CV/profile status.
- `POST /api/cv` uploads a new base CV and starts `build_base_cv.py`.
- `GET /api/cv-docx?path=...` renders/downloads a tailored CV as DOCX.
- `GET /api/cv-pdf?path=...` renders/downloads a tailored CV as PDF.

Settings:

- `GET /api/settings`
- `POST /api/settings`
- `GET /api/schedule`
- `POST /api/schedule`

Custom job descriptions:

- `POST /api/custom/parse-description` parses pasted JD text.
- `POST /api/custom/promote` tailors the CV for a parsed custom JD.
- `GET /api/custom/jobs`
- `GET /api/custom/status`

Design/template utilities:

- `POST /api/design-template`
- `GET /template`

### Frontend

The frontend is plain HTML, CSS, and ES modules. There is no frontend build
step.

Entry point:

```text
job-hunting-dashboard/index.html
job-hunting-dashboard/static/src/app/bootstrap.js
```

Application shell:

- `index.html` owns the static semantic shell: sidebar, top bar, main region,
  mobile navigation, theme toggle, and scan button.
- `static/css/app.css` owns styling.
- `static/src/app/bootstrap.js` loads shared templates, creates page modules,
  registers them with the router, and starts polling where needed.
- `static/src/app/router.js` switches page views without each page knowing the
  internals of other pages.
- `static/src/app/appShell.js` wires global shell behavior such as navigation,
  theme toggle, clock, and the top-level "Scan Now" action.

Feature modules:

```text
static/src/features/
  overview/
    overviewPage.js
    overviewService.js
  jobs/
    jobsPage.js
    jobsService.js
  custom/
    customPage.js
    customService.js
  cv/
    cvPage.js
    cvService.js
  settings/
    settingsPage.js
    settingsService.js
  design/
    designPage.js
```

Shared modules:

```text
static/src/shared/
  api/apiClient.js
  services/runService.js
  dialogs/drawer.js
  dom.js
  formatters.js
  icons.js
  templates.js
  widgets.js
```

Each page owns its local UI state and behavior. Shared modules are used for API
requests, formatting, DOM helpers, icons, templates, widgets, and common shell
services.

### Dashboard Pages

Overview:

- Shows aggregate run, agent, telemetry, and activity state.
- Surfaces recent matches and promotion state.
- Can start a find run.

Jobs:

- Shows matched jobs from the latest run.
- Supports source filtering, pagination, JD viewing, job status updates, and
  promotion/tailoring.
- Promotion goes through `/api/promote`.

Custom:

- Accepts pasted job-description text.
- Parses the JD into structured fields.
- Stores custom jobs in `custom_jobs.db`.
- Tailors the CV only when the user clicks the Tailor CV action.

CV:

- Uploads the base CV.
- Shows base CV/profile build status.
- Triggers `build_base_cv.py` in the background.

Settings:

- Edits `profile/profile.json` search configuration.
- Manages countries, sources, queries, skills, thresholds, and scheduling.

Design:

- Displays the uploaded design reference/template.

## job-hunting-system

`job-hunting-system` owns the automation logic and persistent state. Most
scripts are command-line programs that the dashboard starts as subprocesses.

### Agents and Responsibilities

The system is organized around four logical agents:

- Forge: orchestrates user-facing commands and pipeline workflows.
- Scout: searches job sources and runs deterministic first-pass scoring.
- Job Reader: extracts structured JD fields from a job URL or pasted JD text.
- CV Adapter: structures the base CV and creates tailored CV JSON for a target
  JD.

The agent output directories are:

```text
agents/scout/outputs/
agents/matcher/outputs/
agents/job-reader/outputs/
agents/cv-adapter/outputs/
```

### Pipeline Scripts

`run_pipeline.py`

Orchestrates the free search flow:

```text
scout_search.py -> matcher_score.py -> job_store.py
```

It writes run records to `pipeline.db`, logs activity to Hermes agent logs, and
removes `.run-running` when done.

`scout_search.py`

Fetches jobs from enabled sources in `profile/profile.json`, normalizes them,
deduplicates them, applies selected-country filtering, and writes
`agents/scout/outputs/listings_<run_id>.json`.

Supported sources include:

- Adzuna
- Remotive
- RemoteOK
- We Work Remotely
- Jobicy
- Arbeitnow
- Get on Board
- Himalayas
- GraphQL Jobs
- Reed
- JSearch/RapidAPI

Some sources require credentials; sources without credentials are skipped with a
note.

`matcher_score.py`

Scores listings deterministically. It does not call an AI model.

Scoring components:

- title match
- skill match
- seniority match
- location match

Modes:

- `first_cut`: used after a search run.
- `final`: used during promotion after the full JD is available.

Output: `agents/matcher/outputs/matches_<run_id>.json`

`job_store.py`

Maintains persistent job memory in `jobs.db`.

The job lifecycle is monotonic:

```text
seen -> matched -> read -> tailored
```

The store tracks stable keys, title, company, URL, score, status, cached JD
JSON, cached tailored CV path, first/last run IDs, times seen, and optional
user status.

`job_reader.py`

Fetches or accepts JD text, then extracts structured job fields through the
Hermes `job-reader` profile. It supports:

- normal URL fetching
- LinkedIn guest extraction
- fallback to stored/pasted description text
- `--description-only` for Custom page pasted JDs

Output includes the extracted role, company, location, work mode, salary,
posted date, responsibilities, required skills, preferred skills, and seniority
signals.

`cv_adapter.py`

Calls the Hermes `cv-adapter` profile to tailor the base CV JSON to a target JD.
It rewrites headline, summary, experience bullets, and skill ordering while
preserving factual fields such as employers, dates, education, contact,
languages, and existing skills.

Output: tailored CV JSON under `agents/cv-adapter/outputs/`.

`promote_job.py`

Used by `/api/promote`. It:

1. Looks up or derives the job key.
2. Reuses cached JD/CV data when available.
3. Runs `job_reader.py` if JD data is missing.
4. Re-scores the job in final mode.
5. Runs `cv_adapter.py`.
6. Stores the tailored CV path in `jobs.db`.

`promote_custom_job.py`

Used by Custom page promotion. The JD is already parsed from pasted text, so it
skips URL fetching and calls `cv_adapter.py` directly, then updates
`custom_jobs.db`.

`build_base_cv.py`

Used after uploading a base CV. It:

1. Extracts text from PDF, DOCX, TXT, or Markdown.
2. Writes `cv/base_cv.txt`.
3. Calls CV Adapter to structure the CV.
4. Applies deterministic cleanup/merging for fields the model may miss.
5. Writes `cv/base_cv.json`.
6. Derives and merges search profile fields into `profile/profile.json`.

`cv_docx.py` and `cv_pdf.py`

Render tailored CV JSON as DOCX or PDF. Both use the canonical
`cv/template_cv.pdf` style: Letter page size, Arial-compatible typography,
plain section headings, and the same section order as the base CV template.

`scheduled_find.py`

Runs scheduled scans and sends digests when Slack or email settings are
available.

### Data Files

`profile/profile.json`

Main search and scoring configuration:

- `country`: comma-separated country codes.
- `sources`: enabled/disabled job boards.
- `target_titles`: qualified target roles.
- `search_queries`: short source search terms.
- `scoring_skills`: skills used by deterministic matcher.
- `seniority`: target seniority.
- `industry_hints`: useful profile context.
- `first_cut_threshold`: score threshold after search.
- `final_threshold`: score threshold after full JD parse.
- `pages`, `max_days_old`, `results_per_run`: source fetch controls.

`cv/base_cv_raw.*`

Uploaded source CV.

`cv/base_cv.txt`

Extracted raw text from the uploaded CV.

`cv/base_cv.json`

Structured CV used as the source of truth for tailoring.

`cv/template_cv.pdf`

Reference template for visual output. The renderers preserve the template's
layout style and only change the tailored content.

`jobs.db`

Persistent normal job memory.

`pipeline.db`

Pipeline run history.

`custom_jobs.db`

Custom pasted-JD jobs and their tailoring status.

`~/.hermes/agent-logs.db`

Hermes activity log database read by the dashboard activity stream.

## Setup

### Assumptions

This project is currently set up for a local WSL/Linux environment with:

- Python 3.10+.
- Hermes installed under `~/.hermes`.
- Hermes agent virtualenv at `~/.hermes/hermes-agent/venv`.
- Hermes profiles named `job-reader` and `cv-adapter`.
- The repository located at `~/job-hunting`.

The scripts default to those paths. Override paths with environment variables
if the repo is moved.

### Python Dependencies

The application uses the Hermes virtualenv:

```bash
/home/mfrl/.hermes/hermes-agent/venv/bin/python
```

Runtime packages used by the code include:

- `fastapi`
- `uvicorn`
- `python-multipart`
- `python-docx`
- `fpdf2`
- optional PDF extraction helpers: `PyMuPDF` or `pdfminer.six`

System tools used when available:

- `pdftotext` for PDF text extraction.
- `fc-match` and system fonts for PDF font resolution.
- `systemctl` for optional service/timer installation.

Install missing Python packages into the Hermes venv, not a random global
Python:

```bash
~/.hermes/hermes-agent/venv/bin/pip install fastapi uvicorn python-multipart python-docx fpdf2
```

On Ubuntu, `pdftotext` is provided by `poppler-utils`:

```bash
sudo apt-get install poppler-utils
```

### Environment Variables

Path overrides:

```bash
export HERMES_HOME="$HOME/.hermes"
export FORGE_SYSTEM_DIR="$HOME/job-hunting/job-hunting-system"
export FORGE_DASHBOARD_DIR="$HOME/job-hunting/job-hunting-dashboard"
export JOBS_DB="$FORGE_SYSTEM_DIR/jobs.db"
export PIPELINE_DB="$FORGE_SYSTEM_DIR/pipeline.db"
export CUSTOM_JOBS_DB="$FORGE_SYSTEM_DIR/custom_jobs.db"
export AGENT_LOG_DB="$HERMES_HOME/agent-logs.db"
```

Job source credentials are loaded from the environment or `~/.hermes/.env`:

```bash
ADZUNA_APP_ID=...
ADZUNA_APP_KEY=...
REED_API_KEY=...
RAPIDAPI_KEY=...
```

Optional Slack/email digest settings:

```bash
SLACK_BOT_TOKEN=...
SLACK_HOME_CHANNEL=...
DIGEST_EMAIL=...
EMAIL_ADDRESS=...
EMAIL_PASSWORD=...
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
```

### Start the Dashboard

From the repository root:

```bash
cd ~/job-hunting
job-hunting-dashboard/dashboard.sh start
```

Open:

```text
http://127.0.0.1:51764/index.html
```

Useful commands:

```bash
job-hunting-dashboard/dashboard.sh status
job-hunting-dashboard/dashboard.sh restart
job-hunting-dashboard/dashboard.sh stop
```

Logs:

```bash
tail -f job-hunting-dashboard/dashboard.log
```

### Install Dashboard as a Service

```bash
job-hunting-dashboard/bootstrap.sh
```

`bootstrap.sh` tries to install `forge-dashboard.service` as a user systemd
service. If user systemd is unavailable, it falls back to `dashboard.sh start`.

### Run a Search Manually

```bash
cd ~/job-hunting
~/.hermes/hermes-agent/venv/bin/python3 job-hunting-system/pipeline/run_pipeline.py --find-only
```

Or from the dashboard, click "Scan Now" on the Jobs page.

### Upload/Rebuild the Base CV

Use the CV page in the dashboard or call:

```bash
curl -F "file=@/path/to/cv.pdf" http://127.0.0.1:51764/api/cv
```

The dashboard stores the upload under `job-hunting-system/cv/`, archives the
previous raw CV under `cv/history/`, and starts `build_base_cv.py` in the
background.

### Tailor a Matched Job

Use the Jobs page. The backend will:

1. Reuse cached JD/CV if already tailored.
2. Run Job Reader if the JD is missing.
3. Re-score the job.
4. Run CV Adapter.
5. Save the tailored CV path in `jobs.db`.

Download links call `/api/cv-docx` or `/api/cv-pdf`.

### Tailor a Custom JD

Use the Custom page:

1. Paste the full job description.
2. Click Parse Job Description.
3. Review parsed details.
4. Click Tailor CV.

This stores the job in `custom_jobs.db` and runs `promote_custom_job.py`.

### Scheduled Scans

The repository contains:

```text
job-hunting-system/pipeline/forge-find.service
job-hunting-system/pipeline/forge-find.timer
```

The timer is configured for daily scans at 09:00 with a randomized delay.
Install it manually if needed:

```bash
mkdir -p ~/.config/systemd/user
cp job-hunting-system/pipeline/forge-find.service ~/.config/systemd/user/
cp job-hunting-system/pipeline/forge-find.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now forge-find.timer
systemctl --user list-timers forge-find.timer
```

## How the Main Workflows Work

### Search Workflow

```text
Dashboard /api/run
  -> run_pipeline.py --find-only
    -> scout_search.py
      -> source APIs
      -> agents/scout/outputs/listings_<run_id>.json
    -> matcher_score.py
      -> agents/matcher/outputs/matches_<run_id>.json
      -> jobs.db
    -> pipeline.db
    -> Hermes activity log
```

This workflow should not spend AI tokens. Activity records for non-AI work use
the model label `none - not required`.

### Promotion Workflow

```text
Dashboard /api/promote
  -> promote_job.py
    -> jobs.db cache check
    -> job_reader.py, if JD missing
    -> matcher_score.score_listing(..., mode="final")
    -> cv_adapter.py
    -> agents/cv-adapter/outputs/tailored_*.json
    -> jobs.db status/cv_path update
```

This workflow may spend AI tokens when Job Reader or CV Adapter calls Hermes.

### Custom JD Workflow

```text
Custom page pasted text
  -> /api/custom/parse-description
    -> job_reader.py --description-only
    -> parsed JD returned to UI
  -> /api/custom/promote
    -> promote_custom_job.py
    -> cv_adapter.py
    -> custom_jobs.db update
```

### CV Build Workflow

```text
CV upload
  -> /api/cv
    -> save base_cv_raw.*
    -> archive previous raw CV
    -> build_base_cv.py
      -> extract text
      -> write base_cv.txt
      -> structure base_cv.json
      -> merge profile fields into profile.json
```

## CV Output Format

Tailored CV content is stored as JSON. DOCX/PDF files are generated lazily when
downloaded.

The renderers:

- preserve the canonical template visual style;
- use Letter page size;
- use Arial-compatible typography;
- keep the section order from `template_cv.pdf`;
- keep design, font, visuals, and order stable;
- only change the tailored content.

Cached DOCX/PDF files are regenerated when the source JSON or renderer changes.

## Operational Notes

- `dashboard.sh` writes a PID file to `/tmp/forge-dashboard.pid`.
- Search concurrency is controlled by `.run-running`.
- Normal job promotion is controlled by files in `pipeline/.promoting`.
- Custom promotion is controlled by files in `pipeline/.custom_promoting`.
- Pipeline build logs go to `job-hunting-system/pipeline/build.log`.
- Dashboard logs go to `job-hunting-dashboard/dashboard.log`.
- SQLite databases use WAL mode where needed.

## Troubleshooting

Dashboard will not start:

```bash
job-hunting-dashboard/dashboard.sh status
tail -n 100 job-hunting-dashboard/dashboard.log
```

Search returns no jobs:

- Check `profile/profile.json` countries, sources, and short search queries.
- Check credentials in `~/.hermes/.env`.
- Run `scout_search.py` manually to see source notes.

Search fails:

```bash
~/.hermes/hermes-agent/venv/bin/python3 job-hunting-system/pipeline/run_pipeline.py --find-only
```

CV upload never finishes:

```bash
tail -f job-hunting-system/pipeline/build.log
ls -la job-hunting-system/cv/
```

Tailor CV fails:

- Confirm `job-hunting-system/cv/base_cv.json` exists.
- Confirm Hermes can run the `cv-adapter` profile.
- Check `~/.hermes/agent-logs.db` through the dashboard Activity stream.

PDF/DOCX download fails:

- Confirm the tailored JSON path exists under
  `job-hunting-system/agents/cv-adapter/outputs/`.
- Run the renderer directly:

```bash
~/.hermes/hermes-agent/venv/bin/python3 job-hunting-system/pipeline/cv_pdf.py \
  job-hunting-system/agents/cv-adapter/outputs/<tailored>.json
```

## Development Notes

- Keep frontend page logic inside its feature directory.
- Keep shared browser code in `static/src/shared`.
- Do not put feature-specific logic in `app/bootstrap.js` or `router.js`.
- Keep search and scoring deterministic unless AI is explicitly required.
- Prefer reusing cached JD/CV data before calling Hermes.
- Do not commit runtime databases, logs, generated outputs, or personal secrets.

