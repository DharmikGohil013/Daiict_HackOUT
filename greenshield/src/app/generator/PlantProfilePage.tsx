import { useAuth } from '@/lib/auth';
import { Panel } from '@/components/common/Panel';
import { PlantProfileView } from '@/app/government/PlantProfilePage';

export default function GeneratorPlantProfilePage() {
  const plantId = useAuth((s) => s.user?.entity_id);
  if (!plantId) return <Panel><p className="text-sm text-ink-3">Your account is not linked to a plant.</p></Panel>;
  return <PlantProfileView plantId={plantId} />;
}
