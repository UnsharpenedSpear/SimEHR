import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
  token: string | null;
  isAuthenticated: boolean;
  isMfaRequired: boolean;
  tempToken: string | null;
  sessionTimeoutWarning: boolean;

  setAuth: (user: AuthUser, token?: string) => void;
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
      token: null,
      isAuthenticated: false,
      isMfaRequired: false,
      tempToken: null,
      sessionTimeoutWarning: false,

      setAuth: (user, token) =>
        set({
          user,
          token: token || get().token,
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
          token: null,
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
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage;
        }
        const memoryStorage: Record<string, string> = {};
        return {
          getItem: (key: string) => memoryStorage[key] ?? null,
          setItem: (key: string, val: string) => { memoryStorage[key] = val; },
          removeItem: (key: string) => { delete memoryStorage[key]; },
        };
      }),
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
);
