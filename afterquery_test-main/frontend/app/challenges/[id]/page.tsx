"use client";

import { useEffect, useState, useMemo } from "react";
import { api } from "@/utils/api";
import type { Assessment } from "@/components/ChallengeCreationForm";
import InviteForm from "@/components/InviteForm";

type Candidate = {
  id: string;
  email: string;
  full_name?: string | null;
};

type AssessmentInvite = {
  id: string;
  status: "pending" | "started" | "submitted" | string;
  created_at: string;
  start_deadline_at?: string | null;
  complete_deadline_at?: string | null;
  started_at?: string | null;
  submitted_at?: string | null;
  candidate: Candidate;
};

export default function ChallengeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invites, setInvites] = useState<AssessmentInvite[]>([]);
  const [activeTab, setActiveTab] = useState<
    "pending" | "started" | "submitted" | "all"
  >("all");

  const fetchInvites = () => {
    api
      .get<AssessmentInvite[]>(`/api/assessments/${id}/invites`)
      .then(setInvites)
      .catch(() => setInvites([]));
  };

  useEffect(() => {
    api
      .get<Assessment>(`/api/assessments/${id}`)
      .then(setAssessment)
      .catch((e) => setError(e?.message || "Failed to load challenge"));

    fetchInvites();
  }, [id]);

  const filteredInvites = useMemo(() => {
    const filtered =
      activeTab === "all"
        ? invites
        : invites.filter((i) => i.status === activeTab);

    // Sort by latest activity
    const copy = filtered.slice();
    copy.sort((a, b) => {
      const da = new Date(
        a.submitted_at || a.started_at || a.created_at
      ).getTime();
      const db = new Date(
        b.submitted_at || b.started_at || b.created_at
      ).getTime();
      return db - da;
    });
    return copy;
  }, [invites, activeTab]);

  return (
    <main>
      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4">
          {error}
        </div>
      ) : null}

      {assessment ? (
        <>
          <h1 className="text-2xl font-semibold mb-6">{assessment.title}</h1>

          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-6">
            <h2 className="text-lg font-medium mb-4">Challenge Details</h2>
            <div className="space-y-3 text-sm text-gray-600">
              <div>
                <strong>Seed repo:</strong>{" "}
                <a
                  href={assessment.seed_repo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {assessment.seed_repo_url}
                </a>
              </div>
              {assessment.description && (
                <div>
                  <strong>Description:</strong>
                  <p className="mt-1 whitespace-pre-wrap">
                    {assessment.description}
                  </p>
                </div>
              )}
              {assessment.instructions && (
                <div>
                  <strong>Instructions:</strong>
                  <p className="mt-1 whitespace-pre-wrap">
                    {assessment.instructions}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Submissions */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">
                Submissions ({invites.length})
              </h2>
              <a
                href={`/rankings?assessmentId=${id}`}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium no-underline"
              >
                View Rankings
              </a>
            </div>

            <div className="flex gap-6 mb-4">
              {(["all", "pending", "started", "submitted"] as const).map(
                (tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`bg-transparent border-none pb-2 text-sm cursor-pointer transition-all underline ${
                      activeTab === tab
                        ? "text-blue-600 font-medium border-b-2 border-blue-600"
                        : "text-gray-500 font-normal border-b-2 border-transparent"
                    }`}
                  >
                    {tab[0].toUpperCase() + tab.slice(1)}
                  </button>
                )
              )}
            </div>

            {filteredInvites.length === 0 ? (
              <div className="text-sm text-gray-500">No submissions.</div>
            ) : (
              <ul className="list-none p-0 space-y-3">
                {filteredInvites.map((inv) => (
                  <li
                    key={inv.id}
                    className="p-4 border border-gray-200 rounded-md hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="font-semibold mb-1">
                          {inv.candidate.full_name || inv.candidate.email}
                        </div>
                        <div className="text-xs text-gray-500">
                          {inv.candidate.email}
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-gray-600">
                          <div>
                            Invited: {new Date(inv.created_at).toLocaleString()}
                          </div>
                          <div>
                            Start by:{" "}
                            {inv.start_deadline_at
                              ? new Date(inv.start_deadline_at).toLocaleString()
                              : "—"}
                          </div>
                          <div>
                            Started:{" "}
                            {inv.started_at
                              ? new Date(inv.started_at).toLocaleString()
                              : "—"}
                          </div>
                          <div>
                            Complete by:{" "}
                            {inv.complete_deadline_at
                              ? new Date(
                                  inv.complete_deadline_at
                                ).toLocaleString()
                              : "—"}
                          </div>
                          {inv.submitted_at && (
                            <div>
                              Submitted:{" "}
                              {new Date(inv.submitted_at).toLocaleString()}
                            </div>
                          )}
                        </div>
                        <div className="mt-2 text-sm">
                          Status:{" "}
                          <span className="font-medium capitalize">
                            {inv.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {inv.status === "submitted" ? (
                          <a
                            href={`/review?inviteId=${inv.id}`}
                            className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-3 py-1.5 rounded-md no-underline"
                          >
                            Review
                          </a>
                        ) : inv.status === "started" ? (
                          <a
                            href={`/review?inviteId=${inv.id}`}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-3 py-1.5 rounded-md no-underline"
                          >
                            View Progress
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Invite Form */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-medium mb-4">
              Send to a New Candidate
            </h2>
            <InviteForm
              assessment={assessment as Assessment}
              onSuccess={fetchInvites}
            />
          </div>
        </>
      ) : (
        <div>Loading...</div>
      )}
    </main>
  );
}
