import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { analyzeRepository } from "../src/analyze.js";
import { ExplorerAgent } from "../src/agents.js";

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repopilot-"));
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe("RepoPilot analysis", () => {
  it("scans a TypeScript project and writes a Markdown report", async () => {
    await writeProject(tempRoot, {
      packageJson: {
        name: "fixture-app",
        scripts: {
          build: "tsc -p tsconfig.json",
          test: "vitest run",
          lint: "eslint ."
        },
        devDependencies: {
          typescript: "^5.7.2"
        }
      },
      files: {
        "tsconfig.json": "{}",
        "README.md": "# Fixture",
        "src/index.ts": "export const answer = 42;\n",
        "tests/index.test.ts": "import { expect, it } from 'vitest';\nit('works', () => expect(1).toBe(1));\n"
      }
    });

    const out = path.join(tempRoot, "reports", "report.md");
    const result = await analyzeRepository({ target: tempRoot, out });
    const report = await fs.readFile(out, "utf8");

    expect(result.context.project.package.name).toBe("fixture-app");
    expect(result.context.structure.sourceFiles).toBe(2);
    expect(result.context.structure.testFiles).toBe(1);
    expect(report).toContain("# RepoPilot Repository Analysis");
    expect(report).toContain("ExplorerAgent");
    expect(report).toContain("ReviewerAgent");
    expect(report).toContain("ReportAgent");
  });

  it("reports quality gaps for a project missing scripts and tests", async () => {
    await writeProject(tempRoot, {
      packageJson: {
        name: "thin-app",
        scripts: {}
      },
      files: {
        "src/index.ts": "export function run() { return true; }\n"
      }
    });

    const result = await analyzeRepository({
      target: tempRoot,
      out: path.join(tempRoot, "report.md")
    });
    const titles = [...result.review.ruleFindings, ...result.review.aiFindings].map((finding) => finding.title);

    expect(titles).toContain("Missing test script");
    expect(titles).toContain("Missing lint script");
    expect(titles).toContain("Missing tsconfig.json");
    expect(titles).toContain("No test files detected");
  });

  it("scans a non Node directory without failing", async () => {
    await fs.mkdir(path.join(tempRoot, "src"), { recursive: true });
    await fs.writeFile(path.join(tempRoot, "src", "index.ts"), "export {};\n");

    const result = await analyzeRepository({
      target: tempRoot,
      out: path.join(tempRoot, "report.md")
    });

    expect(result.context.project.isNodeProject).toBe(false);
    expect(result.review.ruleFindings.some((finding) => finding.title === "No package.json detected")).toBe(true);
  });

  it("rejects a missing target path", async () => {
    const explorer = new ExplorerAgent();

    await expect(explorer.explore(path.join(tempRoot, "missing"))).rejects.toThrow("Target path does not exist");
  });

  it("rejects a target path that is not a directory", async () => {
    const filePath = path.join(tempRoot, "file.ts");
    await fs.writeFile(filePath, "export {};\n");
    const explorer = new ExplorerAgent();

    await expect(explorer.explore(filePath)).rejects.toThrow("Target path is not a directory");
  });
});

async function writeProject(
  root: string,
  input: {
    packageJson: unknown;
    files: Record<string, string>;
  }
) {
  await fs.writeFile(path.join(root, "package.json"), JSON.stringify(input.packageJson, null, 2));

  for (const [relativePath, content] of Object.entries(input.files)) {
    const absolutePath = path.join(root, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content);
  }
}
