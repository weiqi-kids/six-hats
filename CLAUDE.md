# six-hats 知識庫

## 概述

六頂思考帽（Six Thinking Hats）是 Edward de Bono 提出的平行思考方法論。
本系統使用 AI 多角色協作，從六個不同角度分析問題，最後以卡內基（Carnegie）框架產出結構化決策報告。

### 分析流程
1. **Blue Hat Opening** — 定義問題、設定目標、決定思考順序
2. **Five Hats 平行分析** — White（事實）、Red（情感）、Black（風險）、Yellow（機會）、Green（創意）
3. **Blue Hat Review** — 檢核完整性，決定是否補跑不足的帽子
4. **Carnegie Evaluator** — 整合所有帽子結果，產出：問題定義 → 原因分析 → 方案選項 → 建議流程

---

## 強制規則

- 修改程式碼前，必須先完整分析問題流程，禁止 trial-and-error
- 每次修改必須說明原因，不可以只貼 code 不解釋
- 嚴禁省略、截斷、或用 "..." 代替實際程式碼
- 遇到不確定的地方必須提問，不要猜測

---

## 架構規範（強制）

### 禁止事項
- ❌ **禁止**建立 `api/services/agents/` 目錄
- ❌ **禁止**在 `api/services/` 放置 `embedder.ts`、`vector-store.ts`、`chunker.ts`
  - 這些模組只能存在於 `crawlers/libs/`，API 層透過 `rag.ts` 間接使用
- ❌ **禁止**重寫 `api/services/llm.ts`（應從 triz-ai 複製，包含 createClient、RAG pipeline、scope check、self-check、flow trace）
- ❌ **禁止**重寫 `api/services/rag.ts`（應從 triz-ai 複製，包含 semanticSearch、動態閾值）
- ❌ **禁止**重寫 `api/routes/chat.ts`（應從 triz-ai 複製，包含 SSE streaming）
- ❌ **禁止**重寫 `crawlers/libs/` 下的模組（embedder, vector-store, chunker）

### 多角色分析系統

當知識庫需要「多角色/多步驟 AI 分析」時，**必須**遵循以下架構：

```
api/services/{domain}/
├── index.ts              # 主協調函數，onStep callback 回報進度
├── types.ts              # 型別定義
└── roles/                # 每個角色獨立模組
    └── {role}.ts         # export async function analyze(client, model, ...)
```

**參考實作**：`triz-ai/api/services/triz/`

**規範要點**：
1. 每個角色一個檔案，有獨立的 SYSTEM_PROMPT
2. 主協調函數接收 `onStep` callback，即時回報進度
3. 使用 SSE 串流回報給前端
4. 直接重用 llm.ts、rag.ts，不要重寫

### 驗證
在 agent.ThinkVault 根目錄執行：
```bash
./scripts/check-architecture.sh six-hats
```

---

## 環境設定 (.env)
```env
# OpenAI（優先）
OPENAI_API_KEY=sk-xxx
OPENAI_CHAT_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Azure OpenAI（備選）
# AZURE_OPENAI_ENDPOINT=
# AZURE_OPENAI_API_KEY=

# API
API_PORT=3000
JWT_SECRET=your-secret-key
WEB_URL=http://localhost:3001
```

---

## 資料架構

### 目錄結構
```
six-hats/
├── api/           # Express API
│   ├── index.ts   # 主入口
│   ├── routes/    # API 路由
│   ├── services/  # 業務邏輯
│   └── db/        # 資料庫
├── crawlers/      # 資料爬取
│   ├── libs/      # 共用模組
│   └── sources/   # 各資料來源
├── web/           # React 前端
└── data/          # 資料儲存
    ├── raw/       # 原始資料
    ├── chunks/    # 切分後文件
    ├── vectors/   # 向量資料 ⚠️ 被 gitignore
    ├── db/        # SQLite ⚠️ 被 gitignore
    └── reports/   # 同步報告
```

### 資料流程
```
抓取 (crawl) → 切分 (chunk) → 向量化 (embed) → 儲存 (vectors/*.json)
                                                       ↓
                    搜尋 (query) ← 向量相似度 ← API/Web
```

---

## 指令對照表

| 用戶說 | 執行指令 |
|--------|----------|
| 同步 | `pnpm run sync` |
| 測試: XXX | `pnpm run query "XXX"` |
| 狀態 | `pnpm run status` |
| 啟動開發 | `pnpm run dev` |
| 建置前端 | `pnpm run build:web` |
| 啟動生產 | `pnpm run start` |

---

## 部署流程

### 首次部署
```bash
# 1. Clone 專案
git clone <repo-url>
cd six-hats

# 2. 安裝依賴
pnpm install

# 3. 設定環境變數
cp .env.example .env
# 編輯 .env 填入正確的值

# 4. 同步資料
pnpm run sync

# 5. 建置前端
pnpm run build:web

# 6. 啟動服務
pnpm run start
```

### 更新部署
```bash
git pull
pnpm install
pnpm run build:web
pm2 restart six-hats
```

---

## 資料來源清單

見 `sources.yaml` 設定檔

---

## 技術架構

| 項目 | 選擇 |
|------|------|
| API 框架 | Express |
| 前端框架 | React + Vite + Tailwind |
| 資料庫 | SQLite (better-sqlite3) |
| 向量儲存 | JSON 檔案 |
| LLM | OpenAI GPT-4o |
| Embedding | text-embedding-3-small |
