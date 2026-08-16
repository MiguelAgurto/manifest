import { supabase } from './supabase'
import type { Item } from '../types'

const SNAPSHOT_KEY = 'manifest.items'
const QUEUE_KEY = 'manifest.queue'

export interface QueuedCapture {
  id: string // client-generated, becomes the row id so a retried flush can't duplicate
  title: string
  created_at: string
}

export function loadSnapshot(): Item[] {
  try {
    return JSON.parse(localStorage.getItem(SNAPSHOT_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveSnapshot(items: Item[]) {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(items))
}

export function loadQueue(): QueuedCapture[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveQueue(queue: QueuedCapture[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export function enqueueCapture(title: string): QueuedCapture {
  const capture: QueuedCapture = {
    id: crypto.randomUUID(),
    title,
    created_at: new Date().toISOString(),
  }
  saveQueue([...loadQueue(), capture])
  return capture
}

/** Push queued captures to Supabase. Returns true if anything was flushed. */
export async function flushQueue(): Promise<boolean> {
  const queue = loadQueue()
  if (queue.length === 0) return false
  const { error } = await supabase.from('items').upsert(
    queue.map((c) => ({ id: c.id, title: c.title, created_at: c.created_at })),
    { onConflict: 'id' },
  )
  if (error) return false
  saveQueue([])
  return true
}
