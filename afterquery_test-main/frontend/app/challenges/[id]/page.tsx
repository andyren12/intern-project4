"use client";

import { useEffect, useState } from "react";
import { api } from "@/utils/api";
import type { Assessment } from "@/components/ChallengeCreationForm";
import InviteForm from "@/components/InviteForm";

export default function ChallengeDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Assessment>(`/api/assessments/${id}`)
      .then(setAssessment)
      .catch((e) => setError(e?.message || "Failed to load challenge"));
  }, [id]);

  return (
    <main>
      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4">{error}</div>
      ) : null}

      {assessment ? (
        <>
          <h1 className="text-2xl font-semibold mb-2">Send a challenge to a candidate</h1>
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-medium mb-6">Assessment</h2>
            <p className="text-sm text-gray-600 mb-6"><strong>Title:</strong> {assessment.title}</p>
            <p className="text-sm text-gray-600 mb-6">
              <strong>Seed repo:</strong> <a href={assessment.seed_repo_url} target="_blank" rel="noopener noreferrer">{assessment.seed_repo_url}</a>
            </p>
            {assessment.description ? (
              <div className="text-sm text-gray-600 mb-6">
                <strong>Description:</strong>
                <p className="text-sm text-gray-600 mb-6 whitespace-pre-wrap">{assessment.description}</p>
              </div>
            ) : null}
            {assessment.instructions ? (
              <div className="text-sm text-gray-600 mb-6">
                <strong>Instructions:</strong>
                <p className="text-sm text-gray-600 mb-6 whitespace-pre-wrap">{assessment.instructions}</p>
              </div>
            ) : null}
          </div>
          <div className="mt-6 bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <InviteForm assessment={assessment as Assessment} />
          </div>
        </>
      ) : (
        <div>Loading...</div>
      )}
    </main>
  );
}


