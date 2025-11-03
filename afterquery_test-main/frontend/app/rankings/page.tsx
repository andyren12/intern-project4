"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { gradingApi, RankingEntry } from "@/utils/grading-api";
import Link from "next/link";
import { API_BASE_URL } from "@/utils/api";

export default function RankingsPage() {
  const searchParams = useSearchParams();
  const assessmentId = searchParams.get("assessmentId");

  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [ungraded, setUngraded] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("submitted");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [emailTopNInput, setEmailTopNInput] = useState("5");
  const [sendingEmails, setSendingEmails] = useState(false);

  useEffect(() => {
    if (assessmentId) {
      loadRankings();
    }
  }, [assessmentId, statusFilter]);

  async function loadRankings() {
    if (!assessmentId) return;

    setLoading(true);
    setError(null);
    try {
      const [rankingsData, ungradedData] = await Promise.all([
        gradingApi.getRankings(assessmentId, statusFilter),
        gradingApi.getUngraded(assessmentId),
      ]);
      setRankings(rankingsData);
      setUngraded(ungradedData);
    } catch (err: any) {
      setError(err?.message || "Failed to load rankings");
    } finally {
      setLoading(false);
    }
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newRankings = [...rankings];
    const draggedItem = newRankings[draggedIndex];
    newRankings.splice(draggedIndex, 1);
    newRankings.splice(index, 0, draggedItem);

    setDraggedIndex(index);
    setRankings(newRankings);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const saveRankingsOrder = async () => {
    if (!assessmentId) return;

    setSaving(true);
    setError(null);
    try {
      // Create rankings array with manual_rank based on current order
      const rankingsToSave = rankings.map((entry, index) => ({
        invite_id: entry.invite_id,
        manual_rank: index + 1, // 1-indexed
      }));

      await gradingApi.updateRankingsOrder(assessmentId, rankingsToSave);
      await loadRankings(); // Reload to get updated data
    } catch (err: any) {
      setError(err?.message || "Failed to save rankings order");
    } finally {
      setSaving(false);
    }
  };

  const resetRankingsOrder = async () => {
    if (!assessmentId) return;
    if (!confirm("Reset to automatic score-based ranking?")) return;

    setSaving(true);
    setError(null);
    try {
      // Set all manual_rank to null to reset to score-based ordering
      const rankingsToSave = rankings.map((entry) => ({
        invite_id: entry.invite_id,
        manual_rank: null,
      }));

      await gradingApi.updateRankingsOrder(assessmentId, rankingsToSave);
      await loadRankings(); // Reload to get updated data
    } catch (err: any) {
      setError(err?.message || "Failed to reset rankings");
    } finally {
      setSaving(false);
    }
  };

  const sendBulkFollowupEmails = async () => {
    if (!assessmentId) return;

    const emailTopN = parseInt(emailTopNInput) || 1;
    if (!confirm(`Send follow-up emails to the top ${emailTopN} candidate${emailTopN !== 1 ? 's' : ''}?`)) return;

    setSendingEmails(true);
    setError(null);
    try {
      const result = await gradingApi.sendBulkFollowup(assessmentId, emailTopN, statusFilter);

      if (result.failed_count > 0) {
        alert(
          `Sent ${result.sent_count} emails successfully.\n` +
          `Failed to send ${result.failed_count} emails.\n\n` +
          `Failed recipients:\n${result.failed_emails.map((f) => `- ${f.email}: ${f.error}`).join("\n")}`
        );
      } else {
        alert(`Successfully sent follow-up emails to top ${emailTopN} candidate${emailTopN !== 1 ? 's' : ''}!`);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to send follow-up emails");
    } finally {
      setSendingEmails(false);
    }
  };

  if (!assessmentId) {
    return (
      <main className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-4">Rankings</h1>
        <p className="text-gray-600">
          Please provide an <code className="bg-gray-100 px-2 py-1 rounded">assessmentId</code> query parameter.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Example: <code className="bg-gray-100 px-2 py-1 rounded">/rankings?assessmentId=your-uuid</code>
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Candidate Rankings</h1>
        <p className="text-gray-600">Assessment ID: {assessmentId}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {rankings.length > 0 && (
        <div className="mb-4 flex gap-3 items-center">
          <button
            onClick={saveRankingsOrder}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {saving ? "Saving..." : "Save Manual Order"}
          </button>
          <button
            onClick={resetRankingsOrder}
            disabled={saving}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset to Score Order
          </button>
          <div className="flex-1"></div>
          <label className="text-sm font-medium text-gray-700">Top</label>
          <input
            type="number"
            min="1"
            max={rankings.length}
            value={emailTopNInput}
            onChange={(e) => setEmailTopNInput(e.target.value)}
            onBlur={() => {
              const num = parseInt(emailTopNInput);
              if (isNaN(num) || num < 1) {
                setEmailTopNInput("1");
              } else if (num > rankings.length) {
                setEmailTopNInput(rankings.length.toString());
              }
            }}
            className="w-20 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
          />
          <button
            onClick={sendBulkFollowupEmails}
            disabled={sendingEmails}
            className="px-4 py-2 bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50 font-medium"
          >
            {sendingEmails ? "Sending..." : "Send Follow-Up Emails"}
          </button>
        </div>
      )}

      <div className="mb-4 flex gap-4 items-center">
        <label className="text-sm font-medium">Filter by status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All</option>
          <option value="submitted">Submitted</option>
          <option value="started">Started</option>
        </select>
      </div>

      {ungraded.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 px-4 py-3 rounded mb-6">
          <div className="font-semibold">⚠ {ungraded.length} ungraded submission(s)</div>
          <ul className="mt-2 text-sm space-y-1">
            {ungraded.map((item) => (
              <li key={item.invite_id}>
                {item.candidate_name || item.candidate_email} -{" "}
                <Link
                  href={`/review?inviteId=${item.invite_id}`}
                  className="text-blue-600 hover:underline"
                >
                  Grade now
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading rankings...</div>
      ) : rankings.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No graded submissions yet.
        </div>
      ) : (
        <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Rank</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Candidate</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Score</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Submitted</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rankings.map((entry, index) => (
                <tr
                  key={entry.invite_id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`hover:bg-gray-50 cursor-move ${
                    draggedIndex === index ? "opacity-50" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-lg">⋮⋮</span>
                      <span
                        className={`
                          inline-flex items-center justify-center w-8 h-8 rounded-full font-bold
                          ${index === 0 ? "bg-yellow-400 text-yellow-900" : ""}
                          ${index === 1 ? "bg-gray-300 text-gray-900" : ""}
                          ${index === 2 ? "bg-orange-400 text-orange-900" : ""}
                          ${index > 2 ? "bg-gray-100 text-gray-700" : ""}
                        `}
                      >
                        {index + 1}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {entry.candidate_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{entry.candidate_email}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-lg font-bold text-gray-900">
                      {Number(entry.total_score).toFixed(1)}
                    </span>
                    <span className="text-sm text-gray-500">/100</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`
                        inline-block px-2 py-1 text-xs font-semibold rounded
                        ${entry.status === "submitted" ? "bg-green-100 text-green-800" : ""}
                        ${entry.status === "started" ? "bg-blue-100 text-blue-800" : ""}
                        ${entry.status === "pending" ? "bg-gray-100 text-gray-800" : ""}
                      `}
                    >
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {entry.submitted_at
                      ? new Date(entry.submitted_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-2">
                      <Link
                        href={`/review?inviteId=${entry.invite_id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Review
                      </Link>
                      <button
                        onClick={async () => {
                          if (!confirm(`Send follow-up email to ${entry.candidate_name || entry.candidate_email}?`)) return;
                          try {
                            await fetch(`${API_BASE_URL}/api/review/followup/${entry.invite_id}`, {
                              method: "POST",
                            });
                            alert("Follow-up email sent!");
                          } catch (err: any) {
                            alert(`Failed: ${err.message}`);
                          }
                        }}
                        className="text-violet-600 hover:underline font-medium"
                      >
                        Email
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rankings.length > 0 && (
        <div className="mt-6 bg-gray-50 border border-gray-300 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Statistics</h3>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Total Graded</div>
              <div className="text-2xl font-bold text-gray-900">{rankings.length}</div>
            </div>
            <div>
              <div className="text-gray-600">Average Score</div>
              <div className="text-2xl font-bold text-gray-900">
                {(
                  rankings.reduce((sum, r) => sum + Number(r.total_score), 0) / rankings.length
                ).toFixed(1)}
              </div>
            </div>
            <div>
              <div className="text-gray-600">Highest Score</div>
              <div className="text-2xl font-bold text-green-600">
                {Math.max(...rankings.map((r) => Number(r.total_score))).toFixed(1)}
              </div>
            </div>
            <div>
              <div className="text-gray-600">Lowest Score</div>
              <div className="text-2xl font-bold text-red-600">
                {Math.min(...rankings.map((r) => Number(r.total_score))).toFixed(1)}
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
