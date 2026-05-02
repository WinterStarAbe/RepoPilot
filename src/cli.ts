#!/usr/bin/env node
import { Command } from "commander";
import { analyzeRepository } from "./analyze.js";

const program = new Command();

program
  .name("repopilot")
  .description("AI-agent assisted TypeScript repository analysis CLI")
  .version("0.1.0");

program
  .command("analyze")
  .description("Analyze a repository and write a Markdown report")
  .option("--target <path>", "repository path to scan", ".")
  .option("--out <file>", "Markdown report output path", "reports/repopilot-report.md")
  .action(async (options: { target: string; out: string }) => {
    try {
      const result = await analyzeRepository({
        target: options.target,
        out: options.out
      });

      console.log(`RepoPilot report written to ${result.outputPath}`);
      console.log(
        `Scanned ${result.context.structure.totalFiles} files and produced ${result.review.ruleFindings.length + result.review.aiFindings.length} findings.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`RepoPilot analyze failed: ${message}`);
      process.exitCode = 1;
    }
  });

program.parseAsync();
