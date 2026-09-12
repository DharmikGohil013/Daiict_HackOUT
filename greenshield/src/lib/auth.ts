/** Session store (zustand) persisted to localStorage; token is also read by the axios interceptor. */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Role, Session, User } from '@/types';
import { writeToken } from '@/services/api/client';
import { GOV_ROLES } from '@/lib/routes';

interface AuthState {
  token: string | null;
  user: User | null;
  setSession: (s: Session) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (s) => {
        writeToken(s.access_token);
        set({ token: s.access_token, user: s.user });
      },
      logout: () => {
        writeToken(null);
        set({ token: null, user: null });
      },
    }),
    { name: 'greenshield.session', onRehydrateStorage: () => (state) => { if (state?.token) writeToken(state.token); } },
  ),
);

export const selectRole = (s: AuthState): Role | null => s.user?.role ?? null;
export const isGovernmentRole = (role: Role | null | undefined) => !!role && GOV_ROLES.includes(role);
