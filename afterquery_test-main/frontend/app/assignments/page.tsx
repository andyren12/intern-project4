"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/utils/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Link from "next/link";

type Candidate = {
  id: string;
  email: string;
  full_name?: string | null;
};

type AssessmentLite = {
  id: string;
  title: string;
  seed_repo_url: string;
  archived: boolean;
};

type AdminInvite = {
  id: string;
  status: "pending" | "started" | "submitted" | string;
  created_at: string;
  start_deadline_at?: string | null;
  complete_deadline_at?: string | null;
  started_at?: string | null;
  submitted_at?: string | null;
  candidate: Candidate;
  assessment: AssessmentLite;
};

async function fetchInvites(): Promise<AdminInvite[]> {
  return api.get<AdminInvite[]>("/api/invites/admin");
}

export default function AssignmentsPage() {
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [activeTab, setActiveTab] = useState<
    "pending" | "started" | "submitted" | "all" | "archived"
  >("pending");
  const [modalInvite, setModalInvite] = useState<AdminInvite | null>(null);

  useEffect(() => {
    fetchInvites()
      .then(setInvites)
      .catch(() => setInvites([]));
  }, []);

  const sorted = useMemo(() => {
    let filtered: AdminInvite[];

    if (activeTab === "archived") {
      filtered = invites.filter((i) => i.assessment.archived);
    } else if (activeTab === "all") {
      filtered = invites.filter((i) => !i.assessment.archived);
    } else {
      filtered = invites.filter(
        (i) => i.status === activeTab && !i.assessment.archived
      );
    }

    // Sort by latest activity
    const copy = filtered.slice();
    copy.sort((a, b) => {
      const da = new Date(
        a.submitted_at || a.started_at || a.created_at
      ).getTime();
      const db = new Date(
        b.submitted_at || b.started_at || b.created_at
      ).getTime();
      return db - da; // latest first
    });
    return copy;
  }, [invites, activeTab]);

  return (
    <main className="py-8 space-y-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Assignments</h1>
        <p className="text-muted-foreground">
          Track all candidate assignments and submissions
        </p>
      </div>

      <Tabs defaultValue="pending" value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="mb-4">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="started">Started</TabsTrigger>
          <TabsTrigger value="submitted">Submitted</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {sorted.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-10 text-muted-foreground">
                  No assignments in this category.
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sorted.map((inv) => (
                <Card key={inv.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div>
                          <h3 className="font-semibold text-lg">
                            {inv.candidate.full_name || inv.candidate.email}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {inv.candidate.email}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            Challenge: {inv.assessment.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {inv.assessment.seed_repo_url}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                          <div>
                            <span className="font-medium">Invited:</span>{" "}
                            {new Date(inv.created_at).toLocaleString()}
                          </div>
                          <div>
                            <span className="font-medium">Start by:</span>{" "}
                            {inv.start_deadline_at
                              ? new Date(inv.start_deadline_at).toLocaleString()
                              : "—"}
                          </div>
                          <div>
                            <span className="font-medium">Started:</span>{" "}
                            {inv.started_at
                              ? new Date(inv.started_at).toLocaleString()
                              : "—"}
                          </div>
                          <div>
                            <span className="font-medium">Complete by:</span>{" "}
                            {inv.complete_deadline_at
                              ? new Date(inv.complete_deadline_at).toLocaleString()
                              : "—"}
                          </div>
                          {inv.submitted_at && (
                            <div className="col-span-2">
                              <span className="font-medium">Submitted:</span>{" "}
                              {new Date(inv.submitted_at).toLocaleString()}
                            </div>
                          )}
                        </div>
                        <div>
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
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        {inv.status === "submitted" ? (
                          <Button asChild size="sm">
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
                        ) : (
                          <Button
                            onClick={() => setModalInvite(inv)}
                            variant="outline"
                            size="sm"
                          >
                            View Details
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!modalInvite} onOpenChange={(open) => !open && setModalInvite(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Assignment Details</DialogTitle>
          </DialogHeader>
          {modalInvite && (
            <div className="space-y-4">
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Candidate:</span>{" "}
                  {modalInvite.candidate.full_name || "—"} (
                  {modalInvite.candidate.email})
                </div>
                <div>
                  <span className="font-medium">Challenge:</span>{" "}
                  {modalInvite.assessment.title}
                </div>
                <div className="text-xs text-muted-foreground">
                  {modalInvite.assessment.seed_repo_url}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">Invited:</span>{" "}
                  {new Date(modalInvite.created_at).toLocaleString()}
                </div>
                <div>
                  <span className="font-medium text-foreground">Start by:</span>{" "}
                  {modalInvite.start_deadline_at
                    ? new Date(modalInvite.start_deadline_at).toLocaleString()
                    : "—"}
                </div>
                <div>
                  <span className="font-medium text-foreground">Started:</span>{" "}
                  {modalInvite.started_at
                    ? new Date(modalInvite.started_at).toLocaleString()
                    : "—"}
                </div>
                <div>
                  <span className="font-medium text-foreground">Complete by:</span>{" "}
                  {modalInvite.complete_deadline_at
                    ? new Date(modalInvite.complete_deadline_at).toLocaleString()
                    : "—"}
                </div>
                <div className="col-span-2">
                  <span className="font-medium text-foreground">Submitted:</span>{" "}
                  {modalInvite.submitted_at
                    ? new Date(modalInvite.submitted_at).toLocaleString()
                    : "—"}
                </div>
              </div>
              <div>
                <span className="font-medium">Status:</span>{" "}
                <Badge
                  variant={
                    modalInvite.status === "submitted"
                      ? "default"
                      : modalInvite.status === "started"
                      ? "secondary"
                      : "outline"
                  }
                  className="capitalize"
                >
                  {modalInvite.status}
                </Badge>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  onClick={() => setModalInvite(null)}
                  variant="outline"
                  size="sm"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
