"use client";

import "./globals.css";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isCandidate = pathname?.startsWith("/candidate");

  const navItems = [
    { href: "/challenges", label: "Challenges" },
    { href: "/assignments", label: "Assignments" },
  ];

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="min-h-screen bg-background">
          {isCandidate ? (
            <div className="bg-blue-50 border-b border-blue-200">
              <div className="container mx-auto px-4 py-4">
                <p className="text-center text-blue-900 font-medium">
                  Follow the instructions to complete the assessment
                </p>
              </div>
            </div>
          ) : (
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="container mx-auto px-4">
                <nav className="flex h-14 items-center justify-between">
                  <div className="flex items-center gap-6">
                    <Link href="/" className="flex items-center space-x-2">
                      <span className="font-bold text-xl">AfterQuery</span>
                    </Link>
                    <div className="hidden md:flex gap-1">
                      {navItems.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 ${
                            pathname === item.href
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href="/settings"
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 text-muted-foreground"
                    >
                      Settings
                    </Link>
                  </div>
                </nav>
              </div>
            </header>
          )}
          <main className="container mx-auto px-4">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
