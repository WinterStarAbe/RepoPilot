# RepoPilot

RepoPilot is an AI-agent assisted TypeScript repository analysis CLI. It scans a repository, runs a deterministic multi-agent review flow, and writes a Markdown report that can be used for technical debt review, demo material, or AI incentive program submissions.

## Getting Started

```bash
npm install
npm run build
npm run lint
npm test
npm run analyze:self
```

## CLI

```bash
repopilot analyze --target . --out reports/repopilot-report.md
```

Defaults:

- `--target .`
- `--out reports/repopilot-report.md`
- `--provider mock`

Use Gemini when `GEMINI_API_KEY` is available:

```bash
GEMINI_API_KEY=your-key repopilot analyze --provider gemini --model gemini-2.5-flash
```

PowerShell:

```powershell
$env:GEMINI_API_KEY = "your-key"
repopilot analyze --provider gemini --model gemini-2.5-flash
```

## Agent Flow

1. `ExplorerAgent` scans repository structure, package scripts, TypeScript config, README presence, and file distribution.
2. `ReviewerAgent` combines rule-based checks with a pluggable AI provider.
3. `ReportAgent` renders the final Markdown report.

The MVP uses `MockAiProvider` for stable repeatable output, supports `GeminiProvider` through `GEMINI_API_KEY`, and keeps a `MimoProvider` placeholder for future MiMo API integration.
