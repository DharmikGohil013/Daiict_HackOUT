import type { Role } from '@/types';

export const ROUTES = {
  landing: '/',
  login: '/login',
  government: {
    dashboard: '/government/dashboard',
    claims: '/government/claims',
    claim: (id: string) => `/government/claims/${id}`,
    approvals: '/government/approvals',
    investigations: '/government/investigations',
    investigation: (id: string) => `/government/investigations/${id}`,
    plants: '/government/plants',
    plant: (id: string) => `/government/plants/${id}`,
    institutions: '/government/institutions',
    institution: (id: string) => `/government/institutions/${id}`,
    fraudNetwork: '/government/fraud-network',
    certificates: '/government/certificates',
    certificate: (id: string) => `/government/certificates/${id}`,
    audit: '/government/audit',
    analytics: '/government/analytics',
    settings: '/government/settings',
  },
  generator: {
    dashboard: '/generator/dashboard',
    generation: '/generator/generation',
    forecast: '/generator/forecast',
    submit: '/generator/submit',
    claims: '/generator/claims',
    profile: '/generator/profile',
  },
  institution: {
    dashboard: '/institution/dashboard',
    submitClaim: '/institution/claims/new',
    claims: '/institution/claims',
    claim: (id: string) => `/institution/claims/${id}`,
    certificates: '/institution/certificates',
    transactions: '/institution/transactions',
    profile: '/institution/profile',
  },
  issuer: { createRec: '/issuer/create-rec' },
  verifier: '/verifier',
} as const;

export function homeForRole(role: Role | null | undefined): string {
  switch (role) {
    case 'government':
    case 'regulator':
    case 'admin':
    case 'auditor': return ROUTES.government.dashboard;
    case 'generator': return ROUTES.generator.dashboard;
    case 'institution':
    case 'buyer': return ROUTES.institution.dashboard;
    case 'issuer': return ROUTES.issuer.createRec;
    default: return ROUTES.landing;
  }
}

export const GOV_ROLES: Role[] = ['government', 'regulator', 'admin', 'auditor'];
