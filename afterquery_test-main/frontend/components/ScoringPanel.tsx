"use client";

import { useState, useEffect } from "react";
import { gradingApi, CriterionScore, Rubric, SubmissionScore } from "@/utils/grading-api";

interface ScoringPanelProps {
  inviteId: string;
  assessmentId: string;
}

export default function ScoringPanel({ inviteId, assessmentId }: ScoringPanelProps) {
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [existingScore, setExistingScore] = useState<SubmissionScore | null>(null);
  const [scores, setScores] = useState<Record<string, CriterionScore>>({});
  const [notes, setNotes] = useState("");
  const [gradedBy, setGradedBy] = useState("admin@example.com");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiGrading, setAiGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadData();
  }, [inviteId, assessmentId]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      // Load rubric
      const rubricData = await gradingApi.getRubric(assessmentId);
      setRubric(rubricData);

      // Initialize scores from rubric
      const initialScores: Record<string, CriterionScore> = {};
      rubricData.criteria.forEach((criterion: any) => {
        initialScores[criterion.name] = {
          score: 0,
          max_score: criterion.max_score || 5,
          notes: "",
        };
      });

      // Try to load existing score
      try {
        const existingScoreData = await gradingApi.getScore(inviteId);
        setExistingScore(existingScoreData);
        setScores(
          Object.keys(existingScoreData.criteria_scores).reduce((acc, key) => {
            acc[key] = existingScoreData.criteria_scores[key];
            return acc;
          }, {} as Record<string, CriterionScore>)
        );
        setNotes(existingScoreData.notes || "");
        setGradedBy(existingScoreData.graded_by || "admin@example.com");
      } catch {
        // No existing score, use initialized scores
        setScores(initialScores);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load rubric");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await gradingApi.createScore(inviteId, scores, gradedBy, notes);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await loadData(); // Reload to get updated data
    } catch (err: any) {
      setError(err?.message || "Failed to save score");
    } finally {
      setSaving(false);
    }
  }

  async function handleAIGrade() {
    if (!rubric) return;

    setAiGrading(true);
    setError(null);
    try {
      // Get criteria that can be AI-graded
      const aiCriteria = rubric.criteria
        .filter((c: any) => c.type === "manual" || c.type === "automated")
        .map((c: any) => c.name);

      const result = await gradingApi.aiGrade(inviteId, aiCriteria);

      // Merge AI scores with existing scores
      setScores((prev) => ({
        ...prev,
        ...result.criteria_scores,
      }));
    } catch (err: any) {
      setError(err?.message || "AI grading failed");
    } finally {
      setAiGrading(false);
    }
  }

  const updateScore = (criterionName: string, field: keyof CriterionScore, value: any) => {
    setScores((prev) => ({
      ...prev,
      [criterionName]: {
        ...prev[criterionName],
        [field]: value,
      },
    }));
  };

  const calculateTotalScore = () => {
    if (!rubric) return 0;

    let total = 0;
    rubric.criteria.forEach((criterion: any) => {
      const score = scores[criterion.name];
      if (score) {
        const normalized = (score.score / score.max_score) * 100;
        const weighted = normalized * criterion.weight;
        total += weighted;
      }
    });

    return total.toFixed(2);
  };

  if (loading) {
    return (
      <div className="border border-gray-300 rounded-lg p-6">
        <div className="text-center text-gray-500">Loading rubric...</div>
      </div>
    );
  }

  if (!rubric) {
    return (
      <div className="border border-gray-300 rounded-lg p-6">
        <div className="text-center text-gray-500">
          No grading rubric defined for this assessment.
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-300 rounded-lg p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">AI Grading</h3>
        <button
          onClick={handleAIGrade}
          disabled={aiGrading}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-semibold text-lg"
        >
          {aiGrading ? "AI Analyzing Code..." : "✨ Generate AI Score"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-300 text-green-700 px-4 py-3 rounded">
          Score saved successfully!
        </div>
      )}

      <div className="space-y-4">
        {rubric.criteria.map((criterion: any) => (
          <div key={criterion.name} className="border border-gray-200 rounded p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold">{criterion.name}</h4>
                <p className="text-sm text-gray-600">{criterion.description}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Weight: {(criterion.weight * 100).toFixed(0)}% | Max: {criterion.max_score}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                AI Score (0-100)
              </label>
              <div className="text-3xl font-bold text-purple-600">
                {scores[criterion.name]?.score || 0}/100
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Click "Generate AI Score" above to analyze this submission
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">AI Analysis</label>
              <div className="w-full px-3 py-2 border border-gray-200 rounded bg-gray-50 text-sm text-gray-700 min-h-[60px]">
                {scores[criterion.name]?.notes || "No analysis yet. Generate AI score to see detailed feedback."}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-4">
        <div className="text-2xl font-bold text-center mb-4">
          Total Score: {calculateTotalScore()}/100
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Graded By (email)
            </label>
            <input
              type="email"
              value={gradedBy}
              onChange={(e) => setGradedBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Overall Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              placeholder="Overall feedback for the candidate..."
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
          >
            {saving ? "Saving..." : existingScore ? "Update AI Grades" : "Save AI Grades"}
          </button>
        </div>
      </div>
    </div>
  );
}
