# RepoPilot 激勵計畫申請材料

## 項目一句話

RepoPilot 是一個 AI 多 Agent 程式碼庫分析 CLI，能掃描 TypeScript 專案，結合規則式檢查與 Gemini API 產生技術債、測試缺口與維護風險報告。

## 可直接貼到申請表的成果描述

我構建了一個名為 RepoPilot 的 AI 多 Agent 程式碼庫分析工具，用於解決 TypeScript 專案在快速迭代後常見的技術債累積、測試缺口、缺少標準化檢查流程，以及人工 code review 成本過高的問題。

RepoPilot 以 CLI 形式運作，可對指定 repository 執行自動掃描，分析 `package.json`、npm scripts、TypeScript 設定、README、原始碼分布、測試檔數量、最大檔案與潛在高風險區域。系統內部採用多 Agent 流程：`ExplorerAgent` 負責收集 repo 結構與設定脈絡，`ReviewerAgent` 負責結合規則式檢查與 AI provider 產生 findings，`ReportAgent` 負責輸出可提交、可審核的 Markdown 分析報告。

目前 MVP 已支援兩種 AI provider：`MockAiProvider` 用於穩定測試與可重現 demo，`GeminiProvider` 可透過 `GEMINI_API_KEY` 呼叫 Gemini API 產生真實模型 findings。MiMo provider 已保留同一介面的 placeholder，後續取得 MiMo API key 後可直接接入。整體流程包含長鏈分析步驟：掃描 repo 結構、建立專案上下文、執行規則檢查、呼叫 AI provider、解析模型輸出、整理 findings、生成 Markdown 報告。目前已完成自舉 demo，可用 RepoPilot 掃描 RepoPilot 自身 repo 並產生 `reports/repopilot-report.md` 作為成果證明。

## 核心痛點

- 技術債與測試缺口通常分散在 repo 各處，人工盤點耗時且不穩定。
- Code review 往往聚焦單次改動，難以持續評估整體專案健康度。
- 中小型團隊缺少可重複、可提交、可被審核的 repo 維護報告。
- AI coding 工具若只停留在聊天層，難以形成可驗證的工程閉環。

## 核心邏輯流

1. 使用者執行 CLI：

   ```powershell
   node dist/cli.js analyze --provider gemini
   ```

2. `ExplorerAgent` 掃描 repository：
   - package name
   - npm scripts
   - dependencies/devDependencies 數量
   - `tsconfig.json` 是否存在
   - README 是否存在
   - source/test file 數量
   - 最大檔案與高風險區域

3. `ReviewerAgent` 執行兩層分析：
   - 規則式 findings：例如缺少 test script、lint script、tsconfig、測試檔。
   - AI findings：透過 Gemini API 分析 repo context，回傳維護風險與建議。

4. `ReportAgent` 輸出 Markdown 報告：
   - 核心痛點
   - 掃描摘要
   - Agent 流程
   - 發現項目
   - 原始碼結構
   - 建議下一步
   - 申請表成果描述草稿

## 已完成證據

- GitHub repository: <https://github.com/WinterStarAbe/RepoPilot>
- CLI 指令：

  ```powershell
  node dist/cli.js analyze --provider gemini
  ```

- 報告輸出：

  ```text
  reports/repopilot-report.md
  ```

- 已驗證指令：

  ```powershell
  npm run build
  npm run lint
  npm test
  node dist/cli.js analyze --provider gemini
  ```

## Provider 設計

RepoPilot 沒有把模型寫死在流程中，而是設計了可插拔 provider 介面：

```ts
interface AiProvider {
  analyzeRepo(context: RepoContext): Promise<Finding[]>;
}
```

目前 provider 狀態：

- `MockAiProvider`: 穩定、可測試、可重現。
- `GeminiProvider`: 已可透過 `GEMINI_API_KEY` 呼叫 Gemini API。
- `MimoProvider`: 保留 placeholder，後續可用同一介面接入 MiMo API。

## 後續路線

1. 接入 MiMo API，讓同一份 repo context 可由 MiMo 模型產生 findings。
2. 增加 `PatchAgent`，針對高信心 findings 產生最小修復 patch。
3. 增加 PR 描述產生器，將分析報告轉成可提交到 GitHub PR 的摘要。
4. 加入 CI workflow，讓每次 push 都自動執行 build、lint、test 與自舉分析。
