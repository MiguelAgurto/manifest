import { useState } from 'react'
import SwipeRow from './SwipeRow'
import type { Side } from './SwipeRow'
import type { Bucket, Item, Priority } from '../types'
import {
  BUCKETS,
  NORMAL,
  PRIORITIES,
  PRIORITY_EMOJI,
  PRIORITY_LABELS,
  TAB_EMOJI,
  TAB_LABELS,
  isOverdue,
  normalizeTag,
} from '../types'

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
  onSetPriority: (priority: Priority) => void
  onTagClick: (tag: string) => void
  onTogglePin: () => void
  onTrash: () => void
  onRestore: () => void
  onPurge: () => void
  swiped: Side
  onSwipe: (side: Side) => void
}

export default function ItemCard({
  item,
  suggestions,
  onMove,
  onSaveNotes,
  onSetTags,
  onSetPriority,
  onTagClick,
  onTogglePin,
  onTrash,
  onRestore,
  onPurge,
  swiped,
  onSwipe,
}: Props) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState(item.notes ?? '')
  const [tagDraft, setTagDraft] = useState('')
  const overdue = isOverdue(item)
  const trashed = Boolean(item.deleted_at)
  const tags = item.tags ?? []
  const priority = (item.priority ?? NORMAL) as Priority

  function addTag(raw: string) {
    const tag = normalizeTag(raw)
    setTagDraft('')
    if (!tag || tags.includes(tag)) return
    onSetTags([...tags, tag])
  }

  const unused = suggestions.filter((t) => !tags.includes(t)).slice(0, 6)
  const pinned = Boolean(item.pinned)

  /** Run a swipe action and let the row slide shut behind it. */
  const act = (fn: () => void) => () => {
    onSwipe(null)
    fn()
  }

  // Closed and trashed items can't be pinned, so they only swipe one way.
  const canPin = !trashed && item.bucket !== 'closed'
  const canClose = !trashed && item.bucket !== 'closed'

  const card = (
    <div
      className={`card p${priority}${overdue ? ' overdue' : ''}${trashed ? ' trashed' : ''}${
        pinned ? ' pinned' : ''
      }`}
    >
      <button className="card-body" onClick={() => setOpen(!open)}>
        <div className="card-title">
          {pinned && <span className="pin-star" title="Pinned">⭐</span>}
          {/* Normal is the default — only the exceptions earn a marker. */}
          {priority !== NORMAL && (
            <span className="priority-dot" title={PRIORITY_LABELS[priority]}>
              {PRIORITY_EMOJI[priority]}
            </span>
          )}
          {item.title}
        </div>
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
              · from {TAB_EMOJI[item.bucket]} {TAB_LABELS[item.bucket]}
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
              <div className="priority-row">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    className={p === priority ? 'prio-btn active' : 'prio-btn'}
                    aria-pressed={p === priority}
                    onClick={() => onSetPriority(p)}
                  >
                    {PRIORITY_EMOJI[p]} {PRIORITY_LABELS[p]}
                  </button>
                ))}
              </div>

              {/* Same actions as the swipe gestures, for desktop and a11y. */}
              {canPin && (
                <button
                  className={pinned ? 'pin-btn active' : 'pin-btn'}
                  aria-pressed={pinned}
                  onClick={onTogglePin}
                >
                  {pinned ? '⭐ Pinned to top — tap to unpin' : '☆ Pin to top'}
                </button>
              )}

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
                    {TAB_EMOJI[b]} {TAB_LABELS[b]}
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

  return (
    <SwipeRow
      open={swiped}
      onOpenChange={onSwipe}
      leftCount={1}
      rightCount={trashed ? 2 : canClose ? 2 : 1}
      left={
        canPin ? (
          <button className="swipe-action pin" onClick={act(onTogglePin)}>
            <span>{pinned ? '☆' : '⭐'}</span>
            {pinned ? 'Unpin' : 'Pin'}
          </button>
        ) : undefined
      }
      right={
        trashed ? (
          <>
            <button className="swipe-action restore" onClick={act(onRestore)}>
              <span>↩︎</span>Restore
            </button>
            <button className="swipe-action delete" onClick={act(onPurge)}>
              <span>🗑️</span>Delete
            </button>
          </>
        ) : (
          <>
            {canClose && (
              <button className="swipe-action done" onClick={act(() => onMove('closed'))}>
                <span>✅</span>Done
              </button>
            )}
            <button className="swipe-action delete" onClick={act(onTrash)}>
              <span>🗑️</span>Delete
            </button>
          </>
        )
      }
    >
      {card}
    </SwipeRow>
  )
}
