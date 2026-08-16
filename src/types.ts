export type Bucket = 'inbound' | 'in_hand' | 'standing_by' | 'parked' | 'closed'

/** Trash isn't a bucket — it's a view of items with deleted_at set. */
export type Tab = Bucket | 'trash'

/** Orthogonal to bucket. Numeric so it sorts without a lookup. */
export type Priority = 0 | 1 | 2

export const HIGH: Priority = 2
export const NORMAL: Priority = 1
export const LOW: Priority = 0

/** High first — the order the picker and the board both use. */
export const PRIORITIES: Priority[] = [HIGH, NORMAL, LOW]

export const PRIORITY_LABELS: Record<Priority, string> = {
  2: 'High',
  1: 'Normal',
  0: 'Low',
}

export const PRIORITY_EMOJI: Record<Priority, string> = {
  2: '🔴',
  1: '⚪',
  0: '🔵',
}

export interface Item {
  id: string
  title: string
  notes: string | null
  bucket: Bucket
  waiting_on: string | null
  chase_by: string | null
  tags: string[]
  priority: Priority
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
