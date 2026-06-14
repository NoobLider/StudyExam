"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ContentMode } from "@/lib/db";
import { getContentMode, setContentMode } from "@/lib/contentMode";
import { useAuth } from "@/components/features/AuthProvider";

interface ContentModeContextValue {
  mode: ContentMode | null;
  setMode: (m: ContentMode) => void;
  needsSelection: boolean;
}

const ContentModeContext = createContext<ContentModeContextValue>({
  mode: null,
  setMode: () => {},
  needsSelection: false,
});

export function useContentMode() {
  return useContext(ContentModeContext);
}

export default function ContentModeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [mode, setModeState] = useState<ContentMode | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) {
      setModeState(null);
      setReady(false);
      return;
    }
    const saved = getContentMode(user.username);
    setModeState(saved);
    setReady(true);
  }, [user]);

  const setMode = useCallback(
    (m: ContentMode) => {
      if (!user) return;
      setContentMode(user.username, m);
      setModeState(m);
    },
    [user]
  );

  const needsSelection = ready && mode === null;

  return (
    <ContentModeContext.Provider value={{ mode, setMode, needsSelection }}>
      {children}
    </ContentModeContext.Provider>
  );
}
