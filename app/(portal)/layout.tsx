import { ReactNode } from "react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Service Portal",
  description: "Customer service portal",
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col font-sans">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-4 px-6 fixed top-0 w-full z-10 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-center">
          <h1 className="text-xl font-bold tracking-tight">Service Portal</h1>
        </div>
      </header>
      <main className="flex-1 mt-16 p-4 md:p-8 max-w-4xl mx-auto w-full">
        {children}
      </main>
      <footer className="py-6 text-center text-sm text-gray-500 dark:text-gray-400 mt-auto border-t border-gray-200 dark:border-gray-800">
        <p>&copy; {new Date().getFullYear()} Home Base. All rights reserved.</p>
      </footer>
    </div>
  );
}
