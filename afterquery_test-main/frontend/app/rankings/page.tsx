"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { gradingApi, RankingEntry } from "@/utils/grading-api";
import Link from "next/link";
import { API_BASE_URL } from "@/utils/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function RankingsPage() {
  const searchParams = useSearchParams();
  const assessmentId = searchParams.get("assessmentId");

  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [ungraded, setUngraded] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter] = useState<string>("all");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [emailTopNInput, setEmailTopNInput] = useState("5");
  const [sendingEmails, setSendingEmails] = useState(false);
  const [scheduleTopNInput, setScheduleTopNInput] = useState("5");
  const [sendingScheduling, setSendingScheduling] = useState(false);

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
      // Transform "all" to empty string for API
      const apiStatusFilter = statusFilter === "all" ? "" : statusFilter;
      const [rankingsData, ungradedData] = await Promise.all([
        gradingApi.getRankings(assessmentId, apiStatusFilter),
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
      // Keep current state without reloading
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
    if (
      !confirm(
        `Send follow-up emails to the top ${emailTopN} candidate${
          emailTopN !== 1 ? "s" : ""
        }?`
      )
    )
      return;

    setSendingEmails(true);
    setError(null);
    try {
      // Transform "all" to empty string for API
      const apiStatusFilter = statusFilter === "all" ? "" : statusFilter;
      const result = await gradingApi.sendBulkFollowup(
        assessmentId,
        emailTopN,
        apiStatusFilter
      );

      if (result.failed_count > 0) {
        alert(
          `Sent ${result.sent_count} emails successfully.\n` +
            `Failed to send ${result.failed_count} emails.\n\n` +
            `Failed recipients:\n${result.failed_emails
              .map((f) => `- ${f.email}: ${f.error}`)
              .join("\n")}`
        );
      } else {
        alert(
          `Successfully sent follow-up emails to top ${emailTopN} candidate${
            emailTopN !== 1 ? "s" : ""
          }!`
        );
      }
    } catch (err: any) {
      setError(err?.message || "Failed to send follow-up emails");
    } finally {
      setSendingEmails(false);
    }
  };

  const sendBulkSchedulingEmails = async () => {
    if (!assessmentId) return;

    const scheduleTopN = parseInt(scheduleTopNInput) || 1;
    if (
      !confirm(
        `Send scheduling invitations to the top ${scheduleTopN} candidate${
          scheduleTopN !== 1 ? "s" : ""
        }?`
      )
    )
      return;

    setSendingScheduling(true);
    setError(null);
    try {
      // Transform "all" to empty string for API
      const apiStatusFilter = statusFilter === "all" ? "" : statusFilter;
      const result = await gradingApi.sendBulkScheduling(
        assessmentId,
        scheduleTopN,
        apiStatusFilter
      );

      if (result.failed_count > 0) {
        alert(
          `Sent ${result.sent_count} scheduling invitations successfully.\n` +
            `Failed to send ${result.failed_count} invitations.\n\n` +
            `Failed recipients:\n${result.failed_emails
              .map((f) => `- ${f.email}: ${f.error}`)
              .join("\n")}`
        );
      } else {
        alert(
          `Successfully sent scheduling invitations to top ${scheduleTopN} candidate${
            scheduleTopN !== 1 ? "s" : ""
          }!`
        );
      }
    } catch (err: any) {
      setError(err?.message || "Failed to send scheduling invitations");
    } finally {
      setSendingScheduling(false);
    }
  };

  if (!assessmentId) {
    return (
      <main className="py-8 space-y-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Rankings</h1>
          <p className="text-muted-foreground">
            View and manage candidate rankings for assessments
          </p>
        </div>
        <Alert>
          <AlertDescription>
            Please provide an{" "}
            <code className="bg-muted px-2 py-1 rounded font-mono text-sm">
              assessmentId
            </code>{" "}
            query parameter.
            <br />
            <span className="text-xs mt-1 inline-block">
              Example:{" "}
              <code className="bg-muted px-2 py-1 rounded font-mono">
                /rankings?assessmentId=your-uuid
              </code>
            </span>
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  return (
    <main className="py-8 space-y-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          Candidate Rankings
        </h1>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {ungraded.length > 0 && (
        <Alert className="border-yellow-300 bg-yellow-50 text-yellow-800">
          <AlertDescription>
            <div className="font-semibold mb-2">
              ⚠ {ungraded.length} ungraded submission(s)
            </div>
            <ul className="text-sm space-y-1">
              {ungraded.map((item) => (
                <li key={item.invite_id}>
                  {item.candidate_name || item.candidate_email} -{" "}
                  <Link
                    href={`/review?inviteId=${item.invite_id}`}
                    className="text-primary hover:underline font-medium"
                  >
                    Grade now
                  </Link>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading rankings...
        </div>
      ) : rankings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No graded submissions yet.
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankings.map((entry, index) => (
                <TableRow
                  key={entry.invite_id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`cursor-move ${
                    draggedIndex === index ? "opacity-50" : ""
                  }`}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-lg">⋮⋮</span>
                      <span
                        className={`
                          inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm
                          ${index === 0 ? "bg-yellow-400 text-yellow-900" : ""}
                          ${index === 1 ? "bg-gray-300 text-gray-900" : ""}
                          ${index === 2 ? "bg-orange-400 text-orange-900" : ""}
                          ${index > 2 ? "bg-muted text-muted-foreground" : ""}
                        `}
                      >
                        {index + 1}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {entry.candidate_name || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.candidate_email}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-lg font-bold">
                      {Number(entry.total_score).toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">/100</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.submitted_at
                      ? new Date(entry.submitted_at).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/review?inviteId=${entry.invite_id}`}>
                          Review
                        </Link>
                      </Button>
                      <Button
                        onClick={async () => {
                          if (
                            !confirm(
                              `Send follow-up email to ${
                                entry.candidate_name || entry.candidate_email
                              }?`
                            )
                          )
                            return;
                          try {
                            await fetch(
                              `${API_BASE_URL}/api/review/followup/${entry.invite_id}`,
                              {
                                method: "POST",
                              }
                            );
                            alert("Follow-up email sent!");
                          } catch (err: any) {
                            alert(`Failed: ${err.message}`);
                          }
                        }}
                        variant="outline"
                        size="sm"
                      >
                        Email
                      </Button>
                      <Button
                        onClick={async () => {
                          if (
                            !confirm(
                              `Send scheduling invitation to ${
                                entry.candidate_name || entry.candidate_email
                              }?`
                            )
                          )
                            return;
                          try {
                            await fetch(
                              `${API_BASE_URL}/api/review/scheduling/${entry.invite_id}`,
                              {
                                method: "POST",
                              }
                            );
                            alert("Scheduling invitation sent!");
                          } catch (err: any) {
                            alert(`Failed: ${err.message}`);
                          }
                        }}
                        variant="outline"
                        size="sm"
                      >
                        Schedule
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {rankings.length > 0 && (
        <div className="flex justify-end gap-3">
          <Button
            onClick={saveRankingsOrder}
            disabled={saving}
            variant="default"
            size="sm"
          >
            {saving ? "Saving..." : "Save Order"}
          </Button>
          <Button
            onClick={resetRankingsOrder}
            disabled={saving}
            variant="secondary"
            size="sm"
          >
            Reset
          </Button>
        </div>
      )}

      {rankings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Bulk Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium">Send Follow-Up Emails</label>
                <div className="flex gap-2 items-center">
                  <span className="text-sm text-muted-foreground">Top</span>
                  <Input
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
                    className="w-20"
                  />
                  <Button
                    onClick={sendBulkFollowupEmails}
                    disabled={sendingEmails}
                    variant="default"
                    size="sm"
                  >
                    {sendingEmails ? "Sending..." : "Send Emails"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Schedule Meetings</label>
                <div className="flex gap-2 items-center">
                  <span className="text-sm text-muted-foreground">Top</span>
                  <Input
                    type="number"
                    min="1"
                    max={rankings.length}
                    value={scheduleTopNInput}
                    onChange={(e) => setScheduleTopNInput(e.target.value)}
                    onBlur={() => {
                      const num = parseInt(scheduleTopNInput);
                      if (isNaN(num) || num < 1) {
                        setScheduleTopNInput("1");
                      } else if (num > rankings.length) {
                        setScheduleTopNInput(rankings.length.toString());
                      }
                    }}
                    className="w-20"
                  />
                  <Button
                    onClick={sendBulkSchedulingEmails}
                    disabled={sendingScheduling}
                    variant="default"
                    size="sm"
                  >
                    {sendingScheduling ? "Sending..." : "Send Invites"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {rankings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">
                  Total Graded
                </div>
                <div className="text-2xl font-bold">{rankings.length}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">
                  Average Score
                </div>
                <div className="text-2xl font-bold">
                  {(
                    rankings.reduce(
                      (sum, r) => sum + Number(r.total_score),
                      0
                    ) / rankings.length
                  ).toFixed(1)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">
                  Highest Score
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {Math.max(
                    ...rankings.map((r) => Number(r.total_score))
                  ).toFixed(1)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">
                  Lowest Score
                </div>
                <div className="text-2xl font-bold text-red-600">
                  {Math.min(
                    ...rankings.map((r) => Number(r.total_score))
                  ).toFixed(1)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
