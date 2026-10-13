import { create } from 'zustand';

type Theme = 'light' | 'dark';
interface WorkspaceState {
  theme: Theme;
  toggleTheme: () => void;
}

// Only implemented UI preferences live here. Document state arrives in Phase 2.
export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  theme: 'light',
  toggleTheme: () =>
    set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
}));
