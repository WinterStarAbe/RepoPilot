import type { Finding, RepoContext } from "./types.js";

export interface AiProvider {
  analyzeRepo(context: RepoContext): Promise<Finding[]>;
}

export class MockAiProvider implements AiProvider {
  async analyzeRepo(context: RepoContext): Promise<Finding[]> {
    const findings: Finding[] = [
      {
        severity: "medium",
        title: "Agent workflow is available but still deterministic",
        summary:
          "The current MVP routes repository context through a provider interface, which proves the AI orchestration boundary without requiring a live model key.",
        recommendation:
          "Connect the provider interface to MiMo API once credentials and rate limits are available, then compare model findings with rule findings.",
        source: "mock-ai"
      }
    ];

    if (context.structure.testFiles === 0) {
      findings.push({
        severity: "high",
        title: "No test files detected",
        summary:
          "The repository does not currently show automated test coverage signals, which weakens safe refactoring confidence.",
        recommendation:
          "Add focused tests around CLI behavior and report generation before enabling automatic patch generation.",
        source: "mock-ai"
      });
    }

    if (context.structure.largestFiles.length > 0) {
      const largest = context.structure.largestFiles[0];
      findings.push({
        severity: largest.lines >= 300 ? "medium" : "low",
        title: "Largest file should be monitored for complexity",
        summary: `${largest.path} is currently the largest scanned file at ${largest.lines} lines.`,
        recommendation:
          "Track this file as the project grows and split responsibilities if it starts mixing CLI, scanning, and reporting logic.",
        source: "mock-ai"
      });
    }

    return findings;
  }
}

export class MimoProvider implements AiProvider {
  async analyzeRepo(): Promise<Finding[]> {
    throw new Error(
      "MimoProvider is reserved for the live MiMo API integration and is not configured in the MVP."
    );
  }
}
