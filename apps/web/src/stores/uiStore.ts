import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  themeMode: 'light' | 'dark';
  navRailExpanded: boolean;
  density: 'comfortable' | 'compact';
  activePatientId: string | null;
  globalSearchOpen: boolean;

  toggleThemeMode: () => void;
  setThemeMode: (mode: 'light' | 'dark') => void;
  toggleNavRail: () => void;
  setNavRailExpanded: (expanded: boolean) => void;
  setDensity: (density: 'comfortable' | 'compact') => void;
  setActivePatientId: (patientId: string | null) => void;
  setGlobalSearchOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      themeMode: 'light',
      navRailExpanded: true,
      density: 'comfortable',
      activePatientId: null,
      globalSearchOpen: false,

      toggleThemeMode: () =>
        set((state) => ({ themeMode: state.themeMode === 'light' ? 'dark' : 'light' })),
      setThemeMode: (mode) => set({ themeMode: mode }),
      toggleNavRail: () => set((state) => ({ navRailExpanded: !state.navRailExpanded })),
      setNavRailExpanded: (expanded) => set({ navRailExpanded: expanded }),
      setDensity: (density) => set({ density }),
      setActivePatientId: (activePatientId) => set({ activePatientId }),
      setGlobalSearchOpen: (globalSearchOpen) => set({ globalSearchOpen }),
    }),
    {
      name: 'ehr-ui-storage',
    }
  )
);
