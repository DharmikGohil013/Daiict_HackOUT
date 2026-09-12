import { request } from './client';
import type { Role, Session, User } from '@/types';

export const authApi = {
  login: (email: string, password: string, role?: Role) => request<Session>({ method: 'post', url: '/auth/login', data: { email, password, role } }),
  demo: (role: 'government' | 'generator' | 'institution' | 'issuer') => request<Session>({ method: 'post', url: `/auth/demo/${role}` }),
  me: () => request<User & { success: boolean }>({ method: 'get', url: '/auth/me' }),
};
