"use client";

import { useEffect, useState } from "react";
import { api } from "@/utils/api";
import type { Assessment } from "@/components/ChallengeCreationForm";

export type Invite = {
  id: string;
  assessment_id: string;
  candidate_id: string;
  status: string;
  start_deadline_at?: string | null;
  complete_deadline_at?: string | null;
  start_url_slug?: string | null;
  created_at: string;
};

export default function InviteForm({ assessment }: { assessment?: Assessment }) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastInviteId, setLastInviteId] = useState<string | null>(null);

  useEffect(() => {
    if (assessment) {
      setAssessments([assessment]);
    } else {
      api
        .get<Assessment[]>("/api/assessments/?status=available")
        .then(setAssessments)
        .catch(() => setAssessments([]));
    }
  }, [assessment?.id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const email = String(formData.get("email") || "").trim();
      const full_name = String(formData.get("full_name") || "").trim();
      if (!assessment?.id || !email) throw new Error("Assessment and email are required");
      const created = await api.post<Invite>("/api/invites/", { assessment_id: assessment.id, email, full_name });
      setLastInviteId(created.id);
      setSuccess(`Invite created. Start slug: ${created.start_url_slug || "(pending)"}`);
      (e.currentTarget as HTMLFormElement)?.reset();
    } catch (e: any) {
      setError(e?.message || "Failed to create invite");
    } finally {
      setLoading(false);
    }
  }

  async function sendInviteEmail() {
    if (!lastInviteId) return;
    try {
      setError(null);
      setSuccess(null);
      await api.post(`/api/email/send-invite/${lastInviteId}`);
      setSuccess("Invite email sent.");
    } catch (e: any) {
      setError(e?.message || "Failed to send invite email");
    }
  }

  async function sendFollowupEmail() {
    if (!lastInviteId) return;
    try {
      setError(null);
      setSuccess(null);
      await api.post(`/api/review/followup/${lastInviteId}`);
      setSuccess("Follow-up email sent.");
    } catch (e: any) {
      setError(e?.message || "Failed to send follow-up email");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 max-w-2xl">
      <h3 className="m-0 text-xl font-semibold mb-2">Candidate Details</h3>
      {error ? <div className="text-red-700 text-sm py-1">{error}</div> : null}
      {success ? <div className="text-emerald-700 text-sm py-1">{success}</div> : null}
      <label className="flex flex-col gap-1">
        <div className="text-sm font-medium">Candidate Email</div>
        <input
          name="email"
          type="email"
          placeholder="candidate@example.com"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </label>
      <label className="flex flex-col gap-1">
        <div className="text-sm font-medium">Candidate Name</div>
        <input
          name="full_name"
          placeholder="Ada Lovelace"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Sending..." : "Send Invite"}
      </button>
    </form>
  );
}


