"use client";

import { useState } from "react";
import { api } from "@/utils/api";
import { gradingApi, RubricCriterion } from "@/utils/grading-api";
import RubricBuilder from "./RubricBuilder";

export type Assessment = {
  id: string;
  title: string;
  description?: string | null;
  instructions?: string | null;
  seed_repo_url: string;
  start_within_hours: number;
  complete_within_hours: number;
  created_at: string;
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
    <form onSubmit={handleSubmit} className="grid gap-3 max-w-2xl">
      <h3 className="m-0 text-xl font-semibold mb-2">Create Assessment</h3>
      {error ? <div className="text-red-700 text-sm py-1">{error}</div> : null}
      <label className="flex flex-col gap-1">
        <div className="text-sm font-medium">Title</div>
        <input 
          name="title" 
          placeholder="e.g., Full-Stack Take-Home" 
          required 
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </label>
      <label className="flex flex-col gap-1">
        <div className="text-sm font-medium">Seed GitHub Repo URL</div>
        <input 
          name="seed_repo_url" 
          placeholder="https://github.com/org/repo" 
          required 
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </label>
      <label className="flex flex-col gap-1">
        <div className="text-sm font-medium">Description</div>
        <textarea 
          name="description" 
          rows={2} 
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
        />
      </label>
      <label className="flex flex-col gap-1">
        <div className="text-sm font-medium">Instructions</div>
        <textarea 
          name="instructions" 
          rows={4} 
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
        />
      </label>
      <div className="flex gap-3">
        <label className="flex-1 flex flex-col gap-1">
          <div className="text-sm font-medium">Time to Start (hours)</div>
          <input
            name="start_within_hours"
            type="number"
            defaultValue={72}
            min={1}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </label>
        <label className="flex-1 flex flex-col gap-1">
          <div className="text-sm font-medium">Time to Complete (hours)</div>
          <input
            name="complete_within_hours"
            type="number"
            defaultValue={48}
            min={1}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </label>
      </div>

      <div className="border-t pt-4 mt-2">
        <h4 className="text-sm font-medium mb-3">Grading Rubric (Required)</h4>
        <div className="bg-gray-50 p-4 rounded-md">
          <RubricBuilder
            onCriteriaChange={setRubricCriteria}
            initialCriteria={rubricCriteria}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-gray-900 hover:bg-gray-800 text-white py-2 px-3 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Creating..." : "Create Assessment"}
      </button>
    </form>
  );
}
