/**
 * 六帽聊天室 API 路由
 */

import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { initSixHatsDb } from "../db/schema.js";
import {
  analyzeWithSixHats,
  formatAnalysisResult,
} from "../services/six-hats/index.js";
import type {
  SixHatsAnalysis,
  AnalysisStep,
  HatType,
} from "../services/six-hats/types.js";

const router = Router();

/**
 * 取得用戶 ID（從認證中間件）
 */
function getUserId(req: Request): string {
  return (req as any).userId || "anonymous";
}

// 定義資料庫相容的型別
interface SessionRow {
  id: string;
  topic: string;
  user_context: string;
  current_round: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  session_id: string;
  round: number;
  phase: string | null;
  role: string;
  content: string;
  key_points: string;
  referenced_hats: string;
  tools_used: string;
  created_at: string;
}

interface EvaluationRow {
  id: string;
  session_id: string;
  round: number;
  problem: string;
  cause: string;
  method: string;
  best_process: string;
  created_at: string;
}

/**
 * 建立新聊天室
 * POST /api/six-hats/sessions
 */
router.post("/sessions", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { topic, userContext } = req.body;

    if (!topic) {
      return res.status(400).json({ error: "topic is required" });
    }

    const db = initSixHatsDb(userId);
    const sessionId = uuidv4();

    // 建立 session
    db.prepare(`
      INSERT INTO six_hats_sessions (id, topic, user_context)
      VALUES (?, ?, ?)
    `).run(sessionId, topic, JSON.stringify(userContext || {}));

    res.json({
      session: {
        id: sessionId,
        userId,
        topic,
        userContext: userContext || {},
        currentRound: 0,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Create session error:", error);
    res.status(500).json({ error: "Failed to create session" });
  }
});

/**
 * 取得聊天室
 * GET /api/six-hats/sessions/:id
 */
router.get("/sessions/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const db = initSixHatsDb(userId);

    const sessionRow = db
      .prepare("SELECT * FROM six_hats_sessions WHERE id = ?")
      .get(id) as SessionRow | undefined;

    if (!sessionRow) {
      return res.status(404).json({ error: "Session not found" });
    }

    const messageRows = db
      .prepare(
        "SELECT * FROM six_hats_messages WHERE session_id = ? ORDER BY created_at"
      )
      .all(id) as MessageRow[];

    const evaluationRows = db
      .prepare(
        "SELECT * FROM six_hats_evaluations WHERE session_id = ? ORDER BY round"
      )
      .all(id) as EvaluationRow[];

    res.json({
      session: {
        id: sessionRow.id,
        userId,
        topic: sessionRow.topic,
        userContext: JSON.parse(sessionRow.user_context || "{}"),
        currentRound: sessionRow.current_round,
        status: sessionRow.status,
        createdAt: sessionRow.created_at,
        updatedAt: sessionRow.updated_at,
      },
      messages: messageRows.map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        round: row.round,
        phase: row.phase,
        role: row.role,
        content: row.content,
        keyPoints: JSON.parse(row.key_points || "[]"),
        referencedHats: JSON.parse(row.referenced_hats || "[]"),
        toolsUsed: JSON.parse(row.tools_used || "[]"),
        createdAt: row.created_at,
      })),
      evaluations: evaluationRows.map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        round: row.round,
        problem: JSON.parse(row.problem),
        cause: JSON.parse(row.cause),
        method: JSON.parse(row.method),
        bestProcess: JSON.parse(row.best_process),
        deliverable: (row as any).deliverable || null,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error("Get session error:", error);
    res.status(500).json({ error: "Failed to get session" });
  }
});

/**
 * 發送訊息（非串流）
 * POST /api/six-hats/sessions/:id/messages
 */
router.post("/sessions/:id/messages", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "content is required" });
    }

    const db = initSixHatsDb(userId);

    // 取得 session
    const sessionRow = db
      .prepare("SELECT * FROM six_hats_sessions WHERE id = ?")
      .get(id) as SessionRow | undefined;

    if (!sessionRow) {
      return res.status(404).json({ error: "Session not found" });
    }

    const round = sessionRow.current_round + 1;
    const now = new Date().toISOString();

    // 儲存用戶訊息
    const userMsgId = `${id}-${Date.now()}-user`;
    db.prepare(`
      INSERT INTO six_hats_messages
      (id, session_id, round, role, content, created_at)
      VALUES (?, ?, ?, 'user', ?, ?)
    `).run(userMsgId, id, round, content, now);

    // 組裝對話歷史（讓後續輪次聚焦在追問上）
    const previousMessages: string[] = [];
    if (round > 1) {
      const prevMsgs = db.prepare(
        "SELECT round, role, content FROM six_hats_messages WHERE session_id = ? AND round < ? ORDER BY created_at"
      ).all(id, round) as Array<{ round: number; role: string; content: string }>;
      const prevEvals = db.prepare(
        "SELECT round, problem, best_process FROM six_hats_evaluations WHERE session_id = ? AND round < ? ORDER BY round"
      ).all(id, round) as Array<{ round: number; problem: string; best_process: string }>;

      for (let r = 1; r < round; r++) {
        const userMsg = prevMsgs.find(m => m.round === r && m.role === 'user');
        const evalRow = prevEvals.find(e => e.round === r);
        let summary = `【第 ${r} 輪】`;
        if (userMsg) summary += `\n用戶問：${userMsg.content}`;
        if (evalRow) {
          const prob = JSON.parse(evalRow.problem);
          const bp = JSON.parse(evalRow.best_process);
          summary += `\n結論：${prob.statement}`;
          summary += `\n建議：${bp.recommendation}`;
        }
        previousMessages.push(summary);
      }
    }

    // 問題聚焦在當前追問
    const problem = round === 1
      ? content
      : `原始主題：${sessionRow.topic}\n\n用戶追問：${content}`;
    const userContext = JSON.parse(sessionRow.user_context || "{}");
    const analysis = await analyzeWithSixHats(problem, {
      onStep: (step: AnalysisStep) => {
        console.log(`[Six Hats] ${step.role}: ${step.status}`);
      },
    }, {
      sessionId: id,
      userId: getUserId(req),
      round,
      userContext,
      previousMessages,
    });

    // 儲存分析結果
    const messages: Array<{
      id: string;
      role: string;
      content: string;
      round: number;
      phase: string;
      keyPoints: string[];
    }> = [];

    // Blue Opening
    const blueOpeningId = `${id}-${Date.now()}-blue-opening`;
    db.prepare(`
      INSERT INTO six_hats_messages
      (id, session_id, round, phase, role, content, key_points, created_at)
      VALUES (?, ?, ?, 'opening', 'blue', ?, ?, ?)
    `).run(
      blueOpeningId,
      id,
      round,
      analysis.opening.summary,
      JSON.stringify([
        analysis.opening.problemDefinition,
        analysis.opening.goal,
      ]),
      now
    );
    messages.push({
      id: blueOpeningId,
      role: "blue",
      content: analysis.opening.summary,
      round,
      phase: "opening",
      keyPoints: [analysis.opening.problemDefinition, analysis.opening.goal],
    });

    // Five Hats
    for (const { hat, result } of analysis.hatResponses) {
      const msgId = `${id}-${Date.now()}-${hat}`;
      db.prepare(`
        INSERT INTO six_hats_messages
        (id, session_id, round, phase, role, content, key_points, created_at)
        VALUES (?, ?, ?, 'analysis', ?, ?, ?, ?)
      `).run(msgId, id, round, hat, result.content, JSON.stringify(result.keyPoints), now);
      messages.push({
        id: msgId,
        role: hat,
        content: result.content,
        round,
        phase: "analysis",
        keyPoints: result.keyPoints,
      });
    }

    // Blue Review
    const blueReviewId = `${id}-${Date.now()}-blue-review`;
    db.prepare(`
      INSERT INTO six_hats_messages
      (id, session_id, round, phase, role, content, created_at)
      VALUES (?, ?, ?, 'review', 'blue', ?, ?)
    `).run(blueReviewId, id, round, analysis.review.summary, now);
    messages.push({
      id: blueReviewId,
      role: "blue",
      content: analysis.review.summary,
      round,
      phase: "review",
      keyPoints: [],
    });

    // Evaluator
    const evalId = `eval-${id}-${round}`;
    db.prepare(`
      INSERT INTO six_hats_evaluations
      (id, session_id, round, problem, cause, method, best_process, deliverable, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      evalId,
      id,
      round,
      JSON.stringify(analysis.evaluation.problem),
      JSON.stringify(analysis.evaluation.cause),
      JSON.stringify(analysis.evaluation.method),
      JSON.stringify(analysis.evaluation.bestProcess),
      analysis.evaluation.deliverable || null,
      now
    );

    const evaluatorMsgId = `${id}-${Date.now()}-evaluator`;
    const evalSummary = `問題類型：${analysis.evaluation.problem.type}\n建議：${analysis.evaluation.bestProcess.recommendation}`;
    db.prepare(`
      INSERT INTO six_hats_messages
      (id, session_id, round, phase, role, content, created_at)
      VALUES (?, ?, ?, 'evaluation', 'evaluator', ?, ?)
    `).run(evaluatorMsgId, id, round, evalSummary, now);
    messages.push({
      id: evaluatorMsgId,
      role: "evaluator",
      content: evalSummary,
      round,
      phase: "evaluation",
      keyPoints: [],
    });

    // 更新 session
    db.prepare(`
      UPDATE six_hats_sessions
      SET current_round = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(round, id);

    res.json({
      messages: [
        { id: userMsgId, role: "user", content, round },
        ...messages,
      ],
      evaluation: {
        id: evalId,
        sessionId: id,
        round,
        ...analysis.evaluation,
        createdAt: now,
      },
    });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ error: "Failed to process message" });
  }
});

/**
 * 發送訊息（SSE 串流）
 * POST /api/six-hats/sessions/:id/messages/stream
 */
router.post("/sessions/:id/messages/stream", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "content is required" });
    }

    // 設定 SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const db = initSixHatsDb(userId);

    // 取得 session
    const sessionRow = db
      .prepare("SELECT * FROM six_hats_sessions WHERE id = ?")
      .get(id) as SessionRow | undefined;

    if (!sessionRow) {
      res.write(`data: ${JSON.stringify({ type: "error", message: "Session not found" })}\n\n`);
      return res.end();
    }

    const round = sessionRow.current_round + 1;
    res.write(`data: ${JSON.stringify({ type: "round_start", round })}\n\n`);

    // 組裝對話歷史（讓後續輪次聚焦在追問上）
    const previousMessages: string[] = [];
    if (round > 1) {
      const prevMsgs = db.prepare(
        "SELECT round, role, content FROM six_hats_messages WHERE session_id = ? AND round < ? ORDER BY created_at"
      ).all(id, round) as Array<{ round: number; role: string; content: string }>;
      const prevEvals = db.prepare(
        "SELECT round, problem, best_process FROM six_hats_evaluations WHERE session_id = ? AND round < ? ORDER BY round"
      ).all(id, round) as Array<{ round: number; problem: string; best_process: string }>;

      for (let r = 1; r < round; r++) {
        const userMsg = prevMsgs.find(m => m.round === r && m.role === 'user');
        const evalRow = prevEvals.find(e => e.round === r);
        let summary = `【第 ${r} 輪】`;
        if (userMsg) summary += `\n用戶問：${userMsg.content}`;
        if (evalRow) {
          const prob = JSON.parse(evalRow.problem);
          const bp = JSON.parse(evalRow.best_process);
          summary += `\n結論：${prob.statement}`;
          summary += `\n建議：${bp.recommendation}`;
        }
        previousMessages.push(summary);
      }
    }

    // 問題聚焦在當前追問
    const problem = round === 1
      ? content
      : `原始主題：${sessionRow.topic}\n\n用戶追問：${content}`;
    const userContext = JSON.parse(sessionRow.user_context || "{}");
    const analysis = await analyzeWithSixHats(problem, {
      onStep: (step: AnalysisStep) => {
        res.write(`data: ${JSON.stringify({ type: "step", step })}\n\n`);
      },
    }, {
      sessionId: id,
      userId: getUserId(req),
      round,
      userContext,
      previousMessages,
    });

    // 儲存結果（同上）
    const now = new Date().toISOString();

    // 儲存用戶訊息
    const userMsgId = `${id}-${Date.now()}-user`;
    db.prepare(`
      INSERT INTO six_hats_messages
      (id, session_id, round, role, content, created_at)
      VALUES (?, ?, ?, 'user', ?, ?)
    `).run(userMsgId, id, round, content, now);

    // 儲存 Blue Opening
    const blueOpeningId = `${id}-${Date.now()}-blue-opening`;
    db.prepare(`
      INSERT INTO six_hats_messages
      (id, session_id, round, phase, role, content, key_points, created_at)
      VALUES (?, ?, ?, 'opening', 'blue', ?, ?, ?)
    `).run(
      blueOpeningId,
      id,
      round,
      analysis.opening.summary,
      JSON.stringify([analysis.opening.problemDefinition, analysis.opening.goal]),
      now
    );

    // 儲存 Five Hats
    for (const { hat, result } of analysis.hatResponses) {
      const msgId = `${id}-${Date.now()}-${hat}`;
      db.prepare(`
        INSERT INTO six_hats_messages
        (id, session_id, round, phase, role, content, key_points, created_at)
        VALUES (?, ?, ?, 'analysis', ?, ?, ?, ?)
      `).run(msgId, id, round, hat, result.content, JSON.stringify(result.keyPoints), now);
    }

    // 儲存 Blue Review
    const blueReviewId = `${id}-${Date.now()}-blue-review`;
    db.prepare(`
      INSERT INTO six_hats_messages
      (id, session_id, round, phase, role, content, created_at)
      VALUES (?, ?, ?, 'review', 'blue', ?, ?)
    `).run(blueReviewId, id, round, analysis.review.summary, now);

    // 儲存 Evaluation
    const evalId = `eval-${id}-${round}`;
    db.prepare(`
      INSERT INTO six_hats_evaluations
      (id, session_id, round, problem, cause, method, best_process, deliverable, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      evalId,
      id,
      round,
      JSON.stringify(analysis.evaluation.problem),
      JSON.stringify(analysis.evaluation.cause),
      JSON.stringify(analysis.evaluation.method),
      JSON.stringify(analysis.evaluation.bestProcess),
      analysis.evaluation.deliverable || null,
      now
    );

    // 更新 session
    db.prepare(`
      UPDATE six_hats_sessions
      SET current_round = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(round, id);

    // 傳送完成事件
    res.write(`data: ${JSON.stringify({
      type: "done",
      analysis: {
        opening: analysis.opening,
        hatResponses: analysis.hatResponses,
        review: analysis.review,
        evaluation: analysis.evaluation,
      },
    })}\n\n`);

    res.end();
  } catch (error) {
    console.error("Stream error:", error);
    res.write(`data: ${JSON.stringify({ type: "error", message: "Stream failed" })}\n\n`);
    res.end();
  }
});

/**
 * 結束對話
 * POST /api/six-hats/sessions/:id/conclude
 */
router.post("/sessions/:id/conclude", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const db = initSixHatsDb(userId);

    // 更新狀態
    db.prepare(`
      UPDATE six_hats_sessions
      SET status = 'concluded', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    // 取得所有訊息和評估
    const messageRows = db
      .prepare(
        "SELECT * FROM six_hats_messages WHERE session_id = ? ORDER BY created_at"
      )
      .all(id) as MessageRow[];

    const evaluationRows = db
      .prepare(
        "SELECT * FROM six_hats_evaluations WHERE session_id = ? ORDER BY round"
      )
      .all(id) as EvaluationRow[];

    // 產生 Markdown 報告
    let report = "# 六帽思考分析報告\n\n";

    for (const evalRow of evaluationRows) {
      const problem = JSON.parse(evalRow.problem);
      const cause = JSON.parse(evalRow.cause);
      const method = JSON.parse(evalRow.method);
      const bestProcess = JSON.parse(evalRow.best_process);

      report += `## 第 ${evalRow.round} 輪分析\n\n`;
      report += `**問題**：${problem.statement}\n`;
      report += `**類型**：${problem.type}\n\n`;

      report += `### 原因分析\n`;
      report += `- 主要原因：${cause.primary.join("、")}\n`;
      report += `- 可控因素：${cause.controllable.join("、")}\n`;
      report += `- 不可控因素：${cause.uncontrollable.join("、")}\n\n`;

      report += `### 建議\n`;
      report += `${bestProcess.recommendation}\n\n`;

      report += `### 執行步驟\n`;
      for (const step of bestProcess.steps) {
        report += `${step.step}. ${step.action} (檢查點：${step.checkpoint})\n`;
      }
      report += "\n---\n\n";
    }

    res.json({ report });
  } catch (error) {
    console.error("Conclude error:", error);
    res.status(500).json({ error: "Failed to conclude session" });
  }
});

/**
 * 取得用戶所有聊天室
 * GET /api/six-hats/sessions
 */
router.get("/sessions", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const db = initSixHatsDb(userId);

    const rows = db
      .prepare("SELECT * FROM six_hats_sessions ORDER BY updated_at DESC")
      .all() as SessionRow[];

    res.json({
      sessions: rows.map((row) => ({
        id: row.id,
        userId,
        topic: row.topic,
        userContext: JSON.parse(row.user_context || "{}"),
        currentRound: row.current_round,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch (error) {
    console.error("List sessions error:", error);
    res.status(500).json({ error: "Failed to list sessions" });
  }
});

/**
 * 刪除聊天室
 * DELETE /api/six-hats/sessions/:id
 */
router.delete("/sessions/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const db = initSixHatsDb(userId);

    // 檢查 session 是否存在
    const sessionRow = db
      .prepare("SELECT id FROM six_hats_sessions WHERE id = ?")
      .get(id) as { id: string } | undefined;

    if (!sessionRow) {
      return res.status(404).json({ error: "Session not found" });
    }

    // 刪除相關資料（順序重要：先刪子表再刪主表）
    db.prepare("DELETE FROM six_hats_evaluations WHERE session_id = ?").run(id);
    db.prepare("DELETE FROM six_hats_messages WHERE session_id = ?").run(id);
    db.prepare("DELETE FROM six_hats_sessions WHERE id = ?").run(id);

    res.json({ success: true });
  } catch (error) {
    console.error("Delete session error:", error);
    res.status(500).json({ error: "Failed to delete session" });
  }
});

export default router;
