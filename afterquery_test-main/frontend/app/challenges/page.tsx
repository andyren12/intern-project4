"use client";

import { useState, useEffect } from "react";
import ChallengeCreationForm, {
  Assessment,
} from "../../components/ChallengeCreationForm";
import InviteForm from "@/components/InviteForm";
import { api } from "@/utils/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

async function fetchAvailableAssessments(): Promise<Assessment[]> {
  return api.get<Assessment[]>("/api/assessments/?status=available");
}

async function fetchArchivedAssessments(): Promise<Assessment[]> {
  return api.get<Assessment[]>("/api/assessments/?status=archived");
}

export default function ChallengesPage() {
  const [availableAssessments, setAvailableAssessments] = useState<Assessment[]>([]);
  const [archivedAssessments, setArchivedAssessments] = useState<Assessment[]>([]);
  const [activeTab, setActiveTab] = useState<"available" | "archived">("available");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [inviteModalAssessment, setInviteModalAssessment] =
    useState<Assessment | null>(null);
  const [editingCalendlyId, setEditingCalendlyId] = useState<string | null>(null);
  const [calendlyEditValue, setCalendlyEditValue] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assessmentToDelete, setAssessmentToDelete] = useState<Assessment | null>(null);

  // Fetch both lists on mount
  useEffect(() => {
    fetchAvailableAssessments()
      .then(setAvailableAssessments)
      .catch(() => setAvailableAssessments([]));

    fetchArchivedAssessments()
      .then(setArchivedAssessments)
      .catch(() => setArchivedAssessments([]));
  }, []);

  const startEditingCalendly = (assessment: Assessment) => {
    setEditingCalendlyId(assessment.id);
    setCalendlyEditValue(assessment.calendly_link || "");
  };

  const saveCalendlyLink = async (assessmentId: string) => {
    try {
      const updated = await api.put<Assessment>(
        `/api/assessments/${assessmentId}/calendly-link`,
        { calendly_link: calendlyEditValue }
      );
      // Update in the appropriate list
      setAvailableAssessments((prev) =>
        prev.map((a) => (a.id === assessmentId ? updated : a))
      );
      setArchivedAssessments((prev) =>
        prev.map((a) => (a.id === assessmentId ? updated : a))
      );
      setEditingCalendlyId(null);
      toast.success("Calendly link updated successfully");
    } catch (error: any) {
      toast.error(`Failed to save: ${error.message || "Unknown error"}`);
    }
  };

  const cancelEditingCalendly = () => {
    setEditingCalendlyId(null);
    setCalendlyEditValue("");
  };

  const handleDeleteConfirm = async () => {
    if (!assessmentToDelete) return;

    // Remove from archived list
    setArchivedAssessments(prev => prev.filter(item => item.id !== assessmentToDelete.id));
    setDeleteDialogOpen(false);

    try {
      await api.delete(`/api/assessments/${assessmentToDelete.id}`);
      toast.success(`Successfully deleted "${assessmentToDelete.title}"`);
    } catch (error: any) {
      toast.error(`Failed to delete: ${error.message || 'Unknown error'}`);
      // Reload archived list if delete failed
      const archived = await fetchArchivedAssessments();
      setArchivedAssessments(archived);
    } finally {
      setAssessmentToDelete(null);
    }
  };

  // Get the current list based on active tab
  const currentAssessments = activeTab === "available" ? availableAssessments : archivedAssessments;

  return (
    <main className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Challenges</h1>
        <p className="text-muted-foreground">
          Create and manage assessment challenges for candidates
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Create New Challenge</CardTitle>
          <CardDescription>
            Set up a new assessment challenge with custom grading criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => setShowCreateForm(!showCreateForm)}
            variant={showCreateForm ? "outline" : "default"}
          >
            {showCreateForm ? "Cancel" : "Create Challenge"}
          </Button>

          {showCreateForm && (
            <div className="mt-6 pt-6 border-t">
              <ChallengeCreationForm
                onCreated={(assessment) => {
                  setAvailableAssessments([...availableAssessments, assessment]);
                  setShowCreateForm(false);
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="available" value={activeTab} onValueChange={(v) => setActiveTab(v as "available" | "archived")}>
        <TabsList className="mb-4">
          <TabsTrigger value="available">Available</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {currentAssessments.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-10">
                  <h3 className="text-lg font-semibold mb-2">No Challenges Found</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    You don&apos;t have any challenges available.
                  </p>
                  <Button
                    onClick={() => setShowCreateForm(true)}
                    variant="outline"
                  >
                    Create Your First Challenge
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {currentAssessments.map((a) => (
                <Card key={a.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div>
                          <a
                            href={`/challenges/${a.id}`}
                            className="text-xl font-semibold hover:text-primary transition-colors"
                          >
                            {a.title}
                          </a>
                          <p className="text-sm text-muted-foreground mt-1">
                            {a.seed_repo_url}
                          </p>
                        </div>
                        <div className="text-sm">
                          {editingCalendlyId === a.id ? (
                            <div className="flex gap-2 items-center">
                              <span className="font-medium text-muted-foreground">Calendly:</span>
                              <Input
                                type="url"
                                value={calendlyEditValue}
                                onChange={(e) => setCalendlyEditValue(e.target.value)}
                                placeholder="https://calendly.com/..."
                                className="flex-1 h-8 text-xs"
                              />
                              <Button
                                onClick={() => saveCalendlyLink(a.id)}
                                size="sm"
                                className="h-8"
                              >
                                Save
                              </Button>
                              <Button
                                onClick={cancelEditingCalendly}
                                size="sm"
                                variant="outline"
                                className="h-8"
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-2 items-center">
                              <span className="font-medium text-muted-foreground">Calendly:</span>
                              {a.calendly_link ? (
                                <Badge variant="secondary" className="font-mono text-xs">
                                  {a.calendly_link}
                                </Badge>
                              ) : (
                                <span className="text-xs italic text-muted-foreground">
                                  Using default from Settings
                                </span>
                              )}
                              {activeTab === "available" && (
                                <Button
                                  onClick={() => startEditingCalendly(a)}
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                >
                                  Edit
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {activeTab === "available" ? (
                          <>
                            <Button
                              onClick={() => setInviteModalAssessment(a)}
                              size="sm"
                            >
                              Invite
                            </Button>
                            <Button
                              onClick={async () => {
                                // Remove from available and add to archived
                                setAvailableAssessments(prev => prev.filter(item => item.id !== a.id));
                                setArchivedAssessments(prev => [...prev, { ...a, archived: true }]);
                                try {
                                  await api.put<Assessment>(
                                    `/api/assessments/${a.id}/archive`
                                  );
                                } catch (error) {
                                  // If it fails, reload both lists
                                  const [available, archived] = await Promise.all([
                                    fetchAvailableAssessments(),
                                    fetchArchivedAssessments()
                                  ]);
                                  setAvailableAssessments(available);
                                  setArchivedAssessments(archived);
                                }
                              }}
                              variant="outline"
                              size="sm"
                            >
                              Archive
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              onClick={async () => {
                                // Remove from archived and add to available
                                setArchivedAssessments(prev => prev.filter(item => item.id !== a.id));
                                setAvailableAssessments(prev => [...prev, { ...a, archived: false }]);
                                try {
                                  await api.put<Assessment>(
                                    `/api/assessments/${a.id}/unarchive`
                                  );
                                } catch (error) {
                                  // If it fails, reload both lists
                                  const [available, archived] = await Promise.all([
                                    fetchAvailableAssessments(),
                                    fetchArchivedAssessments()
                                  ]);
                                  setAvailableAssessments(available);
                                  setArchivedAssessments(archived);
                                }
                              }}
                              variant="outline"
                              size="sm"
                            >
                              Unarchive
                            </Button>
                            <Button
                              onClick={() => {
                                setAssessmentToDelete(a);
                                setDeleteDialogOpen(true);
                              }}
                              variant="destructive"
                              size="sm"
                            >
                              Delete
                            </Button>
                          </>
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

      <Dialog open={!!inviteModalAssessment} onOpenChange={(open) => !open && setInviteModalAssessment(null)}>
        <DialogContent className="max-w-lg">
          {inviteModalAssessment && (
            <InviteForm
              assessment={inviteModalAssessment}
              onSuccess={() => setInviteModalAssessment(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Challenge</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to permanently delete{" "}
                <strong>&quot;{assessmentToDelete?.title}&quot;</strong>?
              </p>
              <div className="text-sm">
                <p className="font-medium mb-1">This will delete:</p>
                <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                  <li>All submissions and scores</li>
                  <li>All candidate repositories from GitHub</li>
                  <li>All review comments and AI grading logs</li>
                </ul>
              </div>
              <p className="font-semibold text-destructive">
                This action cannot be undone!
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAssessmentToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
