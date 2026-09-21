import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  name: {
    given: string[];
    family: string;
    prefix?: string;
  };
  roles: string[];
  permissions: string[];
  facilityIds: string[];
  activeFacilityId: string;
  professional?: {
    licenseNo?: string;
    specialty?: string;
    npi?: string;
  };
  forcePasswordChange?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isMfaRequired: boolean;
  tempToken: string | null;
  sessionTimeoutWarning: boolean;

  setAuth: (user: AuthUser) => void;
  setMfaChallenge: (tempToken: string) => void;
  setActiveFacility: (facilityId: string) => void;
  setSessionTimeoutWarning: (warning: boolean) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isMfaRequired: false,
      tempToken: null,
      sessionTimeoutWarning: false,

      setAuth: (user) =>
        set({
          user,
          isAuthenticated: true,
          isMfaRequired: false,
          tempToken: null,
          sessionTimeoutWarning: false,
        }),

      setMfaChallenge: (tempToken) =>
        set({
          tempToken,
          isMfaRequired: true,
          isAuthenticated: false,
        }),

      setActiveFacility: (facilityId) =>
        set((state) => ({
          user: state.user ? { ...state.user, activeFacilityId: facilityId } : null,
        })),

      setSessionTimeoutWarning: (warning) => set({ sessionTimeoutWarning: warning }),

      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          isMfaRequired: false,
          tempToken: null,
          sessionTimeoutWarning: false,
        }),

      hasPermission: (permission) => {
        const user = get().user;
        if (!user) return false;
        if (user.roles.includes('SUPER_ADMIN')) return true;
        return user.permissions.includes(permission);
      },

      hasRole: (role) => {
        const user = get().user;
        if (!user) return false;
        return user.roles.includes(role);
      },
    }),
    {
      name: 'ehr-auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
