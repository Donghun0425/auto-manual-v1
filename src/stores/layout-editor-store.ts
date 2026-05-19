import { create } from "zustand";
import type { LayoutSection, LayoutSectionOptions } from "@/types";

interface LayoutEditorState {
  sections: LayoutSection[];
  templateName: string;
  isDirty: boolean;

  // Actions
  setSections: (sections: LayoutSection[]) => void;
  setTemplateName: (name: string) => void;
  toggleSection: (sectionId: string) => void;
  reorderSections: (fromIndex: number, toIndex: number) => void;
  updateSectionOptions: (sectionId: string, options: LayoutSectionOptions) => void;
  resetToDefault: () => void;
}

const DEFAULT_SECTIONS: LayoutSection[] = [
  { id: "overview", name: "화면개요", enabled: true, order: 0 },
  { id: "usage", name: "사용법", enabled: true, order: 1 },
  { id: "conditions", name: "조건그룹", enabled: true, order: 2 },
  { id: "info", name: "인포그룹", enabled: true, order: 3 },
  { id: "grid", name: "그리드", enabled: true, order: 4 },
  { id: "popup", name: "팝업", enabled: true, order: 5 },
  { id: "tabs", name: "탭페이지", enabled: false, order: 6 },
  { id: "notes", name: "주의사항", enabled: true, order: 7 },
];

export const useLayoutEditorStore = create<LayoutEditorState>((set) => ({
  sections: DEFAULT_SECTIONS,
  templateName: "",
  isDirty: false,

  setSections: (sections) => set({ sections, isDirty: false }),

  setTemplateName: (name) => set({ templateName: name, isDirty: true }),

  toggleSection: (sectionId) =>
    set((state) => ({
      sections: state.sections.map((s) =>
        s.id === sectionId ? { ...s, enabled: !s.enabled } : s
      ),
      isDirty: true,
    })),

  reorderSections: (fromIndex, toIndex) =>
    set((state) => {
      const newSections = [...state.sections];
      const [moved] = newSections.splice(fromIndex, 1);
      newSections.splice(toIndex, 0, moved);
      return {
        sections: newSections.map((s, i) => ({ ...s, order: i })),
        isDirty: true,
      };
    }),

  updateSectionOptions: (sectionId, options) =>
    set((state) => ({
      sections: state.sections.map((s) =>
        s.id === sectionId ? { ...s, options: { ...s.options, ...options } } : s
      ),
      isDirty: true,
    })),

  resetToDefault: () =>
    set({ sections: DEFAULT_SECTIONS, templateName: "", isDirty: false }),
}));
