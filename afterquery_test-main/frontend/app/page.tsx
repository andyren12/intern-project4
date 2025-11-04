import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="container mx-auto py-16">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <h1 className="text-5xl font-bold tracking-tight mb-4">
              Welcome to AfterQuery
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Create and manage technical assessments for candidates
            </p>
            <Button asChild size="lg" className="text-lg px-8 py-6">
              <Link href="/challenges">Get Started</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
