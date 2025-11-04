"use client";

import { useState } from "react";
import { api } from "@/utils/api";
import { gradingApi, RubricCriterion } from "@/utils/grading-api";
import RubricBuilder from "./RubricBuilder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export type Assessment = {
  id: string;
  title: string;
  description?: string | null;
  instructions?: string | null;
  seed_repo_url: string;
  start_within_hours: number;
  complete_within_hours: number;
  created_at: string;
  calendly_link?: string | null;
  archived?: boolean;
};

export default function ChallengeCreationForm({ onCreated }: { onCreated?: (a: Assessment) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rubricCriteria, setRubricCriteria] = useState<RubricCriterion[]>([
    {
      name: "code_quality",
      description: "Evaluate code readability, maintainability, proper naming conventions, and adherence to best practices",
      weight: 0.34,
      type: "automated",
      scoring: "percentage",
      max_score: 100
    },
    {
      name: "design",
      description: "Assess architecture decisions, code organization, separation of concerns, and scalability",
      weight: 0.33,
      type: "automated",
      scoring: "percentage",
      max_score: 100
    },
    {
      name: "creativity",
      description: "Evaluate innovative solutions, unique approaches, and problem-solving creativity",
      weight: 0.33,
      type: "automated",
      scoring: "percentage",
      max_score: 100
    }
  ]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // Validate rubric criteria
    if (rubricCriteria.length === 0) {
      setError("Please add at least one grading criterion");
      return;
    }

    const totalWeight = rubricCriteria.reduce((sum, c) => sum + c.weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      setError(`Rubric weights must sum to 1.0 (currently ${totalWeight.toFixed(2)})`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Create assessment
      const payload = {
        title: String(formData.get("title") || "").trim(),
        description: String(formData.get("description") || "").trim() || undefined,
        instructions: String(formData.get("instructions") || "").trim() || undefined,
        seed_repo_url: String(formData.get("seed_repo_url") || "").trim(),
        start_within_hours: Number(formData.get("start_within_hours") || 72),
        complete_within_hours: Number(formData.get("complete_within_hours") || 48),
        calendly_link: String(formData.get("calendly_link") || "").trim() || undefined,
      };
      const created = await api.post<Assessment>("/api/assessments/", payload);

      // Create rubric (required)
      try {
        await gradingApi.createRubric(created.id, rubricCriteria);
      } catch (rubricError: any) {
        setError(`Assessment created but rubric failed: ${rubricError?.message || "Unknown error"}`);
        setLoading(false);
        return;
      }

      onCreated?.(created);
    } catch (e: any) {
      setError(e?.message || "Failed to create assessment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          placeholder="e.g., Full-Stack Take-Home"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="seed_repo_url">Seed GitHub Repo URL</Label>
        <Input
          id="seed_repo_url"
          name="seed_repo_url"
          placeholder="https://github.com/org/repo"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          placeholder="Brief description of the challenge..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="instructions">Instructions</Label>
        <Textarea
          id="instructions"
          name="instructions"
          rows={4}
          placeholder="Detailed instructions for candidates..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="calendly_link">Calendly Scheduling Link (Optional)</Label>
        <Input
          id="calendly_link"
          name="calendly_link"
          type="url"
          placeholder="https://calendly.com/your-name/assessment-name"
        />
        <p className="text-xs text-muted-foreground">
          Optional: Set a specific Calendly link for this assessment. If not provided, the default link from Settings will be used.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start_within_hours">Time to Start (hours)</Label>
          <Input
            id="start_within_hours"
            name="start_within_hours"
            type="number"
            defaultValue={72}
            min={1}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="complete_within_hours">Time to Complete (hours)</Label>
          <Input
            id="complete_within_hours"
            name="complete_within_hours"
            type="number"
            defaultValue={48}
            min={1}
          />
        </div>
      </div>

      <div className="border-t pt-6">
        <h4 className="text-sm font-semibold mb-4">Grading Rubric (Required)</h4>
        <div className="bg-muted/50 p-4 rounded-lg">
          <RubricBuilder
            onCriteriaChange={setRubricCriteria}
            initialCriteria={rubricCriteria}
          />
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Creating..." : "Create Assessment"}
      </Button>
    </form>
  );
}
