"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/utils/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
    <main className="py-8 space-y-6 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Configure default email templates and scheduling links
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Default Follow-Up Email</CardTitle>
          <CardDescription>
            Email template sent to candidates when requesting follow-up interviews
          </CardDescription>
        </CardHeader>
        <CardContent>
          {message && (
            <Alert variant={message.includes('Failed') ? 'destructive' : 'default'} className="mb-4">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          {loading ? (
            <div className="text-muted-foreground text-sm">Loading…</div>
          ) : (
            <form onSubmit={onSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Follow-Up Interview Invitation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Body (HTML allowed)</Label>
                <Textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="min-h-48"
                  placeholder="<p>We'd like to schedule a follow-up interview. Please reply with your availability.</p>"
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default Calendly Scheduling Link</CardTitle>
          <CardDescription>
            Default Calendly link used for all assessments. You can override this with assessment-specific links on the Challenges page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {calendlyMessage && (
            <Alert variant={calendlyMessage.includes('Failed') ? 'destructive' : 'default'} className="mb-4">
              <AlertDescription>{calendlyMessage}</AlertDescription>
            </Alert>
          )}
          {calendlyLoading ? (
            <div className="text-muted-foreground text-sm">Loading…</div>
          ) : (
            <form onSubmit={onSaveCalendly} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="calendlyLink">Calendly Link</Label>
                <Input
                  id="calendlyLink"
                  type="url"
                  value={calendlyLink}
                  onChange={(e) => setCalendlyLink(e.target.value)}
                  placeholder="https://calendly.com/your-name/30min"
                />
                <p className="text-xs text-muted-foreground">
                  Get your link from{" "}
                  <a href="https://calendly.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Calendly.com
                  </a>
                  {" "}(e.g., https://calendly.com/your-name/interview)
                </p>
              </div>
              <Button type="submit" disabled={calendlySaving}>
                {calendlySaving ? "Saving…" : "Save"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}


