import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GenerationResult } from "@/types";

export type CompareProvider = "vscode-proxy" | "internal";

interface CompareState {
  vsCodeProxyResult: GenerationResult | null;
  internalResult: GenerationResult | null;

  setResult: (provider: CompareProvider, result: GenerationResult) => void;
  clearResult: (provider: CompareProvider) => void;
  clearAll: () => void;
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set) => ({
      vsCodeProxyResult: null,
      internalResult: null,

      setResult: (provider, result) =>
        set(
          provider === "vscode-proxy"
            ? { vsCodeProxyResult: result }
            : { internalResult: result }
        ),

      clearResult: (provider) =>
        set(
          provider === "vscode-proxy"
            ? { vsCodeProxyResult: null }
            : { internalResult: null }
        ),

      clearAll: () => set({ vsCodeProxyResult: null, internalResult: null }),
    }),
    {
      name: "clx-compare-results",
    }
  )
);
