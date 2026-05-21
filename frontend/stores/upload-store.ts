import { create } from "zustand";
import type { UploadState } from "@/types";

interface UploadStore extends UploadState {
  setFile: (file: File | null) => void;
  setProgress: (progress: number) => void;
  setStatus: (status: UploadState["status"]) => void;
  setError: (error: string | undefined) => void;
  setDatasetId: (id: string) => void;
  reset: () => void;
}

const initialState: UploadState = {
  file: null,
  progress: 0,
  status: "idle",
  error: undefined,
  dataset_id: undefined,
};

export const useUploadStore = create<UploadStore>((set) => ({
  ...initialState,
  setFile: (file) => set({ file }),
  setProgress: (progress) => set({ progress }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setDatasetId: (id) => set({ dataset_id: id }),
  reset: () => set(initialState),
}));
