import { useState } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, ChevronRight, Download, FileText, Share2 } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable';
import { RiskBadge } from '@/components/common/RiskBadge';
import { useClaims, useDecideClaim } from '@/lib/queries';
import { useToast } from '@/components/common/Toast';
import type { Claim } from '@/types';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/lib/routes';

import { ManualVerifier } from '@/components/common/ManualVerifier';

export default function RecVerifierPage() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const { data: result, isLoading } = useClaims({ status: 'submitted', limit: 100 });

  const claims = result?.claims || [];

  const decideMutation = useDecideClaim();

  const handleApprove = (id: string) => {
    decideMutation.mutate({ id, decision: 'approve' });
  };

  const handleReject = (id: string) => {
    decideMutation.mutate({ id, decision: 'reject', note: 'Rejected by Government Verifier' });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="REC Verifier"
        description="Review and approve REC claims submitted by institutions. You can also manually verify a certificate by uploading it."
        icon={ShieldCheck}
      />

      <ManualVerifier />

      <h2 className="text-lg font-display font-semibold pt-4">Pending Claims for Approval</h2>
      <div className="card p-0">
        <DataTable
          columns={[
            {
              header: 'Submission ID',
              key: 'claim_id',
              render: (row: Claim) => (
                <div className="flex flex-col">
                  <span className="font-mono text-sm font-medium text-primary">{row.claim_id}</span>
                  <span className="text-xs text-muted-fg">{new Date(row.submitted_at).toLocaleDateString()}</span>
                </div>
              ),
            },
            {
              header: 'Institution',
              key: 'institution_id',
              render: (row: Claim) => (
                <div className="flex flex-col">
                  <span className="font-medium text-ink">{row.institution_name}</span>
                  <span className="text-xs text-muted-fg">{row.institution_id}</span>
                </div>
              ),
            },
            {
              header: 'Plant Details',
              key: 'plant_id',
              render: (row: Claim) => (
                <div className="flex flex-col">
                  <span className="font-medium text-ink">{row.plant_name}</span>
                  <span className="text-xs text-muted-fg font-mono">{row.plant_id}</span>
                </div>
              ),
            },
            {
              header: 'Energy Claimed',
              key: 'claimed_kwh',
              render: (row: Claim) => (
                <div className="flex flex-col">
                  <span className="font-medium text-ink">{row.claimed_kwh.toLocaleString()} kWh</span>
                  <span className="text-xs text-muted-fg">
                    {row.period_start} to {row.period_end}
                  </span>
                </div>
              ),
            },
            {
              header: 'AI Pre-Check',
              key: 'risk_level',
              render: (row: Claim) => {
                const isHighRisk = ['HIGH', 'CRITICAL'].includes(row.risk_level as string);
                return (
                  <div className="flex flex-col gap-1">
                    <RiskBadge score={row.risk_score || row.fraud_score?.total || 0} level={row.risk_level} />
                  </div>
                );
              },
            },
            {
              header: 'Action',
              key: 'status',
              render: (row: Claim) => (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApprove(row.claim_id)}
                    disabled={decideMutation.isPending}
                    className="btn btn-sm btn-primary py-1 px-3 text-xs"
                  >
                    <CheckCircle2 size={14} className="mr-1" /> Approve
                  </button>
                  <button
                    onClick={() => handleReject(row.claim_id)}
                    disabled={decideMutation.isPending}
                    className="btn btn-sm btn-outline py-1 px-3 text-xs border-red-500/30 text-red-500 hover:bg-red-500/10"
                  >
                    <XCircle size={14} className="mr-1" /> Reject
                  </button>
                  <button
                    onClick={() => navigate(ROUTES.government.claim(row.claim_id))}
                    className="btn btn-sm btn-ghost p-1 text-muted-fg hover:text-primary"
                    title="View Details"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              ),
            },
          ]}
          rows={claims}
          rowKey={(row) => row.claim_id}
          loading={isLoading}
          emptyText="No pending claims awaiting verification."
        />
      </div>
    </div>
  );
}
