import { create } from "zustand";
import type { SemanticField, DatasetProfile } from "@/types";

interface SemanticStore {
  datasetId: string | null;
  profile: DatasetProfile | null;
  fields: SemanticField[];
  suggestions: SemanticField[] | null;
  confirmed: boolean;
  loading: boolean;
  setDatasetId: (id: string) => void;
  setProfile: (profile: DatasetProfile) => void;
  setFields: (fields: SemanticField[]) => void;
  updateField: (index: number, field: Partial<SemanticField>) => void;
  setSuggestions: (suggestions: SemanticField[] | null) => void;
  setConfirmed: (confirmed: boolean) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useSemanticStore = create<SemanticStore>((set) => ({
  datasetId: null,
  profile: null,
  fields: [],
  suggestions: null,
  confirmed: false,
  loading: false,
  setDatasetId: (id) => set({ datasetId: id }),
  setProfile: (profile) => set({ profile }),
  setFields: (fields) => set({ fields }),
  updateField: (index, field) =>
    set((state) => ({
      fields: state.fields.map((f, i) =>
        i === index ? { ...f, ...field } : f
      ),
    })),
  setSuggestions: (suggestions) => set({ suggestions }),
  setConfirmed: (confirmed) => set({ confirmed }),
  setLoading: (loading) => set({ loading }),
  reset: () =>
    set({
      datasetId: null,
      profile: null,
      fields: [],
      suggestions: null,
      confirmed: false,
      loading: false,
    }),
}));
