export type FindingSeverity = "low" | "medium" | "high";

export interface PackageSummary {
  exists: boolean;
  name: string | null;
  scripts: Record<string, string>;
  dependencyCount: number;
  devDependencyCount: number;
  hasTypeScriptDependency: boolean;
}

export interface FileSummary {
  path: string;
  lines: number;
  bytes: number;
}

export interface RepoStructure {
  topLevelDirs: string[];
  totalFiles: number;
  sourceFiles: number;
  testFiles: number;
  largestFiles: FileSummary[];
  riskyAreas: string[];
}

export interface RepoContext {
  targetPath: string;
  generatedAt: string;
  project: {
    isNodeProject: boolean;
    package: PackageSummary;
    hasTsconfig: boolean;
    hasReadme: boolean;
  };
  structure: RepoStructure;
  qualitySignals: string[];
}

export interface Finding {
  severity: FindingSeverity;
  title: string;
  summary: string;
  recommendation: string;
  source: "rule" | "mock-ai" | "mimo";
}

export interface ReviewResult {
  ruleFindings: Finding[];
  aiFindings: Finding[];
}

export interface AnalyzeOptions {
  target: string;
  out: string;
}

export interface AnalyzeResult {
  outputPath: string;
  context: RepoContext;
  review: ReviewResult;
  report: string;
}
