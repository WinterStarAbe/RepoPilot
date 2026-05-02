import { ReportAgent } from "./agents.js";
import type { RepoContext, ReviewResult } from "./types.js";

export function renderMarkdownReport(context: RepoContext, review: ReviewResult): string {
  return new ReportAgent().createReport(context, review);
}
