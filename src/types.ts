export type Bucket = 'inbound' | 'in_hand' | 'standing_by' | 'parked' | 'closed'

/** Trash isn't a bucket — it's a view of items with deleted_at set. */
export type Tab = Bucket | 'trash'

export interface Item {
  id: string
  title: string
  notes: string | null
  bucket: Bucket
  waiting_on: string | null
  chase_by: string | null
  tags: string[]
  created_at: string
  updated_at: string
  closed_at: string | null
  deleted_at: string | null
}

export const BUCKETS: Bucket[] = ['inbound', 'in_hand', 'standing_by', 'parked', 'closed']

export const TABS: Tab[] = [...BUCKETS, 'trash']

export const TAB_LABELS: Record<Tab, string> = {
  inbound: 'Inbound',
  in_hand: 'In hand',
  standing_by: 'Standing by',
  parked: 'Parked',
  closed: 'Closed',
  trash: 'Trash',
}

export const TAB_EMOJI: Record<Tab, string> = {
  inbound: '📥',
  in_hand: '⚡',
  standing_by: '⏳',
  parked: '📦',
  closed: '✅',
  trash: '🗑️',
}

/** Kept for the move buttons, which only ever target real buckets. */
export const BUCKET_LABELS: Record<Bucket, string> = {
  inbound: TAB_LABELS.inbound,
  in_hand: TAB_LABELS.in_hand,
  standing_by: TAB_LABELS.standing_by,
  parked: TAB_LABELS.parked,
  closed: TAB_LABELS.closed,
}

export function isOverdue(item: Item, today = new Date()): boolean {
  if (item.bucket !== 'standing_by' || !item.chase_by) return false
  const d = new Date(item.chase_by + 'T23:59:59')
  return d < today
}

/** Normalize a typed tag: trimmed, lowercased, no leading '#'. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, '').toLowerCase()
}

/** Friendly name for the greeting — user metadata if set, else the email local part. */
export function displayName(email: string | undefined, metaName?: string): string {
  if (metaName?.trim()) return metaName.trim()
  const local = (email ?? '').split('@')[0] ?? ''
  const word = local.split(/[._-]/)[0] ?? ''
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : 'there'
}
