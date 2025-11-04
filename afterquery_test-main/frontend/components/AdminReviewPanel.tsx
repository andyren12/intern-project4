"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/utils/api";
import ScoringPanel from "./ScoringPanel";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Loader2,
  GitBranch,
  FileDiff,
  MessageSquare,
  Mail,
} from "lucide-react";

export type ReviewData = {
  invite: {
    id: string;
    status: string;
    started_at?: string | null;
    submitted_at?: string | null;
  };
  assessment: { id: string; title: string; seed_repo_url: string };
  candidate: { id: string; email: string; full_name?: string | null };
  repo?: {
    full_name: string;
    pinned_main_sha?: string | null;
    archived: boolean;
  } | null;
  submission?: { final_sha?: string | null; submitted_at: string } | null;
  commits: any[];
  diff: {
    against: { seed_repo: string; branch: string };
    files_changed: any[];
  };
};

export default function AdminReviewPanel({ data }: { data: ReviewData }) {
  const { invite, assessment, candidate, repo, submission, commits, diff } =
    data;

  // Data states
  const [followups, setFollowups] = useState<any[]>([]);
  const [followupsLoading, setFollowupsLoading] = useState(true);
  const [diffFiles, setDiffFiles] = useState<any[]>([]);
  const [diffLoading, setDiffLoading] = useState(true);
  const [inlineComments, setInlineComments] = useState<any[]>([]);
  const [inlineLoading, setInlineLoading] = useState(true);
  const [overallText, setOverallText] = useState("");
  const [savingOverall, setSavingOverall] = useState(false);
  const [overallComments, setOverallComments] = useState<any[]>([]);
  const [overallLoading, setOverallLoading] = useState(true);

  // --- Data fetching ---
  useEffect(() => {
    fetchData(
      `${API_BASE_URL}/api/review/followup/${invite.id}`,
      setFollowups,
      setFollowupsLoading
    );
    fetchData(
      `${API_BASE_URL}/api/review/diff/${invite.id}`,
      setDiffFiles,
      setDiffLoading
    );
    fetchData(
      `${API_BASE_URL}/api/review/inline-comments/${invite.id}`,
      setInlineComments,
      setInlineLoading
    );
    fetchData(
      `${API_BASE_URL}/api/review/comments/${invite.id}`,
      setOverallComments,
      setOverallLoading
    );
  }, [invite.id]);

  const fetchData = (
    url: string,
    setState: React.Dispatch<React.SetStateAction<any>>,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then(setState)
      .finally(() => setLoading(false));
  };

  async function sendFollowUp() {
    try {
      await fetch(`${API_BASE_URL}/api/review/followup/${invite.id}`, {
        method: "POST",
      });
      toast.success("Follow-up email sent!");
      fetchData(
        `${API_BASE_URL}/api/review/followup/${invite.id}`,
        setFollowups,
        setFollowupsLoading
      );
    } catch {
      toast.error("Failed to send follow-up email.");
    }
  }

  // --- Render ---
  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{assessment.title}</span>
            <Badge variant="secondary">{invite.status.toUpperCase()}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <div>Seed Repo: {assessment.seed_repo_url}</div>
          <div>Branch: {diff.against.branch}</div>
          <div>
            Candidate:{" "}
            <span className="font-medium text-foreground">
              {candidate.full_name || candidate.email}
            </span>{" "}
            ({candidate.email})
          </div>
          <div>
            {invite.started_at && (
              <>
                Started: {new Date(invite.started_at).toLocaleString()} &middot;{" "}
              </>
            )}
            {invite.submitted_at && (
              <>Submitted: {new Date(invite.submitted_at).toLocaleString()}</>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="submission">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="submission">Submission</TabsTrigger>
          <TabsTrigger value="commits">Commits</TabsTrigger>
          <TabsTrigger value="diff">Diff</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="scoring">Scoring</TabsTrigger>
        </TabsList>

        {/* Submission Tab */}
        <TabsContent value="submission">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-4 h-4" /> Submission
              </CardTitle>
            </CardHeader>
            <CardContent>
              {submission ? (
                <div className="space-y-3 text-sm">
                  <div>
                    Final SHA:{" "}
                    <code className="text-primary">
                      {submission.final_sha || "(unknown)"}
                    </code>
                  </div>
                  <div>
                    Submitted At:{" "}
                    {new Date(submission.submitted_at).toLocaleString()}
                  </div>

                  <Button onClick={sendFollowUp} size="sm" className="mt-3">
                    Send Follow-Up
                  </Button>

                  <div>
                    <h4 className="font-semibold mb-2">Follow-Up History</h4>
                    {followupsLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : followups.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        No follow-ups yet.
                      </p>
                    ) : (
                      <ul className="divide-y text-sm">
                        {followups.map((f) => (
                          <li key={f.id} className="py-1 flex justify-between">
                            <span>{f.template_subject}</span>
                            <span className="text-muted-foreground text-xs">
                              {new Date(f.sent_at).toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Not submitted yet. Status: <b>In Progress</b>
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commits Tab */}
        <TabsContent value="commits">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="w-4 h-4" /> Commit History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {commits.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No commits found.
                </p>
              ) : (
                <ul className="divide-y">
                  {commits.map((c: any, idx: number) => (
                    <li key={idx} className="py-2 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{c.message}</span>
                        <span className="text-muted-foreground">
                          {c.author_name}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.sha.slice(0, 10)} •{" "}
                        {new Date(c.date).toLocaleString()}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Diff Tab */}
        <TabsContent value="diff">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileDiff className="w-4 h-4" /> Diff vs Seed
              </CardTitle>
            </CardHeader>
            <CardContent>
              {diffLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : diffFiles.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No differences found.
                </p>
              ) : (
                diffFiles.map((f) => (
                  <Card key={f.filename} className="mb-3 border-muted">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-mono text-blue-700">
                        {f.filename}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground mb-1">
                        +{f.additions} -{f.deletions} • {f.status}
                      </p>
                      {f.patch ? (
                        <pre className="bg-muted p-2 rounded text-xs overflow-auto">
                          {f.patch}
                        </pre>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No patch available.
                        </p>
                      )}
                      <InlineCommentsSection
                        inviteId={invite.id}
                        filename={f.filename}
                        inlineComments={inlineComments}
                        inlineLoading={inlineLoading}
                        refresh={() =>
                          fetchData(
                            `${API_BASE_URL}/api/review/inline-comments/${invite.id}`,
                            setInlineComments,
                            setInlineLoading
                          )
                        }
                      />
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feedback Tab */}
        <TabsContent value="feedback">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Overall Feedback
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overallLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : overallComments.length === 0 ? (
                <p className="text-muted-foreground text-sm mb-3">
                  No feedback yet.
                </p>
              ) : (
                <ul className="divide-y mb-3 text-sm">
                  {overallComments.map((c) => (
                    <li key={c.id} className="py-2 flex justify-between">
                      <span>{c.message}</span>
                      <span className="text-muted-foreground text-xs">
                        {new Date(c.created_at).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!overallText.trim()) return;
                  setSavingOverall(true);
                  await fetch(
                    `${API_BASE_URL}/api/review/comments/${invite.id}`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        user_type: "admin",
                        author_email: "admin@yourdomain.com",
                        author_name: "Admin",
                        message: overallText.trim(),
                      }),
                    }
                  );
                  setOverallText("");
                  setSavingOverall(false);
                  fetchData(
                    `${API_BASE_URL}/api/review/comments/${invite.id}`,
                    setOverallComments,
                    setOverallLoading
                  );
                }}
                className="space-y-2"
              >
                <Textarea
                  placeholder="Share overall feedback..."
                  value={overallText}
                  onChange={(e) => setOverallText(e.target.value)}
                />
                <Button
                  type="submit"
                  disabled={savingOverall || !overallText.trim()}
                >
                  {savingOverall ? "Sending..." : "Send Feedback"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scoring Tab */}
        <TabsContent value="scoring">
          <ScoringPanel inviteId={invite.id} assessmentId={assessment.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Inline Comment Section ---------------- */
function InlineCommentsSection({
  inviteId,
  filename,
  inlineComments,
  inlineLoading,
  refresh,
}: {
  inviteId: string;
  filename: string;
  inlineComments: any[];
  inlineLoading: boolean;
  refresh: () => void;
}) {
  return (
    <div className="space-y-2">
      <h4 className="font-medium text-sm">Inline Comments</h4>
      {inlineLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <ul className="text-xs space-y-1">
          {inlineComments.filter((c) => c.file_path === filename).length ===
          0 ? (
            <li className="text-muted-foreground">No comments yet.</li>
          ) : (
            inlineComments
              .filter((c) => c.file_path === filename)
              .map((c) => (
                <li key={c.id} className="flex justify-between">
                  <span>{c.message}</span>
                  <span className="text-muted-foreground">
                    L{c.line} • {new Date(c.created_at).toLocaleString()}
                  </span>
                </li>
              ))
          )}
        </ul>
      )}
      <InlineCommentForm
        inviteId={inviteId}
        filePath={filename}
        onAdded={refresh}
      />
    </div>
  );
}

/* ---------------- Inline Comment Form ---------------- */
function InlineCommentForm({
  inviteId,
  filePath,
  onAdded,
}: {
  inviteId: string;
  filePath: string;
  onAdded: () => void;
}) {
  const [message, setMessage] = useState("");
  const [line, setLine] = useState("");
  const [saving, setSaving] = useState(false);

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSaving(true);
    await fetch(`${API_BASE_URL}/api/review/inline-comments/${inviteId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_path: filePath,
        line: line ? Number(line) : null,
        message,
        author_email: "admin@yourdomain.com",
        author_name: "Admin",
      }),
    });
    setMessage("");
    setLine("");
    setSaving(false);
    onAdded();
  }

  return (
    <form onSubmit={submitComment} className="flex items-center gap-2">
      <Input
        type="number"
        placeholder="Line"
        value={line}
        onChange={(e) => setLine(e.target.value)}
        className="w-20 text-xs"
      />
      <Input
        placeholder="Add comment..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="text-xs"
      />
      <Button type="submit" size="sm" disabled={saving || !message.trim()}>
        {saving ? "Adding…" : "Comment"}
      </Button>
    </form>
  );
}
