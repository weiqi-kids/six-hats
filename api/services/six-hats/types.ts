/**
 * Six Hats 型別定義
 */

export type HatType = "white" | "red" | "black" | "yellow" | "green";

export type RoleType = "blue-opening" | HatType | "blue-review" | "evaluator";

export interface AnalysisStep {
  role: RoleType;
  status: "running" | "done" | "rerun";
  result?: unknown;
}

export interface AnalysisOptions {
  maxRetries?: number;
  onStep?: (step: AnalysisStep) => void;
}

export interface AnalysisContext {
  sessionId?: string;
  userId?: string;
  round?: number;
  previousMessages?: string[];
  userContext?: Record<string, string>;
  ragContext?: string;
}

// Blue Hat Opening
export interface BlueOpening {
  problemDefinition: string;
  goal: string;
  thinkingOrder: HatType[];
  summary: string;
}

// Hat Response
export interface HatResponse {
  content: string;
  keyPoints: string[];
  referencedHats?: HatType[];
  toolsUsed?: string[];
}

// Blue Hat Review
export interface BlueReview {
  completenessCheck: Record<HatType, { passed: boolean; note: string }>;
  boundaryViolations: string[];
  informationGaps: string[];
  conflicts: string[];
  rerunRequired: boolean;
  hatsToRerun: HatType[];
  rerunReasons: Record<string, string>;
  summary: string;
}

// Carnegie Evaluation
export interface CarnegieEvaluation {
  problem: {
    statement: string;
    type: "decision" | "emotion" | "resource" | "information";
  };
  cause: {
    primary: string[];
    controllable: string[];
    uncontrollable: string[];
  };
  method: {
    options: Array<{
      title: string;
      description: string;
      supportedBy: HatType[];
      opposedBy: HatType[];
    }>;
  };
  bestProcess: {
    recommendation: string;
    steps: Array<{
      step: number;
      action: string;
      checkpoint: string;
    }>;
  };
  deliverable?: string | null;
}

// Full Analysis Result
export interface SixHatsAnalysis {
  opening: BlueOpening;
  hatResponses: Array<{ hat: HatType; result: HatResponse }>;
  review: BlueReview;
  rerunResponses?: Array<{ hat: HatType; result: HatResponse }>;
  evaluation: CarnegieEvaluation;
}
