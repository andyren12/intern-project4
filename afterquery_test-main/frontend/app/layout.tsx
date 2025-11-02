"use client";

import "./globals.css";
import { usePathname } from "next/navigation";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isCandidate = pathname?.startsWith("/candidate");

  return (
    <html lang="en">
      <body className="font-sans antialiased m-0">
        <div className="w-full bg-gray-50">
          {isCandidate ? (
            <h3 className="bg-white-500 text-center py-3 w-full text-lg">Follow the instructions to complete the assessment</h3>
          ) : (
            <header className="bg-gray-700 py-3 w-full">
              <div className="max-w-4xl mx-auto px-6">
                <nav className="flex gap-6">
                  <a href="/challenges" className="text-white no-underline text-sm hover:text-gray-200">Challenges</a>
                  <a href="/assignments" className="text-white no-underline text-sm hover:text-gray-200">Assignments</a>
                  <a href="/settings" className="text-white no-underline text-sm hover:text-gray-200 ml-auto">Settings</a>
                </nav>
              </div>
            </header>
          )}
          <div className="max-w-4xl mx-auto p-6">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
