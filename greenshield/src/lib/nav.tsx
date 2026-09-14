import { LayoutDashboard, FileSearch, SearchCheck, Factory, Building2, Share2, FileBadge2, ScrollText, BarChart3, Settings, Activity, TrendingUp, Upload, FilePlus2, Receipt, UserCircle2, ShieldCheck, Stamp } from 'lucide-react';
import type { NavItem } from '@/components/common/Sidebar';
import { ROUTES } from './routes';

export const GOV_NAV: NavItem[] = [
  { to: ROUTES.government.dashboard,    label: 'Dashboard',        icon: LayoutDashboard, group: 'Overview' },
  { to: ROUTES.government.claims,       label: 'Claims',           icon: FileSearch,      group: 'Claims & Verification' },
  { to: ROUTES.government.approvals,    label: 'Issuing Approvals',icon: FilePlus2,       group: 'Claims & Verification' },
  { to: ROUTES.government.recVerifier,  label: 'REC Verifier',     icon: ShieldCheck,     group: 'Claims & Verification' },
  { to: ROUTES.government.investigations, label: 'Investigations', icon: SearchCheck,     group: 'Enforcement' },
  { to: ROUTES.government.fraudNetwork, label: 'Fraud Network',    icon: Share2,          group: 'Enforcement' },
  { to: ROUTES.government.plants,       label: 'Plants',           icon: Factory,         group: 'Registry' },
  { to: ROUTES.government.institutions, label: 'Institutions',     icon: Building2,       group: 'Registry' },
  { to: ROUTES.government.certificates, label: 'Certificates',     icon: FileBadge2,      group: 'Registry' },
  { to: ROUTES.government.analytics,    label: 'Analytics',        icon: BarChart3,       group: 'System' },
  { to: ROUTES.government.audit,        label: 'Audit Trail',      icon: ScrollText,      group: 'System' },
  { to: ROUTES.government.settings,     label: 'Settings',         icon: Settings,        group: 'System' },
];

export const GEN_NAV: NavItem[] = [
  { to: ROUTES.generator.dashboard, label: 'Dashboard', icon: LayoutDashboard },
  { to: ROUTES.generator.generation, label: 'Generation', icon: Activity },
  { to: ROUTES.generator.forecast, label: 'Forecast', icon: TrendingUp },
  { to: ROUTES.generator.submit, label: 'Submit Data', icon: Upload },
  { to: ROUTES.generator.claims, label: 'Claims', icon: FileSearch },
  { to: ROUTES.generator.profile, label: 'Plant Profile', icon: Factory },
];

export const INST_NAV: NavItem[] = [
  { to: ROUTES.institution.dashboard, label: 'Dashboard', icon: LayoutDashboard },
  { to: ROUTES.institution.submitClaim, label: 'Submit Claim', icon: FilePlus2 },
  { to: ROUTES.institution.claims, label: 'Claims', icon: FileSearch, end: true },
  { to: ROUTES.institution.certificates, label: 'Certificates', icon: FileBadge2 },
  { to: ROUTES.institution.transactions, label: 'Transactions', icon: Receipt },
  { to: ROUTES.institution.profile, label: 'Profile', icon: UserCircle2 },
];

export const ISSUER_NAV: NavItem[] = [
  { to: ROUTES.issuer.createRec, label: 'Issue REC', icon: Stamp },
  { to: ROUTES.verifier, label: 'REC Verifier', icon: ShieldCheck },
];
