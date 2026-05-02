import { promises as fs } from "node:fs";
import path from "node:path";
import { ExplorerAgent, ReviewerAgent } from "./agents.js";
import { createAiProvider } from "./providers.js";
import { renderMarkdownReport } from "./report.js";
import type { AnalyzeOptions, AnalyzeResult } from "./types.js";

export async function analyzeRepository(options: AnalyzeOptions): Promise<AnalyzeResult> {
  const target = path.resolve(options.target);
  const outputPath = path.resolve(options.out);
  const explorer = new ExplorerAgent();
  const reviewer = new ReviewerAgent(
    createAiProvider({
      provider: options.provider,
      model: options.model
    })
  );

  const context = await explorer.explore(target);
  const review = await reviewer.review(context);
  const report = renderMarkdownReport(context, review);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${report}\n`, "utf8");

  return {
    outputPath,
    context,
    review,
    report
  };
}
