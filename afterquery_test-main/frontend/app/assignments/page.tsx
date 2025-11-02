"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/utils/api";

type Candidate = {
  id: string;
  email: string;
  full_name?: string | null;
};

type AssessmentLite = {
  id: string;
  title: string;
  seed_repo_url: string;
};

type AdminInvite = {
  id: string;
  status: "pending" | "started" | "submitted" | string;
  created_at: string;
  start_deadline_at?: string | null;
  complete_deadline_at?: string | null;
  started_at?: string | null;
  submitted_at?: string | null;
  candidate: Candidate;
  assessment: AssessmentLite;
};

async function fetchInvites(): Promise<AdminInvite[]> {
  return api.get<AdminInvite[]>("/api/invites/admin");
}

export default function AssignmentsPage() {
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [activeTab, setActiveTab] = useState<"pending" | "started" | "submitted" | "all">("pending");
  const [modalInvite, setModalInvite] = useState<AdminInvite | null>(null);

  useEffect(() => {
    fetchInvites().then(setInvites).catch(() => setInvites([]));
  }, []);

  const sorted = useMemo(() => {
    const base = activeTab === "all" ? invites : invites.filter((i) => i.status === activeTab);
    const copy = base.slice();
    copy.sort((a, b) => {
      const da = new Date(a.submitted_at || a.started_at || a.created_at).getTime();
      const db = new Date(b.submitted_at || b.started_at || b.created_at).getTime();
      return db - da; // latest first
    });
    return copy;
  }, [invites, activeTab]);

  return (
    <main>
      <h1 className="text-3xl font-semibold mb-6 text-gray-800">Assignments</h1>

      <div className="flex gap-6 mb-4">
        {(["pending", "started", "submitted", "all"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`bg-transparent border-none pb-2 text-sm cursor-pointer transition-all underline ${
              activeTab === tab ? "text-blue-600 font-medium border-b-2 border-blue-600" : "text-gray-500 font-normal border-b-2 border-transparent"
            }`}
          >
            {tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        {sorted.length === 0 ? (
          <div className="text-sm text-gray-500">No assignments.</div>
        ) : (
          <ul className="list-none p-0">
            {sorted.map((inv) => (
              <li key={inv.id} className="mb-4 p-4 border border-gray-200 rounded-md hover:border-gray-300 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold mb-1">{inv.candidate.full_name || inv.candidate.email}</div>
                    <div className="text-xs text-gray-500">{inv.candidate.email}</div>
                    <div className="mt-2 text-sm">Challenge: <span className="font-medium">{inv.assessment.title}</span></div>
                    <div className="text-xs text-gray-500">{inv.assessment.seed_repo_url}</div>
                    <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-gray-600">
                      <div>Invited: {new Date(inv.created_at).toLocaleString()}</div>
                      <div>Start by: {inv.start_deadline_at ? new Date(inv.start_deadline_at).toLocaleString() : "—"}</div>
                      <div>Started: {inv.started_at ? new Date(inv.started_at).toLocaleString() : "—"}</div>
                      <div>Complete by: {inv.complete_deadline_at ? new Date(inv.complete_deadline_at).toLocaleString() : "—"}</div>
                      {inv.submitted_at ? <div>Submitted: {new Date(inv.submitted_at).toLocaleString()}</div> : null}
                    </div>
                    <div className="mt-2 text-sm">Status: <span className="font-medium capitalize">{inv.status}</span></div>
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
                    ) : (
                      <button
                        onClick={() => setModalInvite(inv)}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm px-3 py-1.5 rounded-md border border-gray-300 cursor-pointer"
                      >
                        View Details
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modalInvite && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={() => setModalInvite(null)}>
          <div className="bg-white rounded-md p-5 max-w-xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">Assignment Details</h3>
              <button onClick={() => setModalInvite(null)} className="text-gray-500">×</button>
            </div>
            <div className="space-y-2 text-sm">
              <div><span className="font-medium">Candidate:</span> {modalInvite.candidate.full_name || "—"} ({modalInvite.candidate.email})</div>
              <div><span className="font-medium">Challenge:</span> {modalInvite.assessment.title}</div>
              <div className="text-xs text-gray-500">{modalInvite.assessment.seed_repo_url}</div>
              <div className="grid grid-cols-2 gap-3 mt-3 text-gray-700">
                <div>Invited: {new Date(modalInvite.created_at).toLocaleString()}</div>
                <div>Start by: {modalInvite.start_deadline_at ? new Date(modalInvite.start_deadline_at).toLocaleString() : "—"}</div>
                <div>Started: {modalInvite.started_at ? new Date(modalInvite.started_at).toLocaleString() : "—"}</div>
                <div>Complete by: {modalInvite.complete_deadline_at ? new Date(modalInvite.complete_deadline_at).toLocaleString() : "—"}</div>
                <div>Submitted: {modalInvite.submitted_at ? new Date(modalInvite.submitted_at).toLocaleString() : "—"}</div>
              </div>
              <div>Status: <span className="capitalize font-medium">{modalInvite.status}</span></div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setModalInvite(null)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm px-3 py-1.5 rounded-md border border-gray-300 cursor-pointer">Close</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


