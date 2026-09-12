import { MOCK_API } from '@/services/api/client';

export function SampleDataBadge() {
  if (!MOCK_API) return null;
  return <span className="chip bg-medium-soft text-medium" title="VITE_MOCK_API=true — responses come from bundled sample data, not the backend">Sample data · no backend</span>;
}
