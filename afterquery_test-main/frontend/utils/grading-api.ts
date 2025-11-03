import { api } from "./api";

export interface RubricCriterion {
  name: string;
  description: string;
  weight: number;
  type?: string;
  scoring?: string;
  max_score?: number;
}

export interface Rubric {
  id: string;
  assessment_id: string;
  criteria: RubricCriterion[];
  created_at: string;
  updated_at: string;
}

export interface CriterionScore {
  score: number;
  max_score: number;
  notes?: string;
}

export interface SubmissionScore {
  id: string;
  invite_id: string;
  criteria_scores: Record<string, CriterionScore>;
  total_score: number;
  graded_by?: string;
  graded_at: string;
  notes?: string;
}

export interface RankingEntry {
  invite_id: string;
  candidate_id: string;
  candidate_email: string;
  candidate_name?: string;
  total_score: number;
  graded_at: string;
  status: string;
  submitted_at?: string;
}

export interface AIGradingResult {
  criteria_scores: Record<string, CriterionScore>;
  reasoning: Record<string, string>;
  model_used: string;
  tokens_used: number;
}

export const gradingApi = {
  // Rubrics
  createRubric: (assessmentId: string, criteria: RubricCriterion[]) =>
    api.post<Rubric>("/api/grading/rubrics", {
      assessment_id: assessmentId,
      criteria,
    }),

  getRubric: (assessmentId: string) =>
    api.get<Rubric>(`/api/grading/rubrics/assessment/${assessmentId}`),

  // Scores
  createScore: (inviteId: string, criteriaScores: Record<string, CriterionScore>, gradedBy: string, notes?: string) =>
    api.post<SubmissionScore>("/api/grading/scores", {
      invite_id: inviteId,
      criteria_scores: criteriaScores,
      graded_by: gradedBy,
      notes,
    }),

  getScore: (inviteId: string) =>
    api.get<SubmissionScore>(`/api/grading/scores/invite/${inviteId}`),

  // AI Grading
  aiGrade: (inviteId: string, criteriaToGrade: string[], model: string = "gpt-4o-mini") =>
    api.post<AIGradingResult>("/api/grading/ai-grade", {
      invite_id: inviteId,
      criteria_to_grade: criteriaToGrade,
      model,
    }),

  estimateCost: (inviteId: string, model: string = "gpt-4o-mini") =>
    api.post<{ estimated_tokens: number; estimated_cost_usd: number; model: string }>(
      `/api/grading/ai-grade/estimate-cost?invite_id=${inviteId}&model=${model}`,
    ),

  // Rankings
  getRankings: (assessmentId: string, status?: string) =>
    api.get<RankingEntry[]>(`/api/grading/rankings/assessment/${assessmentId}${status ? `?status=${status}` : ""}`),

  getUngraded: (assessmentId: string) =>
    api.get<any[]>(`/api/grading/rankings/ungraded/${assessmentId}`),
};
