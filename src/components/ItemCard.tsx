import { useState } from 'react'
import type { Bucket, Item } from '../types'
import { BUCKETS, BUCKET_LABELS, isOverdue } from '../types'

function age(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return '1d'
  return `${days}d`
}

interface Props {
  item: Item
  onMove: (to: Bucket) => void
  onSaveNotes: (notes: string) => void
}

export default function ItemCard({ item, onMove, onSaveNotes }: Props) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState(item.notes ?? '')
  const overdue = isOverdue(item)

  return (
    <div className={overdue ? 'card overdue' : 'card'}>
      <button className="card-body" onClick={() => setOpen(!open)}>
        <div className="card-title">{item.title}</div>
        <div className="card-meta">
          <span>{age(item.created_at)}</span>
          {item.bucket === 'standing_by' && item.waiting_on && (
            <span>· waiting on {item.waiting_on}</span>
          )}
          {item.bucket === 'standing_by' && item.chase_by && (
            <span className={overdue ? 'chase overdue-text' : 'chase'}>
              · chase {item.chase_by}
              {overdue && ' — overdue'}
            </span>
          )}
          {item.bucket === 'closed' && item.closed_at && (
            <span>· closed {item.closed_at.slice(0, 10)}</span>
          )}
        </div>
        {!open && item.notes && <div className="card-notes-preview">{item.notes}</div>}
      </button>
      {open && (
        <div className="card-actions">
          <textarea
            placeholder="Notes…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if (notes !== (item.notes ?? '')) onSaveNotes(notes)
            }}
            rows={2}
          />
          <div className="move-row">
            {BUCKETS.filter((b) => b !== item.bucket).map((b) => (
              <button key={b} className="move-btn" onClick={() => onMove(b)}>
                → {BUCKET_LABELS[b]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
