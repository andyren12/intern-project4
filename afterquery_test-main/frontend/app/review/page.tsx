import dynamic from "next/dynamic";
import type { ReviewData } from "@/components/AdminReviewPanel";
import { API_BASE_URL } from "@/utils/api";

async function fetchReview(inviteId: string): Promise<ReviewData> {
  const res = await fetch(`${API_BASE_URL}/api/review/invite/${inviteId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load review: ${res.status}`);
  return res.json();
}

export default async function ReviewPage({ searchParams }: { searchParams: { inviteId?: string } }) {
  const inviteId = searchParams?.inviteId;
  if (!inviteId) {
    return (
      <main>
        <h2>Review</h2>
        <p>Provide an inviteId query param, e.g. <code>/review?inviteId=UUID</code></p>
      </main>
    );
  }

  const data = await fetchReview(inviteId).catch(() => null);
  if (!data) {
    return (
      <main>
        <h2>Review</h2>
        <div>Failed to load review data.</div>
      </main>
    );
  }

  const AdminReviewPanel = dynamic(() => import("@/components/AdminReviewPanel"), { ssr: false });
  return (
    <main>
      {/** Avoid any client-only hooks issues by rendering the panel client-side only */}
      <AdminReviewPanel data={data} />
    </main>
  );
}
