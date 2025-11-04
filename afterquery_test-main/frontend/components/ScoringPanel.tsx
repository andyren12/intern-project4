"use client";

import { useState, useEffect } from "react";
import {
  gradingApi,
  CriterionScore,
  Rubric,
  SubmissionScore,
} from "@/utils/grading-api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Loader2, BrainCircuit, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface ScoringPanelProps {
  inviteId: string;
  assessmentId: string;
}

export default function ScoringPanel({
  inviteId,
  assessmentId,
}: ScoringPanelProps) {
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [existingScore, setExistingScore] = useState<SubmissionScore | null>(
    null
  );
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
      const rubricData = await gradingApi.getRubric(assessmentId);
      setRubric(rubricData);

      // Initialize blank scores
      const initialScores: Record<string, CriterionScore> = {};
      rubricData.criteria.forEach((criterion: any) => {
        initialScores[criterion.name] = {
          score: 0,
          max_score: criterion.max_score || 5,
          notes: "",
        };
      });

      // Load existing score if available
      try {
        const existing = await gradingApi.getScore(inviteId);
        setExistingScore(existing);
        setScores(existing.criteria_scores);
        setNotes(existing.notes || "");
        setGradedBy(existing.graded_by || "admin@example.com");
      } catch {
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
      toast.success("Scores saved successfully!");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
      await loadData();
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
      const aiCriteria = rubric.criteria
        .filter((c: any) => c.type === "manual" || c.type === "automated")
        .map((c: any) => c.name);

      const result = await gradingApi.aiGrade(inviteId, aiCriteria);

      setScores((prev) => ({
        ...prev,
        ...result.criteria_scores,
      }));

      toast.success("AI grading completed!");
    } catch (err: any) {
      toast.error("AI grading failed.");
      setError(err?.message || "AI grading failed");
    } finally {
      setAiGrading(false);
    }
  }

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
      <Card>
        <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading rubric...
        </CardContent>
      </Card>
    );
  }

  if (!rubric) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          No grading rubric defined for this assessment.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>AI Grading Overview</span>
            <Button
              onClick={handleAIGrade}
              disabled={aiGrading}
              variant="default"
              size="sm"
            >
              {aiGrading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Analyzing...
                </>
              ) : (
                <>
                  <BrainCircuit className="w-4 h-4 mr-2" /> Generate AI Score
                </>
              )}
            </Button>
          </CardTitle>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="border-green-300 bg-green-50 text-green-800 mb-4">
              <AlertDescription>
                <CheckCircle2 className="inline w-4 h-4 mr-1" />
                Scores saved successfully!
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-5 mt-4">
            {rubric.criteria.map((criterion: any) => (
              <Card key={criterion.name} className="border border-muted">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">
                    {criterion.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {criterion.description}
                  </p>
                  <div className="text-xs text-muted-foreground">
                    Weight: {(criterion.weight * 100).toFixed(0)}% | Max Score:{" "}
                    {criterion.max_score}
                  </div>

                  {/* Score slider or numeric field */}
                  <div className="flex justify-between items-center mt-2">
                    <div className="text-sm font-medium">Score</div>
                    <Input
                      type="number"
                      min={0}
                      max={criterion.max_score}
                      value={scores[criterion.name]?.score || 0}
                      onChange={(e) =>
                        setScores((prev) => ({
                          ...prev,
                          [criterion.name]: {
                            ...prev[criterion.name],
                            score: Number(e.target.value),
                          },
                        }))
                      }
                      className="w-24 text-right"
                    />
                  </div>

                  <Progress
                    value={
                      ((scores[criterion.name]?.score || 0) /
                        criterion.max_score) *
                      100
                    }
                  />

                  <div>
                    <label className="text-sm font-medium block mb-1">
                      AI Analysis
                    </label>
                    <Textarea
                      value={scores[criterion.name]?.notes || ""}
                      onChange={(e) =>
                        setScores((prev) => ({
                          ...prev,
                          [criterion.name]: {
                            ...prev[criterion.name],
                            notes: e.target.value,
                          },
                        }))
                      }
                      placeholder="AI or manual feedback..."
                      className="min-h-[80px]"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary & Save */}
      <Card>
        <CardHeader>
          <CardTitle>Final Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="text-center">
            <div className="text-3xl font-bold text-foreground mb-1">
              Total Score: {calculateTotalScore()} / 100
            </div>
            <Progress value={Number(calculateTotalScore())} className="mt-2" />
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium block mb-1">
                Graded By
              </label>
              <Input
                type="email"
                value={gradedBy}
                onChange={(e) => setGradedBy(e.target.value)}
                placeholder="Enter grader email"
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">
                Overall Notes
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Overall feedback for the candidate..."
                rows={3}
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              size="lg"
              className="w-full"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...
                </>
              ) : existingScore ? (
                "Update AI Grades"
              ) : (
                "Save AI Grades"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
