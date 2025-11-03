"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/utils/api";
import ScoringPanel from "./ScoringPanel";

export type ReviewData = {
  invite: { id: string; status: string; started_at?: string | null; submitted_at?: string | null };
  assessment: { id: string; title: string; seed_repo_url: string };
  candidate: { id: string; email: string; full_name?: string | null };
  repo?: { full_name: string; pinned_main_sha?: string | null; archived: boolean } | null;
  submission?: { final_sha?: string | null; submitted_at: string } | null;
  commits: any[];
  diff: { against: { seed_repo: string; branch: string }; files_changed: any[] };
};

export default function AdminReviewPanel({ data }: { data: ReviewData }) {
  const { invite, assessment, candidate, repo, submission, commits, diff } = data;
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

  useEffect(() => {
    setFollowupsLoading(true);
    fetch(`${API_BASE_URL}/api/review/followup/${invite.id}`)
      .then((r) => r.json())
      .then(setFollowups)
      .finally(() => setFollowupsLoading(false));
  }, [invite.id]);

  useEffect(() => {
    setDiffLoading(true);
    fetch(`${API_BASE_URL}/api/review/diff/${invite.id}`)
      .then((r) => r.json())
      .then(setDiffFiles)
      .finally(() => setDiffLoading(false));
  }, [invite.id]);

  useEffect(() => {
    setInlineLoading(true);
    fetch(`${API_BASE_URL}/api/review/inline-comments/${invite.id}`)
      .then((r) => r.json())
      .then(setInlineComments)
      .finally(() => setInlineLoading(false));
  }, [invite.id]);

  useEffect(() => {
    setOverallLoading(true);
    fetch(`${API_BASE_URL}/api/review/comments/${invite.id}`)
      .then((r) => r.json())
      .then(setOverallComments)
      .finally(() => setOverallLoading(false));
  }, [invite.id]);

  async function sendFollowUp() {
    try {
      await fetch(`${API_BASE_URL}/api/review/followup/${invite.id}`, { method: "POST" });
      alert("Follow-up email sent");
      // refresh history
      setFollowupsLoading(true);
      fetch(`${API_BASE_URL}/api/review/followup/${invite.id}`)
        .then((r) => r.json())
        .then(setFollowups)
        .finally(() => setFollowupsLoading(false));
    } catch (e) {
      alert("Failed to send follow-up");
    }
  }
  return (
    <div className="grid gap-6 max-w-2xl mx-auto p-6">
      <section className="rounded bg-white p-4 shadow-sm border">
        <h2 className="text-2xl font-bold mb-1">{assessment.title}</h2>
        <div className="text-xs text-gray-500">Seed: {assessment.seed_repo_url} · Branch: {diff.against.branch}</div>
      </section>
      <section className="rounded bg-white p-4 shadow-sm border">
        <div><span className="font-bold">Candidate:</span> {candidate.full_name || candidate.email} ({candidate.email})</div>
        <div><span className="font-bold">Status:</span> {invite.status.charAt(0).toUpperCase() + invite.status.slice(1)}</div>
        <div className="text-xs text-gray-500">
          {invite.started_at ? <>Started: {new Date(invite.started_at).toLocaleString()} &middot; </> : null}
          {invite.submitted_at ? <>Submitted: {new Date(invite.submitted_at).toLocaleString()}</> : null}
        </div>
      </section>
      <section className="rounded bg-white p-4 shadow-sm border">
        <h3 className="font-semibold mb-2 text-lg">Repository</h3>
        {repo ? (
          <div>
            <div>
              Repo: <a
                href={`https://github.com/${repo.full_name}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-600 hover:underline"
              >
                {repo.full_name}
              </a>
            </div>
            {repo.pinned_main_sha ? <div>Pinned SHA: <span className="font-mono text-gray-600">{repo.pinned_main_sha}</span></div> : null}
            <div>Archived: {repo.archived ? "Yes" : "No"}</div>
          </div>
        ) : (
          <div className="text-gray-400">No repo created.</div>
        )}
      </section>
      <section className="rounded bg-white p-4 shadow-sm border">
        <h3 className="font-semibold mb-2 text-lg">Submission</h3>
        {submission ? (
          <div>
            <div>Final SHA: <span className="font-mono">{submission.final_sha || "(unknown)"}</span></div>
            <div>Submitted At: {new Date(submission.submitted_at).toLocaleString()}</div>
            <div className="mt-2">
              <button onClick={sendFollowUp} className="bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded font-semibold">Send Follow-Up</button>
            </div>
            <div className="mt-4">
              <div className="font-semibold mb-1">Follow-Up History</div>
              {followupsLoading ? (
                <div className="text-gray-400 text-sm">Loading…</div>
              ) : followups.length === 0 ? (
                <div className="text-gray-400 text-sm">No follow-ups sent yet.</div>
              ) : (
                <ul className="text-sm divide-y divide-gray-100">
                  {followups.map((f) => (
                    <li key={f.id} className="py-1 flex justify-between gap-2">
                      <span className="truncate text-gray-700">{f.template_subject}</span>
                      <span className="text-gray-500 text-xs">{new Date(f.sent_at).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="text-gray-600">Not submitted yet. Status: <span className="font-bold">In Progress</span></div>
        )}
      </section>
      <section className="rounded bg-white p-4 shadow-sm border">
        <h3 className="font-semibold mb-2 text-lg">Commit History</h3>
        {commits.length === 0 ? (
          <div className="text-gray-400">No commits listed.</div>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {commits.map((c: any, idx: number) => (
              <li key={idx} className="py-2">
                <div className="flex justify-between flex-wrap gap-2">
                  <span className="font-semibold text-gray-900 truncate">{c.message}</span>
                  <span className="text-gray-600 truncate text-right max-w-[48%]">{c.author_name} &lt;{c.author_email}&gt;</span>
                </div>
                <div className="flex justify-between items-center gap-2 text-xs mt-0.5">
                  <span className="text-gray-400 font-mono">{c.sha.slice(0, 12)}</span>
                  <span className="text-gray-400 text-right min-w-[110px]">{new Date(c.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} on {new Date(c.date).toLocaleDateString()}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded bg-white p-4 shadow-sm border">
        <h3 className="font-semibold mb-2 text-lg">Diff vs Seed (main)</h3>
        {diffLoading ? (
          <div className="text-gray-400">Loading…</div>
        ) : diffFiles.length === 0 ? (
          <div className="text-gray-400">No changes detected.</div>
        ) : (
          <ul className="text-sm space-y-4">
            {diffFiles.map((f) => (
              <li key={f.filename} className="border rounded p-3">
                <div className="flex justify-between text-sm font-medium mb-2">
                  <span className="font-mono text-blue-600">{f.filename}</span>
                  <span className="text-gray-500">+{f.additions} -{f.deletions} · {f.status}</span>
                </div>
                {f.patch ? (
                  <pre className="text-xs overflow-auto bg-gray-50 border rounded p-2 whitespace-pre-wrap">{f.patch}</pre>
                ) : (
                  <div className="text-xs text-gray-400">No patch available.</div>
                )}
                <div className="mt-3">
                  <div className="font-medium mb-1">Inline Comments</div>
                  {inlineLoading ? (
                    <div className="text-xs text-gray-400">Loading…</div>
                  ) : (
                    <ul className="text-xs space-y-1">
                      {inlineComments.filter((c) => c.file_path === f.filename).map((c) => (
                        <li key={c.id} className="flex justify-between gap-2">
                          <span className="text-gray-700">{c.message}</span>
                          <span className="text-gray-400">{c.line != null ? `L${c.line}` : ''} {new Date(c.created_at).toLocaleString()}</span>
                        </li>
                      ))}
                      {inlineComments.filter((c) => c.file_path === f.filename).length === 0 ? (
                        <li className="text-gray-400">No comments yet.</li>
                      ) : null}
                    </ul>
                  )}
                  <InlineCommentForm inviteId={invite.id} filePath={f.filename} onAdded={() => {
                    setInlineLoading(true);
                    fetch(`${API_BASE_URL}/api/review/inline-comments/${invite.id}`)
                      .then((r) => r.json())
                      .then(setInlineComments)
                      .finally(() => setInlineLoading(false));
                  }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded bg-white p-4 shadow-sm border">
        <h3 className="font-semibold mb-2 text-lg">Overall Feedback</h3>
        {/* Existing feedback */}
        {overallLoading ? (
          <div className="text-gray-400 text-sm mb-3">Loading…</div>
        ) : overallComments.length === 0 ? (
          <div className="text-gray-400 text-sm mb-3">No feedback yet.</div>
        ) : (
          <ul className="text-sm divide-y divide-gray-100 mb-3">
            {overallComments.map((c) => (
              <li key={c.id} className="py-2 flex justify-between gap-2">
                <span className="text-gray-700">{c.message}</span>
                <span className="text-gray-400 text-xs">{new Date(c.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!overallText.trim()) return;
            setSavingOverall(true);
            await fetch(`${API_BASE_URL}/api/review/comments/${invite.id}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                user_type: "admin",
                author_email: "admin@yourdomain.com",
                author_name: "Admin",
                message: overallText.trim(),
              }),
            });
            setOverallText("");
            setSavingOverall(false);
            // refresh list
            setOverallLoading(true);
            fetch(`${API_BASE_URL}/api/review/comments/${invite.id}`)
              .then((r) => r.json())
              .then(setOverallComments)
              .finally(() => setOverallLoading(false));
          }}
          className="grid gap-2"
        >
          <textarea
            className="border rounded p-2 h-28 text-sm"
            placeholder="Share overall feedback for the candidate…"
            value={overallText}
            onChange={(e) => setOverallText(e.target.value)}
          />
          <div>
            <button type="submit" disabled={savingOverall || !overallText.trim()} className="px-4 py-2 rounded bg-gray-900 text-white font-semibold disabled:bg-gray-400">{savingOverall ? "Sending…" : "Send Feedback"}</button>
          </div>
        </form>
      </section>
      <section className="rounded bg-white p-4 shadow-sm border">
        <ScoringPanel inviteId={invite.id} assessmentId={assessment.id} />
      </section>
    </div>
  );
}

function InlineCommentForm({ inviteId, filePath, onAdded }: { inviteId: string; filePath: string; onAdded: () => void }) {
  const [message, setMessage] = useState("");
  const [line, setLine] = useState<string>("");
  const [saving, setSaving] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!message.trim()) return;
        setSaving(true);
        await fetch(`${API_BASE_URL}/api/review/inline-comments/${inviteId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_path: filePath, line: line ? Number(line) : null, message, author_email: "admin@yourdomain.com", author_name: "Admin" }),
        });
        setMessage("");
        setLine("");
        setSaving(false);
        onAdded();
      }}
      className="mt-2 flex gap-2 items-center"
    >
      <input
        type="number"
        placeholder="Line"
        value={line}
        onChange={(e) => setLine(e.target.value)}
        className="w-20 border rounded p-1 text-xs"
      />
      <input
        type="text"
        placeholder="Add an inline comment…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="flex-1 border rounded p-1.5 text-xs"
      />
      <button type="submit" disabled={saving || !message.trim()} className="px-2 py-1 rounded bg-gray-900 text-white text-xs disabled:bg-gray-400">{saving ? "Adding…" : "Comment"}</button>
    </form>
  );
}
