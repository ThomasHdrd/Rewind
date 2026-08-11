import { create } from "zustand";

interface ToastState {
  message: string | null;
  actionLabel?: string;
  onAction?: () => void;
  show: (message: string, opts?: { actionLabel?: string; onAction?: () => void; durationMs?: number }) => void;
  hide: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  actionLabel: undefined,
  onAction: undefined,
  show: (message, opts) => {
    if (timer) clearTimeout(timer);
    set({ message, actionLabel: opts?.actionLabel, onAction: opts?.onAction });
    timer = setTimeout(() => set({ message: null, actionLabel: undefined, onAction: undefined }), opts?.durationMs ?? 3000);
  },
  hide: () => {
    if (timer) clearTimeout(timer);
    set({ message: null, actionLabel: undefined, onAction: undefined });
  },
}));
