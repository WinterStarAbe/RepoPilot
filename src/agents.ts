import { promises as fs } from "node:fs";
import path from "node:path";
import type { AiProvider } from "./providers.js";
import type { Finding, FileSummary, RepoContext, ReviewResult } from "./types.js";

const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".cache",
  ".pytest_cache",
  "reports"
]);

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const TEST_PATTERN = /(^|[./\\_-])(test|spec)([./\\_-]|$)|__tests__/i;

export class ExplorerAgent {
  async explore(targetPath: string): Promise<RepoContext> {
    const resolvedTarget = path.resolve(targetPath);
    const stats = await statRequired(resolvedTarget);

    if (!stats.isDirectory()) {
      throw new Error(`Target path is not a directory: ${resolvedTarget}`);
    }

    const packageSummary = await readPackageSummary(resolvedTarget);
    const allFiles = await walkFiles(resolvedTarget);
    const sourceFiles = allFiles.filter((file) => SOURCE_EXTENSIONS.has(path.extname(file)));
    const testFiles = sourceFiles.filter((file) => TEST_PATTERN.test(file));
    const largestFiles = await summarizeLargestFiles(resolvedTarget, sourceFiles);
    const topLevelDirs = await readTopLevelDirs(resolvedTarget);
    const hasTsconfig = await exists(path.join(resolvedTarget, "tsconfig.json"));
    const hasReadme = await hasReadmeFile(resolvedTarget);

    const qualitySignals = buildQualitySignals({
      hasReadme,
      hasTsconfig,
      packageSummary,
      testFiles: testFiles.length
    });

    return {
      targetPath: resolvedTarget,
      generatedAt: new Date().toISOString(),
      project: {
        isNodeProject: packageSummary.exists,
        package: packageSummary,
        hasTsconfig,
        hasReadme
      },
      structure: {
        topLevelDirs,
        totalFiles: allFiles.length,
        sourceFiles: sourceFiles.length,
        testFiles: testFiles.length,
        largestFiles,
        riskyAreas: buildRiskyAreas(largestFiles, testFiles.length, hasTsconfig)
      },
      qualitySignals
    };
  }
}

export class ReviewerAgent {
  constructor(private readonly aiProvider: AiProvider) {}

  async review(context: RepoContext): Promise<ReviewResult> {
    const ruleFindings = buildRuleFindings(context);
    const aiFindings = await this.aiProvider.analyzeRepo(context);

    return {
      ruleFindings,
      aiFindings
    };
  }
}

export class ReportAgent {
  createReport(context: RepoContext, review: ReviewResult): string {
    return [
      "# RepoPilot Repository Analysis",
      "",
      "## 核心痛點",
      "",
      "中小型 TypeScript 專案容易在快速迭代後累積技術債、測試缺口與缺少標準化檢查流程。RepoPilot 透過多 Agent 流程把 repo 掃描、風險判斷與報告產出標準化，讓團隊能快速取得可行的維護建議。",
      "",
      "## 掃描摘要",
      "",
      `- Target: \`${context.targetPath}\``,
      `- Generated at: ${context.generatedAt}`,
      `- Node project: ${context.project.isNodeProject ? "yes" : "no"}`,
      `- Package name: ${context.project.package.name ?? "n/a"}`,
      `- TypeScript config: ${context.project.hasTsconfig ? "present" : "missing"}`,
      `- README: ${context.project.hasReadme ? "present" : "missing"}`,
      `- Total files: ${context.structure.totalFiles}`,
      `- Source files: ${context.structure.sourceFiles}`,
      `- Test files: ${context.structure.testFiles}`,
      "",
      "## Agent 流程",
      "",
      "1. ExplorerAgent: 掃描專案結構、package scripts、TypeScript 設定與檔案分布。",
      "2. ReviewerAgent: 結合規則式檢查與 AI provider findings，判斷品質風險與技術債。",
      "3. ReportAgent: 將掃描結果、風險與建議整理成可提交的 Markdown 報告。",
      "",
      "## 發現項目",
      "",
      ...renderFindings([...review.ruleFindings, ...review.aiFindings]),
      "",
      "## 原始碼結構",
      "",
      `- Top-level directories: ${context.structure.topLevelDirs.length > 0 ? context.structure.topLevelDirs.map((dir) => `\`${dir}\``).join(", ") : "none"}`,
      `- Risky areas: ${context.structure.riskyAreas.length > 0 ? context.structure.riskyAreas.join("; ") : "none"}`,
      "",
      "### Largest files",
      "",
      ...renderLargestFiles(context.structure.largestFiles),
      "",
      "## 建議下一步",
      "",
      "- 接入 MiMo API provider，將 mock findings 替換為真實模型推理結果。",
      "- 增加 patch generation agent，針對高信心問題產生最小修改建議。",
      "- 將 CLI 報告接到 PR 描述或 CI artifact，形成 review 閉環。",
      "",
      "## 申請表成果描述草稿",
      "",
      "我構建了一個名為 RepoPilot 的 AI 多 Agent 程式碼庫分析 CLI，用於解決 TypeScript 專案技術債、測試缺口與 code review 成本過高的問題。系統由 ExplorerAgent、ReviewerAgent 與 ReportAgent 協作，先掃描 repo 結構、package scripts、TypeScript 設定與檔案分布，再結合規則式檢查與可插拔 AI provider 產生風險 findings，最後輸出 Markdown 分析報告。第一版使用穩定的 MockAiProvider 驗證 Agent 流程，並保留 MiMo API provider 介面，後續可直接接入真實模型進行長鏈推理分析與重構建議。"
    ].join("\n");
  }
}

function buildRuleFindings(context: RepoContext): Finding[] {
  const findings: Finding[] = [];
  const scripts = context.project.package.scripts;

  if (!context.project.package.exists) {
    findings.push({
      severity: "medium",
      title: "No package.json detected",
      summary: "The target can be scanned, but it does not look like a standard Node/TypeScript project.",
      recommendation: "Add package.json if this repository should be managed as a Node CLI or application.",
      source: "rule"
    });
  }

  if (!scripts.test) {
    findings.push({
      severity: "high",
      title: "Missing test script",
      summary: "No npm test script was found, so automated verification is not standardized.",
      recommendation: "Add a test script and make it part of the repository validation workflow.",
      source: "rule"
    });
  }

  if (!scripts.lint) {
    findings.push({
      severity: "medium",
      title: "Missing lint script",
      summary: "No lint script was found, which reduces consistency in code quality checks.",
      recommendation: "Add a lint script using the project's preferred linter.",
      source: "rule"
    });
  }

  if (!context.project.hasTsconfig) {
    findings.push({
      severity: "high",
      title: "Missing tsconfig.json",
      summary: "TypeScript projects need a checked-in compiler configuration for stable builds.",
      recommendation: "Add tsconfig.json and validate it with a build script.",
      source: "rule"
    });
  }

  if (!context.project.hasReadme) {
    findings.push({
      severity: "low",
      title: "Missing README",
      summary: "No README was found, which makes project setup and review harder for new contributors.",
      recommendation: "Add setup, usage, and development commands to README.md.",
      source: "rule"
    });
  }

  if (context.structure.sourceFiles > 0 && context.structure.testFiles === 0) {
    findings.push({
      severity: "high",
      title: "Source exists without detected tests",
      summary: "Source files were found, but no test/spec files were detected.",
      recommendation: "Add tests for the CLI command path and report rendering behavior.",
      source: "rule"
    });
  }

  return findings;
}

async function statRequired(filePath: string) {
  try {
    return await fs.stat(filePath);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new Error(`Target path does not exist: ${filePath}`);
    }

    throw error;
  }
}

async function readPackageSummary(targetPath: string) {
  const packagePath = path.join(targetPath, "package.json");

  if (!(await exists(packagePath))) {
    return {
      exists: false,
      name: null,
      scripts: {},
      dependencyCount: 0,
      devDependencyCount: 0,
      hasTypeScriptDependency: false
    };
  }

  const raw = await fs.readFile(packagePath, "utf8");
  const parsed = JSON.parse(raw) as {
    name?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const dependencies = parsed.dependencies ?? {};
  const devDependencies = parsed.devDependencies ?? {};

  return {
    exists: true,
    name: parsed.name ?? null,
    scripts: parsed.scripts ?? {},
    dependencyCount: Object.keys(dependencies).length,
    devDependencyCount: Object.keys(devDependencies).length,
    hasTypeScriptDependency: "typescript" in dependencies || "typescript" in devDependencies
  };
}

async function walkFiles(root: string): Promise<string[]> {
  const output: string[] = [];

  async function visit(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }

      const absolute = path.join(current, entry.name);
      const relative = toPosix(path.relative(root, absolute));

      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile()) {
        output.push(relative);
      }
    }
  }

  await visit(root);
  return output.sort((a, b) => a.localeCompare(b));
}

async function summarizeLargestFiles(root: string, files: string[]): Promise<FileSummary[]> {
  const summaries = await Promise.all(
    files.map(async (file) => {
      const absolute = path.join(root, file);
      const [stats, content] = await Promise.all([fs.stat(absolute), fs.readFile(absolute, "utf8")]);

      return {
        path: file,
        lines: content.length === 0 ? 0 : content.split(/\r?\n/).length,
        bytes: stats.size
      };
    })
  );

  return summaries.sort((a, b) => b.lines - a.lines).slice(0, 5);
}

async function readTopLevelDirs(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory() && !EXCLUDED_DIRS.has(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function buildQualitySignals(input: {
  hasReadme: boolean;
  hasTsconfig: boolean;
  packageSummary: Awaited<ReturnType<typeof readPackageSummary>>;
  testFiles: number;
}): string[] {
  const signals: string[] = [];
  const scripts = input.packageSummary.scripts;

  if (!input.packageSummary.exists) signals.push("missing package.json");
  if (!scripts.test) signals.push("missing test script");
  if (!scripts.lint) signals.push("missing lint script");
  if (!input.hasReadme) signals.push("missing README");
  if (!input.hasTsconfig) signals.push("missing tsconfig.json");
  if (input.testFiles === 0) signals.push("no detected test files");

  return signals;
}

function buildRiskyAreas(largestFiles: FileSummary[], testFiles: number, hasTsconfig: boolean): string[] {
  const risks: string[] = [];
  const largeFiles = largestFiles.filter((file) => file.lines >= 300);

  if (largeFiles.length > 0) {
    risks.push(`large files: ${largeFiles.map((file) => file.path).join(", ")}`);
  }

  if (testFiles === 0) {
    risks.push("no test files detected");
  }

  if (!hasTsconfig) {
    risks.push("missing TypeScript compiler configuration");
  }

  return risks;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function hasReadmeFile(root: string): Promise<boolean> {
  const entries = await fs.readdir(root);
  return entries.some((entry) => /^readme(\.md|\.txt)?$/i.test(entry));
}

function renderFindings(findings: Finding[]): string[] {
  if (findings.length === 0) {
    return ["No findings detected."];
  }

  return findings.flatMap((finding) => [
    `### [${finding.severity.toUpperCase()}] ${finding.title}`,
    "",
    `- Source: ${finding.source}`,
    `- Summary: ${finding.summary}`,
    `- Recommendation: ${finding.recommendation}`,
    ""
  ]);
}

function renderLargestFiles(files: FileSummary[]): string[] {
  if (files.length === 0) {
    return ["No source files detected."];
  }

  return files.map((file) => `- \`${file.path}\`: ${file.lines} lines, ${file.bytes} bytes`);
}

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
