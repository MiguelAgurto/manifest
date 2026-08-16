import { useState } from 'react'
import type { Bucket, Item } from '../types'
import { BUCKETS, BUCKET_LABELS, TAB_EMOJI, isOverdue, normalizeTag } from '../types'

function age(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return '1d'
  return `${days}d`
}

interface Props {
  item: Item
  suggestions: string[]
  onMove: (to: Bucket) => void
  onSaveNotes: (notes: string) => void
  onSetTags: (tags: string[]) => void
  onTagClick: (tag: string) => void
  onTrash: () => void
  onRestore: () => void
  onPurge: () => void
}

export default function ItemCard({
  item,
  suggestions,
  onMove,
  onSaveNotes,
  onSetTags,
  onTagClick,
  onTrash,
  onRestore,
  onPurge,
}: Props) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState(item.notes ?? '')
  const [tagDraft, setTagDraft] = useState('')
  const overdue = isOverdue(item)
  const trashed = Boolean(item.deleted_at)
  const tags = item.tags ?? []

  function addTag(raw: string) {
    const tag = normalizeTag(raw)
    setTagDraft('')
    if (!tag || tags.includes(tag)) return
    onSetTags([...tags, tag])
  }

  const unused = suggestions.filter((t) => !tags.includes(t)).slice(0, 6)

  return (
    <div className={`card${overdue ? ' overdue' : ''}${trashed ? ' trashed' : ''}`}>
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
          {trashed && item.deleted_at && (
            <span>
              · from {TAB_EMOJI[item.bucket]} {BUCKET_LABELS[item.bucket]}
            </span>
          )}
        </div>
        {tags.length > 0 && (
          <div className="card-tags">
            {tags.map((t) => (
              <span
                key={t}
                className="tag"
                onClick={(e) => {
                  e.stopPropagation()
                  onTagClick(t)
                }}
              >
                #{t}
              </span>
            ))}
          </div>
        )}
        {!open && item.notes && <div className="card-notes-preview">{item.notes}</div>}
      </button>

      {open && (
        <div className="card-actions">
          {trashed ? (
            <div className="move-row">
              <button className="move-btn" onClick={onRestore}>
                ↩︎ Restore
              </button>
              <button className="move-btn danger-btn" onClick={onPurge}>
                🗑️ Delete for good
              </button>
            </div>
          ) : (
            <>
              <textarea
                placeholder="Notes…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => {
                  if (notes !== (item.notes ?? '')) onSaveNotes(notes)
                }}
                rows={2}
              />

              <div className="tag-editor">
                {tags.map((t) => (
                  <span key={t} className="tag editable">
                    #{t}
                    <button
                      className="tag-x"
                      aria-label={`Remove ${t}`}
                      onClick={() => onSetTags(tags.filter((x) => x !== t))}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  className="tag-input"
                  placeholder="+ tag"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault()
                      addTag(tagDraft)
                    }
                  }}
                  onBlur={() => addTag(tagDraft)}
                />
              </div>

              {unused.length > 0 && (
                <div className="tag-suggest">
                  {unused.map((t) => (
                    <button key={t} className="tag-chip" onClick={() => addTag(t)}>
                      + #{t}
                    </button>
                  ))}
                </div>
              )}

              <div className="move-row">
                {BUCKETS.filter((b) => b !== item.bucket).map((b) => (
                  <button key={b} className="move-btn" onClick={() => onMove(b)}>
                    {TAB_EMOJI[b]} {BUCKET_LABELS[b]}
                  </button>
                ))}
                <button className="move-btn danger-btn" onClick={onTrash}>
                  🗑️ Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
