import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AiSettings } from "@/types";
import { DEFAULT_AI_SETTINGS } from "@/types";

interface AiSettingsState {
  settings: AiSettings;

  // Actions
  updateSettings: (partial: Partial<AiSettings>) => void;
  resetSettings: () => void;
}

export const useAiSettingsStore = create<AiSettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_AI_SETTINGS,

      updateSettings: (partial) =>
        set((state) => ({
          settings: { ...state.settings, ...partial },
        })),

      resetSettings: () =>
        set({ settings: DEFAULT_AI_SETTINGS }),
    }),
    {
      name: "clx-ai-settings",
    }
  )
);
