const storageMock: Record<string, string> = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storageMock[key] ?? null,
    setItem: (key: string, val: string) => { storageMock[key] = String(val); },
    removeItem: (key: string) => { delete storageMock[key]; },
    clear: () => { Object.keys(storageMock).forEach((k) => delete storageMock[k]); },
    key: (i: number) => Object.keys(storageMock)[i] ?? null,
    length: 0,
  },
  writable: true,
  configurable: true,
});

import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore, AuthUser } from './authStore.js';

describe('AuthStore Zustand Store', () => {
  const mockUser: AuthUser = {
    id: 'user-123',
    email: 'dr.house@hospital.org',
    name: {
      given: ['Gregory'],
      family: 'House',
      prefix: 'Dr.',
    },
    roles: ['PHYSICIAN'],
    permissions: ['patient:read', 'patient:update', 'note:write', 'note:sign'],
    facilityIds: ['fac-1'],
    activeFacilityId: 'fac-1',
  };

  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  it('initializes with unauthenticated state', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.isMfaRequired).toBe(false);
  });

  it('updates state on successful login authentication', () => {
    useAuthStore.getState().setAuth(mockUser);
    const state = useAuthStore.getState();

    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(mockUser);
    expect(state.isMfaRequired).toBe(false);
    expect(state.tempToken).toBeNull();
  });

  it('sets MFA challenge properly', () => {
    useAuthStore.getState().setMfaChallenge('temp-mfa-token-123');
    const state = useAuthStore.getState();

    expect(state.isAuthenticated).toBe(false);
    expect(state.isMfaRequired).toBe(true);
    expect(state.tempToken).toBe('temp-mfa-token-123');
  });

  it('verifies permissions correctly with hasPermission', () => {
    useAuthStore.getState().setAuth(mockUser);

    expect(useAuthStore.getState().hasPermission('patient:read')).toBe(true);
    expect(useAuthStore.getState().hasPermission('user:delete')).toBe(false);
  });

  it('super admin role bypasses permission checks', () => {
    const adminUser: AuthUser = {
      ...mockUser,
      roles: ['SUPER_ADMIN'],
      permissions: [],
    };
    useAuthStore.getState().setAuth(adminUser);

    expect(useAuthStore.getState().hasPermission('any:unassigned:permission')).toBe(true);
  });

  it('updates active facility ID', () => {
    useAuthStore.getState().setAuth(mockUser);
    useAuthStore.getState().setActiveFacility('fac-2');

    expect(useAuthStore.getState().user?.activeFacilityId).toBe('fac-2');
  });

  it('resets state on logout', () => {
    useAuthStore.getState().setAuth(mockUser);
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });
});
