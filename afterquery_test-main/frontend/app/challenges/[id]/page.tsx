"use client";

import { useEffect, useState, useMemo } from "react";
import { api } from "@/utils/api";
import type { Assessment } from "@/components/ChallengeCreationForm";
import InviteForm from "@/components/InviteForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";

type Candidate = {
  id: string;
  email: string;
  full_name?: string | null;
};

type AssessmentInvite = {
  id: string;
  status: "pending" | "started" | "submitted" | string;
  created_at: string;
  start_deadline_at?: string | null;
  complete_deadline_at?: string | null;
  started_at?: string | null;
  submitted_at?: string | null;
  candidate: Candidate;
};

export default function ChallengeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invites, setInvites] = useState<AssessmentInvite[]>([]);
  const [activeTab, setActiveTab] = useState<
    "pending" | "started" | "submitted" | "all"
  >("all");

  const fetchInvites = () => {
    api
      .get<AssessmentInvite[]>(`/api/assessments/${id}/invites`)
      .then(setInvites)
      .catch(() => setInvites([]));
  };

  useEffect(() => {
    api
      .get<Assessment>(`/api/assessments/${id}`)
      .then(setAssessment)
      .catch((e) => setError(e?.message || "Failed to load challenge"));

    fetchInvites();
  }, [id]);

  const filteredInvites = useMemo(() => {
    const filtered =
      activeTab === "all"
        ? invites
        : invites.filter((i) => i.status === activeTab);

    // Sort by latest activity
    const copy = filtered.slice();
    copy.sort((a, b) => {
      const da = new Date(
        a.submitted_at || a.started_at || a.created_at
      ).getTime();
      const db = new Date(
        b.submitted_at || b.started_at || b.created_at
      ).getTime();
      return db - da;
    });
    return copy;
  }, [invites, activeTab]);

  return (
    <main className="py-8 space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {assessment ? (
        <>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">
              {assessment.title}
            </h1>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Challenge Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Seed Repository
                </p>
                <a
                  href={assessment.seed_repo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  {assessment.seed_repo_url}
                </a>
              </div>
              {assessment.description && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Description
                  </p>
                  <p className="text-sm whitespace-pre-wrap">
                    {assessment.description}
                  </p>
                </div>
              )}
              {assessment.instructions && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Instructions
                  </p>
                  <p className="text-sm whitespace-pre-wrap">
                    {assessment.instructions}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Submissions ({invites.length})</CardTitle>
                </div>
                <Button asChild>
                  <Link href={`/rankings?assessmentId=${id}`}>
                    View Rankings
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs
                defaultValue="all"
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as any)}
              >
                <TabsList className="mb-4">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="pending">Pending</TabsTrigger>
                  <TabsTrigger value="started">Started</TabsTrigger>
                  <TabsTrigger value="submitted">Submitted</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab}>
                  {filteredInvites.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No submissions in this category.
                    </div>
                  ) : (
                    <div className="max-h-[500px] overflow-y-auto border rounded-md">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background">
                          <TableRow>
                            <TableHead>Candidate</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Invited</TableHead>
                            <TableHead>Started</TableHead>
                            <TableHead>Submitted</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredInvites.map((inv) => (
                            <TableRow key={inv.id} className="hover:bg-muted/50">
                              <TableCell className="font-medium">
                                {inv.candidate.full_name || inv.candidate.email}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {inv.candidate.email}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    inv.status === "submitted"
                                      ? "default"
                                      : inv.status === "started"
                                      ? "secondary"
                                      : "outline"
                                  }
                                  className="capitalize"
                                >
                                  {inv.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">
                                {new Date(inv.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-sm">
                                {inv.started_at
                                  ? new Date(inv.started_at).toLocaleDateString()
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {inv.submitted_at
                                  ? new Date(inv.submitted_at).toLocaleDateString()
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                {inv.status === "submitted" ? (
                                  <Button asChild variant="default" size="sm">
                                    <Link href={`/review?inviteId=${inv.id}`}>
                                      Review
                                    </Link>
                                  </Button>
                                ) : inv.status === "started" ? (
                                  <Button asChild variant="secondary" size="sm">
                                    <Link href={`/review?inviteId=${inv.id}`}>
                                      View Progress
                                    </Link>
                                  </Button>
                                ) : null}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Send to a New Candidate</CardTitle>
              <CardDescription>
                Invite a candidate to take this assessment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InviteForm
                assessment={assessment as Assessment}
                onSuccess={fetchInvites}
              />
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      )}
    </main>
  );
}
