# six-hats

用 AI 多角色協作跑 Edward de Bono 的「六頂思考帽」平行思考法，最後用卡內基（Carnegie）框架收斂成一份結構化的決策報告。

## 分析流程

1. **Blue Hat 開場** — 定義問題、設定目標、決定這次要用什麼順序思考。
2. **五頂帽平行分析** — White（事實）、Red（情感）、Black（風險）、Yellow（機會）、Green（創意），各自獨立跑，互不干擾。
3. **Blue Hat 覆核** — 檢查完整性，判斷哪幾頂帽講得不夠，決定是否補跑。
4. **Carnegie Evaluator** — 整合所有帽子的結果，輸出「問題定義 → 原因分析 → 方案選項 → 建議流程」。

平行思考的重點是同一時間只戴一頂帽，避免正反意見在同一段對話裡互相消耗。這個系統把那個約束交給流程強制執行，而不是靠人自律。

## 架構

- `crawlers/` — 知識來源抓取、切塊、向量化（`sources.yaml` 定義來源）
- `api/` — 服務層，含 RAG 檢索、LLM 呼叫、SSE 串流回應
- `web/` — 前端
- `data/` — 向量庫與處理後的資料

## 常用指令

```bash
pnpm sync      # crawl + process，重建知識庫
pnpm query     # 命令列查詢
pnpm status    # 看知識庫狀態
pnpm dev       # 同時起 API 與前端
```

## 技術

TypeScript、Node.js、pnpm、tsx、pm2（`ecosystem.config.cjs`）。

---

Maintained by Light. I build and maintain websites with AI as a service: [arthurs.tw](https://arthurs.tw/?utm_source=github&utm_medium=readme&utm_campaign=oss)
