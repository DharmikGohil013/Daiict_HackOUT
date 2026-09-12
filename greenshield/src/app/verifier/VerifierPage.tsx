import { PageHeader } from '@/components/common/PageHeader';
import { ManualVerifier } from '@/components/common/ManualVerifier';

export default function VerifierPage() {
  return (
    <>
      <PageHeader eyebrow="REC verifier module" title="Verify a certificate" subtitle="Upload a PDF or PNG. Four checks: steganographic integrity, signature authentication, ledger lookup, generation reconciliation." />
      <ManualVerifier />
    </>
  );
}
