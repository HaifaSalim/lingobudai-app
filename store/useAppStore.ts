
import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { UserProfile } from '../types';

interface TooltipState {
  visible: boolean;
  content: string;
  x: number;
  y: number;
}

interface AppState {
  session?: Session | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  tooltip: TooltipState;
  setSession: (session: Session | null) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearState: () => void;
  showTooltip: (content: string, x: number, y: number) => void;
  hideTooltip: () => void;
  updateTooltipContent: (content: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  session: undefined,
  userProfile: null,
  isLoading: false,
  error: null,
  tooltip: { visible: false, content: '', x: 0, y: 0 },
  setSession: (session) => set({ session }),
  setUserProfile: (profile) => set({ userProfile: profile }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  clearState: () => set({ session: null, userProfile: null, error: null, tooltip: { visible: false, content: '', x: 0, y: 0 } }),
  showTooltip: (content, x, y) => set(state => ({ tooltip: { ...state.tooltip, visible: true, content, x, y } })),
  hideTooltip: () => set(state => ({ tooltip: { ...state.tooltip, visible: false } })),
  updateTooltipContent: (content) => set(state => ({ tooltip: { ...state.tooltip, content } })),
}));
