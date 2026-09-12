import { useState } from 'react';
import { Modal } from './Modal';
import { cn } from '@/lib/cn';

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', tone = 'primary', withNote, noteLabel = 'Note for the audit trail', busy }: {
  open: boolean; onClose: () => void; onConfirm: (note?: string) => void; title: string; message: string; confirmLabel?: string; tone?: 'primary' | 'danger'; withNote?: boolean; noteLabel?: string; busy?: boolean;
}) {
  const [note, setNote] = useState('');
  return (
    <Modal open={open} onClose={onClose} title={title} footer={<>
      <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
      <button type="button" className={cn('btn', tone === 'danger' ? 'btn-danger' : 'btn-primary')} onClick={() => onConfirm(note.trim() || undefined)} disabled={busy}>{busy ? 'Working…' : confirmLabel}</button>
    </>}>
      <p className="text-sm text-ink-2">{message}</p>
      {withNote && (
        <label className="mt-4 block">
          <span className="label">{noteLabel}</span>
          <textarea className="field mt-1 min-h-[88px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional — recorded permanently with this decision" />
        </label>
      )}
    </Modal>
  );
}
