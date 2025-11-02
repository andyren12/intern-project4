"use client";

import { useState, useEffect } from "react";
import ChallengeCreationForm, { Assessment } from "../../components/ChallengeCreationForm";
import { api } from "@/utils/api";

async function fetchAvailableAssessments(): Promise<Assessment[]> {
  return api.get<Assessment[]>("/api/assessments/?status=available");
}

async function fetchArchivedAssessments(): Promise<Assessment[]> {
  return api.get<Assessment[]>("/api/assessments/?status=archived");
}

export default function ChallengesPage() {
  // const [showSuccess, setShowSuccess] = useState(true);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [activeTab, setActiveTab] = useState<"available" | "archived">("available");
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Fetch assessments whenever the active tab changes
  useEffect(() => {
    const fetch = activeTab === "available" ? fetchAvailableAssessments : fetchArchivedAssessments;
    fetch().then(setAssessments).catch(() => setAssessments([]));
  }, [activeTab]);

  return (
    <main>
      {/* {showSuccess && (
        <div className="bg-green-100 border border-green-500 rounded px-4 py-3 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-green-800 text-sm">Welcome! You have signed up successfully.</span>
            <button 
              onClick={() => setShowSuccess(false)}
              className="bg-transparent border-none cursor-pointer text-lg text-green-800 p-0 w-6 h-6 hover:text-green-900"
            >
              ×
            </button>
          </div>
        </div>
      )} */}

      <h1 className="text-3xl font-semibold mb-6 text-gray-800">Challenges</h1>

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8 shadow-sm">
        <p className="mb-4 text-gray-700">To create a new challenge click below:</p>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-emerald-500 hover:bg-emerald-600 text-white border-none rounded-md px-5 py-2.5 text-sm font-medium cursor-pointer transition-colors"
        >
          Create Challenge
        </button>

        {showCreateForm && (
          <div className="mt-6">
            <ChallengeCreationForm
              onCreated={(assessment) => {
                setAssessments([...assessments, assessment]);
                setShowCreateForm(false);
              }}
            />
          </div>
        )}
      </div>

      <div className="mt-8">
        <div className="flex gap-6 mb-4">
          <button
            onClick={() => setActiveTab("available")}
            className={`bg-transparent border-none pb-2 text-sm cursor-pointer transition-all underline ${
              activeTab === "available" 
                ? "text-blue-600 font-medium border-b-2 border-blue-600" 
                : "text-gray-500 font-normal border-b-2 border-transparent"
            }`}
          >
            Available
          </button>
          <button
            onClick={() => setActiveTab("archived")}
            className={`bg-transparent border-none pb-2 text-sm cursor-pointer transition-all underline ${
              activeTab === "archived" 
                ? "text-blue-600 font-medium border-b-2 border-blue-600" 
                : "text-gray-500 font-normal border-b-2 border-transparent"
            }`}
          >
            Archived
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          {assessments.length === 0 ? (
            <div className="text-center py-10 px-5">
              <p className="text-base font-semibold mb-2 text-gray-800">
                No Challenges Found
              </p>
              <p className="text-sm text-gray-500 mb-2">
                You don&apos;t have any challenges available.
              </p>
              <p className="text-sm text-gray-500">
                If this is your first time here, why not{" "}
                <a 
                  href="#" 
                  onClick={(e) => {
                    e.preventDefault();
                    setShowCreateForm(true);
                  }}
                  className="text-blue-600 underline cursor-pointer hover:text-blue-700"
                >
                  create a challenge
                </a>{" "}
                to see how the process works?
              </p>
            </div>
          ) : (
            <ul className="list-none p-0">
              {assessments.map((a) => (
                <li key={a.id} className="mb-4 p-4 border border-gray-200 rounded-md hover:border-gray-300 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold mb-1">{a.title}</div>
                      <div className="text-xs text-gray-500">{a.seed_repo_url}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeTab === "available" ? (
                        <>
                          <a
                            href={`/challenges/${a.id}`}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1.5 rounded-md no-underline"
                          >
                            Invite
                          </a>
                          <button
                            onClick={async () => {
                              await api.put<Assessment>(`/api/assessments/${a.id}/archive`);
                              const updated = await fetchAvailableAssessments();
                              setAssessments(updated);
                            }}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm px-3 py-1.5 rounded-md border border-gray-300 cursor-pointer"
                          >
                            Archive
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={async () => {
                            await api.put<Assessment>(`/api/assessments/${a.id}/unarchive`);
                            const updated = await fetchArchivedAssessments();
                            setAssessments(updated);
                          }}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm px-3 py-1.5 rounded-md border border-gray-300 cursor-pointer"
                        >
                          Unarchive
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
