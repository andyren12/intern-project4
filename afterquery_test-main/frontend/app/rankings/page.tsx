"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { gradingApi, RankingEntry } from "@/utils/grading-api";
import Link from "next/link";
import { API_BASE_URL, api } from "@/utils/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function RankingsPageContent() {
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
  const [followupSubject, setFollowupSubject] = useState("");
  const [followupBody, setFollowupBody] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [assessment, setAssessment] = useState<any>(null);
  const [availableAssessments, setAvailableAssessments] = useState<any[]>([]);
  const [nextStageId, setNextStageId] = useState<string>("none");
  const [includeNextStage, setIncludeNextStage] = useState(false);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  useEffect(() => {
    if (assessmentId) {
      loadRankings();
      loadAssessment();
      loadAvailableAssessments();
    }
  }, [assessmentId, statusFilter]);

  async function loadAssessment() {
    if (!assessmentId) return;
    try {
      const data = await api.get<any>(`/api/assessments/${assessmentId}`);
      setAssessment(data);
      setFollowupSubject(data.followup_subject || "");
      setFollowupBody(data.followup_body || "");
      // Transform null to "none" for Select component
      const hasNextStage = Boolean(data.next_stage_assessment_id);
      setNextStageId(data.next_stage_assessment_id || "none");
      setIncludeNextStage(hasNextStage);
    } catch (err) {
      console.error("Failed to load assessment:", err);
    }
  }

  async function loadAvailableAssessments() {
    try {
      const data = await api.get<any[]>("/api/assessments/?status=available");
      setAvailableAssessments(data);
    } catch (err) {
      console.error("Failed to load available assessments:", err);
    }
  }

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

  const confirmResetRankingsOrder = () => {
    setConfirmDialog({
      open: true,
      title: "Reset Rankings Order",
      description:
        "Reset to automatic score-based ranking? This will remove your manual ordering.",
      onConfirm: resetRankingsOrder,
    });
  };

  const resetRankingsOrder = async () => {
    if (!assessmentId) return;
    setConfirmDialog({ ...confirmDialog, open: false });

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

  const confirmSendBulkFollowupEmails = () => {
    const emailTopN = parseInt(emailTopNInput) || 1;
    setConfirmDialog({
      open: true,
      title: "Send Follow-Up Emails",
      description: `Send follow-up emails to the top ${emailTopN} candidate${
        emailTopN !== 1 ? "s" : ""
      }?`,
      onConfirm: sendBulkFollowupEmails,
    });
  };

  const sendBulkFollowupEmails = async () => {
    if (!assessmentId) return;
    setConfirmDialog({ ...confirmDialog, open: false });

    const emailTopN = parseInt(emailTopNInput) || 1;

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
        toast.warning(
          `Sent ${result.sent_count} emails successfully. Failed to send ${result.failed_count} emails.`,
          {
            description: result.failed_emails
              .map((f) => `${f.email}: ${f.error}`)
              .join(", "),
          }
        );
      } else {
        toast.success(
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

  const confirmSendBulkScheduling = () => {
    const scheduleTopN = parseInt(scheduleTopNInput) || 1;
    setConfirmDialog({
      open: true,
      title: "Send Scheduling Invitations",
      description: `Send scheduling invitations to the top ${scheduleTopN} candidate${
        scheduleTopN !== 1 ? "s" : ""
      }?`,
      onConfirm: sendBulkSchedulingEmails,
    });
  };

  const sendBulkSchedulingEmails = async () => {
    if (!assessmentId) return;
    setConfirmDialog({ ...confirmDialog, open: false });

    const scheduleTopN = parseInt(scheduleTopNInput) || 1;

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
        toast.warning(
          `Sent ${result.sent_count} scheduling invitations successfully. Failed to send ${result.failed_count} invitations.`,
          {
            description: result.failed_emails
              .map((f) => `${f.email}: ${f.error}`)
              .join(", "),
          }
        );
      } else {
        toast.success(
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

  const saveFollowupTemplate = async () => {
    if (!assessmentId) return;

    setSavingTemplate(true);
    try {
      // Save follow-up template
      await api.put(`/api/assessments/${assessmentId}/followup-template`, {
        followup_subject: followupSubject.trim() || null,
        followup_body: followupBody.trim() || null,
      });

      // Save next stage (only if checkbox is checked, otherwise clear it)
      const nextStageIdToSave =
        includeNextStage && nextStageId !== "none" ? nextStageId : null;
      await api.put(`/api/assessments/${assessmentId}/next-stage`, {
        next_stage_assessment_id: nextStageIdToSave,
      });

      toast.success("Follow-up settings saved!");
      await loadAssessment(); // Reload to get updated data
    } catch (err: any) {
      toast.error(`Failed to save: ${err.message || "Unknown error"}`);
    } finally {
      setSavingTemplate(false);
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
                        onClick={() => {
                          setConfirmDialog({
                            open: true,
                            title: "Send Follow-Up Email",
                            description: `Send follow-up email to ${
                              entry.candidate_name || entry.candidate_email
                            }?`,
                            onConfirm: async () => {
                              setConfirmDialog({
                                ...confirmDialog,
                                open: false,
                              });
                              try {
                                await fetch(
                                  `${API_BASE_URL}/api/review/followup/${entry.invite_id}`,
                                  {
                                    method: "POST",
                                  }
                                );
                                toast.success("Follow-up email sent!");
                              } catch (err: any) {
                                toast.error(`Failed: ${err.message}`);
                              }
                            },
                          });
                        }}
                        variant="outline"
                        size="sm"
                      >
                        Email
                      </Button>
                      <Button
                        onClick={() => {
                          setConfirmDialog({
                            open: true,
                            title: "Send Scheduling Invitation",
                            description: `Send scheduling invitation to ${
                              entry.candidate_name || entry.candidate_email
                            }?`,
                            onConfirm: async () => {
                              setConfirmDialog({
                                ...confirmDialog,
                                open: false,
                              });
                              try {
                                await fetch(
                                  `${API_BASE_URL}/api/review/scheduling/${entry.invite_id}`,
                                  {
                                    method: "POST",
                                  }
                                );
                                toast.success("Scheduling invitation sent!");
                              } catch (err: any) {
                                toast.error(`Failed: ${err.message}`);
                              }
                            },
                          });
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
            onClick={confirmResetRankingsOrder}
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
                <label className="text-sm font-medium">
                  Send Follow-Up Emails
                </label>
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
                    onClick={confirmSendBulkFollowupEmails}
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
                    onClick={confirmSendBulkScheduling}
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
            <CardTitle>Follow-Up Email Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Set a custom follow-up email template for this challenge. If
                  not set, the default template from Settings will be used.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="followup-subject">Email Subject</Label>
                  <Input
                    id="followup-subject"
                    value={followupSubject}
                    onChange={(e) => setFollowupSubject(e.target.value)}
                    placeholder="Follow-Up Interview Invitation"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="followup-body">Email Body (HTML)</Label>
                  <Textarea
                    id="followup-body"
                    value={followupBody}
                    onChange={(e) => setFollowupBody(e.target.value)}
                    placeholder="We'd like to schedule a follow-up interview..."
                    rows={6}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use{" "}
                    <code className="bg-muted px-1 py-0.5 rounded">
                      {"{candidate_name}"}
                    </code>{" "}
                    to insert the candidate's name
                  </p>
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-next-stage"
                    checked={includeNextStage}
                    onCheckedChange={(checked) =>
                      setIncludeNextStage(checked as boolean)
                    }
                  />
                  <Label
                    htmlFor="include-next-stage"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Include next round challenge in follow-up emails
                  </Label>
                </div>

                {includeNextStage && (
                  <div className="space-y-2 pl-6">
                    <p className="text-sm text-muted-foreground">
                      When candidates receive a follow-up email, they'll also
                      get information about the next assessment.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="next-stage">
                        Select Next Round Challenge *
                      </Label>
                      <Select
                        value={nextStageId}
                        onValueChange={setNextStageId}
                      >
                        <SelectTrigger id="next-stage">
                          <SelectValue placeholder="Select a challenge..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {availableAssessments
                            .filter((a) => a.id !== assessmentId)
                            .map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.title}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={saveFollowupTemplate}
                  disabled={
                    savingTemplate ||
                    (includeNextStage && nextStageId === "none")
                  }
                  size="sm"
                >
                  {savingTemplate ? "Saving..." : "Save Settings"}
                </Button>
                <Button
                  onClick={() => {
                    setFollowupSubject("");
                    setFollowupBody("");
                    setIncludeNextStage(false);
                    setNextStageId("none");
                  }}
                  variant="outline"
                  size="sm"
                >
                  Clear All
                </Button>
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

      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() =>
                setConfirmDialog({ ...confirmDialog, open: false })
              }
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDialog.onConfirm}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

export default function RankingsPage() {
  return (
    <Suspense fallback={<div className="py-8 text-center">Loading...</div>}>
      <RankingsPageContent />
    </Suspense>
  );
}
