"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/utils/api";

type Template = { id: string; key: string; value: string };

type ParsedTemplate = { subject: string; body: string };

function parseValue(v: string): ParsedTemplate {
  try {
    const j = JSON.parse(v || "{}");
    return { subject: j.subject || "", body: j.body || "" };
  } catch {
    return { subject: "", body: v || "" };
  }
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const [calendlyLoading, setCalendlyLoading] = useState(true);
  const [calendlySaving, setCalendlySaving] = useState(false);
  const [calendlyLink, setCalendlyLink] = useState("");
  const [calendlyMessage, setCalendlyMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE_URL}/api/review/followup-template`)
      .then((r) => r.json())
      .then((tpl: Template) => {
        const parsed = parseValue(tpl.value);
        setSubject(parsed.subject);
        setBody(parsed.body);
      })
      .catch(() => setMessage("Failed to load template"))
      .finally(() => setLoading(false));

    setCalendlyLoading(true);
    fetch(`${API_BASE_URL}/api/review/calendly-link`)
      .then((r) => r.json())
      .then((setting: Template) => {
        setCalendlyLink(setting.value || "");
      })
      .catch(() => setCalendlyMessage("Failed to load Calendly link"))
      .finally(() => setCalendlyLoading(false));
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/review/followup-template`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      if (!res.ok) throw new Error();
      setMessage("Saved successfully");
    } catch {
      setMessage("Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  async function onSaveCalendly(e: React.FormEvent) {
    e.preventDefault();
    setCalendlySaving(true);
    setCalendlyMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/review/calendly-link`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link: calendlyLink }),
      });
      if (!res.ok) throw new Error();
      setCalendlyMessage("Saved successfully");
    } catch {
      setCalendlyMessage("Failed to save Calendly link");
    } finally {
      setCalendlySaving(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <section className="rounded bg-white p-4 shadow-sm border">
        <h2 className="text-lg font-semibold mb-3">Default Follow-Up Email</h2>
        {message ? (
          <div className="mb-3 text-sm {message.includes('Failed') ? 'text-red-700' : 'text-emerald-700'}">{message}</div>
        ) : null}
        {loading ? (
          <div className="text-gray-500 text-sm">Loading…</div>
        ) : (
          <form onSubmit={onSave} className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-sm font-medium">Subject</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="border rounded p-2 text-sm"
                placeholder="Follow-Up Interview Invitation"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Body (HTML allowed)</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="border rounded p-2 text-sm h-48"
                placeholder="<p>We'd like to schedule a follow-up interview. Please reply with your availability.</p>"
              />
            </label>
            <div>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded bg-gray-900 text-white font-semibold disabled:bg-gray-400"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="rounded bg-white p-4 shadow-sm border mt-6">
        <h2 className="text-lg font-semibold mb-3">Default Calendly Scheduling Link</h2>
        <p className="text-sm text-gray-600 mb-4">
          Default Calendly link used for all assessments. You can override this with assessment-specific links on the Challenges page.
        </p>
        {calendlyMessage ? (
          <div className={`mb-3 text-sm ${calendlyMessage.includes('Failed') ? 'text-red-700' : 'text-emerald-700'}`}>{calendlyMessage}</div>
        ) : null}
        {calendlyLoading ? (
          <div className="text-gray-500 text-sm">Loading…</div>
        ) : (
          <form onSubmit={onSaveCalendly} className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-sm font-medium">Calendly Link</span>
              <input
                type="url"
                value={calendlyLink}
                onChange={(e) => setCalendlyLink(e.target.value)}
                className="border rounded p-2 text-sm"
                placeholder="https://calendly.com/your-name/30min"
              />
              <span className="text-xs text-gray-500">
                Get your link from{" "}
                <a href="https://calendly.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                  Calendly.com
                </a>
                {" "}(e.g., https://calendly.com/your-name/interview)
              </span>
            </label>
            <div>
              <button
                type="submit"
                disabled={calendlySaving}
                className="px-4 py-2 rounded bg-gray-900 text-white font-semibold disabled:bg-gray-400"
              >
                {calendlySaving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}


