"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { IndexStatus } from "@/lib/index-repository";

type IndexState = {
  status: IndexStatus;
  lastIndexedAt: string | null;
  currentIndexRunId: string | null;
};

type SetIndexStateAction =
  | Partial<IndexState>
  | ((prev: IndexState) => Partial<IndexState>);

type IndexStatusContextValue = IndexState & {
  setIndexState: (next: SetIndexStateAction) => void;
};

const IndexStatusContext = createContext<IndexStatusContextValue | null>(null);

type ProviderProps = {
  initialStatus: IndexStatus;
  initialLastIndexedAt?: string | null;
  initialCurrentIndexRunId?: string | null;
  children: ReactNode;
};

export function IndexStatusProvider({
  initialStatus,
  initialLastIndexedAt = null,
  initialCurrentIndexRunId = null,
  children,
}: ProviderProps) {
  const [state, setState] = useState<IndexState>({
    status: initialStatus,
    lastIndexedAt: initialLastIndexedAt,
    currentIndexRunId: initialCurrentIndexRunId,
  });

  const setIndexState = useCallback((next: SetIndexStateAction) => {
    setState((prev) => ({
      ...prev,
      ...(typeof next === "function" ? next(prev) : next),
    }));
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      setIndexState,
    }),
    [state, setIndexState]
  );

  return (
    <IndexStatusContext.Provider value={value}>
      {children}
    </IndexStatusContext.Provider>
  );
}

export function useIndexStatus() {
  const ctx = useContext(IndexStatusContext);
  if (!ctx) {
    throw new Error(
      "useIndexStatus must be used within an IndexStatusProvider"
    );
  }
  return ctx;
}