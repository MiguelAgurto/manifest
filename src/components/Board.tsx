import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  enqueueCapture,
  flushQueue,
  loadQueue,
  loadSnapshot,
  saveSnapshot,
} from '../lib/offline'
import type { Bucket, Item } from '../types'
import { BUCKETS, BUCKET_LABELS, isOverdue } from '../types'
import ItemCard from './ItemCard'
import MoveSheet from './MoveSheet'

export default function Board() {
  const [items, setItems] = useState<Item[]>(loadSnapshot)
  const [queued, setQueued] = useState(loadQueue)
  const [tab, setTab] = useState<Bucket>('inbound')
  const [online, setOnline] = useState(navigator.onLine)
  const [capture, setCapture] = useState('')
  const [search, setSearch] = useState('')
  const [moving, setMoving] = useState<Item | null>(null) // item picking a standing_by target

  const refresh = useCallback(async () => {
    await flushQueue()
    setQueued(loadQueue())
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) {
      setItems(data)
      saveSnapshot(data)
    }
  }, [])

  useEffect(() => {
    refresh()
    const goOnline = () => {
      setOnline(true)
      refresh()
    }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [refresh])

  async function addCapture(title: string) {
    const trimmed = title.trim()
    if (!trimmed) return
    setCapture('')
    const { data, error } = await supabase
      .from('items')
      .insert({ title: trimmed })
      .select()
      .single()
    if (error || !data) {
      // No connection (or request failed) — queue locally, flush later.
      enqueueCapture(trimmed)
      setQueued(loadQueue())
      return
    }
    setItems((prev) => {
      const next = [data as Item, ...prev]
      saveSnapshot(next)
      return next
    })
  }

  async function moveItem(
    item: Item,
    to: Bucket,
    extra: { waiting_on?: string | null; chase_by?: string | null } = {},
  ) {
    if (!online) {
      alert('Moves need a connection — try again when back online.')
      return
    }
    const now = new Date().toISOString()
    const patch = {
      bucket: to,
      waiting_on: to === 'standing_by' ? (extra.waiting_on ?? null) : null,
      chase_by: to === 'standing_by' ? (extra.chase_by ?? null) : null,
      closed_at: to === 'closed' ? now : null,
      updated_at: now,
    }
    const { error } = await supabase.from('items').update(patch).eq('id', item.id)
    if (error) {
      alert(`Move failed: ${error.message}`)
      return
    }
    await supabase
      .from('item_events')
      .insert({ item_id: item.id, from_bucket: item.bucket, to_bucket: to })
    setItems((prev) => {
      const next = prev.map((i) => (i.id === item.id ? { ...i, ...patch } : i))
      saveSnapshot(next)
      return next
    })
  }

  async function saveNotes(item: Item, notes: string) {
    const patch = { notes: notes.trim() || null, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('items').update(patch).eq('id', item.id)
    if (error) {
      alert(`Save failed: ${error.message}`)
      return
    }
    setItems((prev) => {
      const next = prev.map((i) => (i.id === item.id ? { ...i, ...patch } : i))
      saveSnapshot(next)
      return next
    })
  }

  const visible = useMemo(() => {
    let list = items.filter((i) => i.bucket === tab)
    if (tab === 'closed' && search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) || (i.notes ?? '').toLowerCase().includes(q),
      )
    }
    if (tab === 'standing_by') {
      list = [...list].sort((a, b) => {
        const ao = isOverdue(a) ? 0 : 1
        const bo = isOverdue(b) ? 0 : 1
        if (ao !== bo) return ao - bo
        return (a.chase_by ?? '9999') < (b.chase_by ?? '9999') ? -1 : 1
      })
    }
    return list
  }, [items, tab, search])

  const counts = useMemo(() => {
    const c = Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<Bucket, number>
    for (const i of items) c[i.bucket]++
    c.inbound += queued.length
    return c
  }, [items, queued])

  return (
    <div className="board">
      <header>
        <span className="brand">Manifest</span>
        {!online && <span className="pill offline-pill">offline</span>}
        {queued.length > 0 && (
          <span className="pill queue-pill">{queued.length} queued</span>
        )}
        <button className="signout" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </header>

      <form
        className="capture"
        onSubmit={(e) => {
          e.preventDefault()
          addCapture(capture)
        }}
      >
        <input
          placeholder="Capture something…"
          value={capture}
          onChange={(e) => setCapture(e.target.value)}
          enterKeyHint="done"
        />
        <button type="submit">Add</button>
      </form>

      <nav className="tabs">
        {BUCKETS.map((b) => (
          <button
            key={b}
            className={b === tab ? 'tab active' : 'tab'}
            onClick={() => setTab(b)}
          >
            {BUCKET_LABELS[b]}
            {counts[b] > 0 && <span className="count">{counts[b]}</span>}
          </button>
        ))}
      </nav>

      {tab === 'closed' && (
        <input
          className="search"
          placeholder="Search history…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}

      <main>
        {tab === 'inbound' &&
          queued.map((q) => (
            <div key={q.id} className="card queued-card">
              <div className="card-title">{q.title}</div>
              <div className="card-meta">waiting for connection</div>
            </div>
          ))}
        {visible.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            onMove={(to) =>
              to === 'standing_by' ? setMoving(item) : moveItem(item, to)
            }
            onSaveNotes={(notes) => saveNotes(item, notes)}
          />
        ))}
        {visible.length === 0 && queued.length === 0 && (
          <p className="empty">Nothing here.</p>
        )}
      </main>

      {moving && (
        <MoveSheet
          item={moving}
          onCancel={() => setMoving(null)}
          onConfirm={(waitingOn, chaseBy) => {
            moveItem(moving, 'standing_by', {
              waiting_on: waitingOn || null,
              chase_by: chaseBy || null,
            })
            setMoving(null)
          }}
        />
      )}
    </div>
  )
}
