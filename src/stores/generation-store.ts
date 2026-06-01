import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  GenerationOptions,
  GenerationProgress,
  GenerationResult,
  GenerationError,
  ManualResult,
} from "@/types";

interface GenerationState {
  options: GenerationOptions;
  progress: GenerationProgress;
  result: GenerationResult | null;

  // Actions
  setOptions: (options: Partial<GenerationOptions>) => void;
  startGeneration: (totalFiles: number) => void;
  updateProgress: (update: Partial<GenerationProgress>) => void;
  addError: (error: GenerationError) => void;
  addResult: (result: ManualResult) => void;
  completeGeneration: (duration: number) => void;
  reset: () => void;
}

const defaultOptions: GenerationOptions = {
  provider: "github",
  model: "gpt-4o-mini",
  outputFormats: ["html", "md"],
  useDictionary: true,
  useUdcContext: true,
};

const defaultProgress: GenerationProgress = {
  status: "idle",
  processedFiles: 0,
  totalFiles: 0,
  totalTokens: 0,
  errors: [],
};

export const useGenerationStore = create<GenerationState>()(
  persist(
    (set, get) => ({
      options: defaultOptions,
      progress: defaultProgress,
      result: null,

  setOptions: (partial) =>
    set((state) => ({
      options: { ...state.options, ...partial },
    })),

  startGeneration: (totalFiles) =>
    set({
      progress: {
        ...defaultProgress,
        status: "parsing",
        totalFiles,
      },
      result: null,
    }),

  updateProgress: (update) =>
    set((state) => ({
      progress: { ...state.progress, ...update },
    })),

  addError: (error) =>
    set((state) => ({
      progress: {
        ...state.progress,
        errors: [...state.progress.errors, error],
      },
    })),

  addResult: (manualResult) =>
    set((state) => {
      const currentResults = state.result?.results ?? [];
      const totalUsage = state.result?.totalTokenUsage ?? {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      };

      return {
        result: {
          results: [...currentResults, manualResult],
          totalTokenUsage: {
            prompt_tokens:
              totalUsage.prompt_tokens + manualResult.tokenUsage.prompt_tokens,
            completion_tokens:
              totalUsage.completion_tokens +
              manualResult.tokenUsage.completion_tokens,
            total_tokens:
              totalUsage.total_tokens + manualResult.tokenUsage.total_tokens,
          },
          generatedAt: new Date().toISOString(),
          duration: 0,
        },
        progress: {
          ...state.progress,
          processedFiles: state.progress.processedFiles + 1,
          totalTokens:
            state.progress.totalTokens +
            manualResult.tokenUsage.total_tokens,
        },
      };
    }),

  completeGeneration: (duration) =>
    set((state) => ({
      progress: { ...state.progress, status: "completed" },
      result: state.result
        ? { ...state.result, duration }
        : null,
    })),

  reset: () =>
    set({
      progress: defaultProgress,
      result: null,
    }),
  }),
  {
    name: "clx-generation-result",
    partialize: (state) => ({ result: state.result }),
  }
));
