export type Bucket = 'inbound' | 'in_hand' | 'standing_by' | 'parked' | 'closed'

export interface Item {
  id: string
  title: string
  notes: string | null
  bucket: Bucket
  waiting_on: string | null
  chase_by: string | null
  created_at: string
  updated_at: string
  closed_at: string | null
}

export const BUCKETS: Bucket[] = ['inbound', 'in_hand', 'standing_by', 'parked', 'closed']

export const BUCKET_LABELS: Record<Bucket, string> = {
  inbound: 'Inbound',
  in_hand: 'In hand',
  standing_by: 'Standing by',
  parked: 'Parked',
  closed: 'Closed',
}

export function isOverdue(item: Item, today = new Date()): boolean {
  if (item.bucket !== 'standing_by' || !item.chase_by) return false
  const d = new Date(item.chase_by + 'T23:59:59')
  return d < today
}
