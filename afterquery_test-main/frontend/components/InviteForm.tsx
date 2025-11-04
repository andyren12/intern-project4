"use client";

import { useState } from "react";
import { api } from "@/utils/api";
import type { Assessment } from "@/components/ChallengeCreationForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

export default function InviteForm({
  assessment,
  onSuccess,
}: {
  assessment?: Assessment;
  onSuccess?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const email = String(formData.get("email") || "").trim();
      const full_name = String(formData.get("full_name") || "").trim();
      if (!assessment?.id || !email)
        throw new Error("Assessment and email are required");

      // Create invite - backend automatically sends the invite email
      await api.post<Invite>("/api/invites/", {
        assessment_id: assessment.id,
        email,
        full_name,
      });

      setSuccess(`Invite sent successfully to ${email}`);
      (e.currentTarget as HTMLFormElement)?.reset();

      // call onSuccess if provided and close modal after short delay
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to create invite");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <h3 className="text-xl font-semibold">Candidate Details</h3>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertDescription className="text-green-600">{success}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Candidate Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="candidate@example.com"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="full_name">Candidate Name</Label>
        <Input
          id="full_name"
          name="full_name"
          placeholder="Ada Lovelace"
          required
        />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Sending..." : "Send Invite"}
      </Button>
    </form>
  );
}
