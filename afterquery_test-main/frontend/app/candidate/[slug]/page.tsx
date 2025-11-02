import CandidateStartPage from "@/components/CandidateStartPage";

export default function CandidatePage({ params }: { params: { slug: string } }) {
  return (
    <main>
      <CandidateStartPage slug={params.slug} />
    </main>
  );
}
