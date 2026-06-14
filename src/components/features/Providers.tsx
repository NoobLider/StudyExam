"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import AuthProvider from "@/components/features/AuthProvider";
import ContentModeProvider from "@/components/features/ContentModeProvider";
import ContentModeModal from "@/components/features/ContentModeModal";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <ContentModeProvider>
          {children}
          <ContentModeModal />
        </ContentModeProvider>
      </AuthProvider>
      <Toaster richColors closeButton />
    </ThemeProvider>
  );
}
