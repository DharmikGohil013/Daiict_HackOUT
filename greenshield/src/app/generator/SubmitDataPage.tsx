import { useState, type FormEvent, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSubmitGeneration, useUploadGeneration } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { Loader2 } from 'lucide-react';
import { Field } from '@/components/common/FilterBar';
import { useToast } from '@/components/common/Toast';
import { ROUTES } from '@/lib/routes';
import type { ApiError } from '@/types';

export default function SubmitDataPage() {
  const plantId = useAuth((s) => s.user?.entity_id) ?? '';
  const submit = useSubmitGeneration();
  const upload = useUploadGeneration();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialDate = searchParams.get('date') || '';
  
  const [form, setForm] = useState({ date: initialDate, time: '', generation_kwh: '', meter_reading_kwh: '', operating_hours: '' });
  const [file, setFile] = useState<File | null>(null);

  const onManual = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const r = await submit.mutateAsync({ plantId, rows: [{ date: form.date, hour: form.time ? Number(form.time.split(':')[0]) : null, generation_kwh: Number(form.generation_kwh), meter_reading_kwh: form.meter_reading_kwh ? Number(form.meter_reading_kwh) : null, operating_hours: form.operating_hours ? Number(form.operating_hours) : null }] });
      toast.success('Generation data recorded', `${r.rows} row(s) for ${r.first_date}. Data is pending approval by the Issuing Officer.`);
      navigate(ROUTES.generator.generation);
    } catch (err) { toast.error('Submission failed', (err as ApiError).message + ((err as ApiError).details ? ` — ${(err as ApiError).details!.join(' ')}` : '')); }
  };
  const onUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    try {
      const r = await upload.mutateAsync({ plantId, file });
      toast.success('CSV uploaded', `${r.rows} row(s), ${r.first_date} → ${r.last_date}`);
      navigate(ROUTES.generator.generation);
    } catch (err) { toast.error('Upload failed', (err as ApiError).message); }
  };
  return (
    <>
      <PageHeader eyebrow="Generator portal" title="Submit generation data" subtitle="Manual entry for a single day or a CSV export from your meter/SCADA system." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Manual entry">
          <form onSubmit={onManual} className="grid gap-3 sm:grid-cols-2">
            <Field id="g-date" label="Date"><input id="g-date" type="date" className="field" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field id="g-time" label="Time (blank = daily total)"><input id="g-time" type="time" className="field" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></Field>
            <Field id="g-gen" label="Generation (kWh)"><input id="g-gen" type="number" min="0" step="0.1" className="field" required value={form.generation_kwh} onChange={(e) => setForm({ ...form, generation_kwh: e.target.value })} /></Field>
            <Field id="g-meter" label="Meter reading (kWh)"><input id="g-meter" type="number" min="0" step="0.1" className="field" value={form.meter_reading_kwh} onChange={(e) => setForm({ ...form, meter_reading_kwh: e.target.value })} /></Field>
            <Field id="g-hours" label="Operating hours"><input id="g-hours" type="number" min="0" max="24" step="0.1" className="field" value={form.operating_hours} onChange={(e) => setForm({ ...form, operating_hours: e.target.value })} /></Field>
            <div className="flex items-end">
              <button className="btn btn-primary w-full" type="submit" disabled={submit.isPending}>
                {submit.isPending ? <><Loader2 size={16} className="animate-spin" /><span>Saving…</span></> : 'Save reading'}
              </button>
            </div>
          </form>
        </Panel>
        <Panel title="CSV upload" subtitle="Columns: Date, Time, Generation, Meter Reading, Operating Hours">
          <form onSubmit={onUpload} className="space-y-3">
            <input id="g-file" type="file" accept=".csv,text/csv" className="field" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="CSV file" />
            <button className="btn btn-primary" type="submit" disabled={!file || upload.isPending}>
              {upload.isPending ? <><Loader2 size={16} className="animate-spin" /><span>Uploading…</span></> : 'Upload Generation Data'}
            </button>
          </form>
        </Panel>
      </div>
    </>
  );
}
