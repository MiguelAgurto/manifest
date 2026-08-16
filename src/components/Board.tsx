import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import {
  enqueueCapture,
  flushQueue,
  loadQueue,
  loadSnapshot,
  saveSnapshot,
} from '../lib/offline'
import type { Bucket, Item, Tab } from '../types'
import {
  TABS,
  TAB_EMOJI,
  TAB_LABELS,
  displayName,
  isOverdue,
  normalizeTag,
} from '../types'
import ItemCard from './ItemCard'
import MoveSheet from './MoveSheet'

function greeting(date = new Date()): string {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

interface Props {
  session: Session
}

export default function Board({ session }: Props) {
  const [items, setItems] = useState<Item[]>(loadSnapshot)
  const [queued, setQueued] = useState(loadQueue)
  const [tab, setTab] = useState<Tab>('inbound')
  const [online, setOnline] = useState(navigator.onLine)
  const [capture, setCapture] = useState('')
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [moving, setMoving] = useState<Item | null>(null) // item picking a standing_by target

  const name = displayName(session.user.email, session.user.user_metadata?.name)

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

  /** Apply a patch to one row, both remotely and in the local snapshot. */
  const patchItem = useCallback(
    async (item: Item, patch: Partial<Item>, failLabel: string) => {
      const { error } = await supabase.from('items').update(patch).eq('id', item.id)
      if (error) {
        alert(`${failLabel} failed: ${error.message}`)
        return false
      }
      setItems((prev) => {
        const next = prev.map((i) => (i.id === item.id ? { ...i, ...patch } : i))
        saveSnapshot(next)
        return next
      })
      return true
    },
    [],
  )

  function requireOnline(action: string): boolean {
    if (online) return true
    alert(`${action} needs a connection — try again when back online.`)
    return false
  }

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
    if (!requireOnline('Moves')) return
    const now = new Date().toISOString()
    const patch = {
      bucket: to,
      waiting_on: to === 'standing_by' ? (extra.waiting_on ?? null) : null,
      chase_by: to === 'standing_by' ? (extra.chase_by ?? null) : null,
      closed_at: to === 'closed' ? now : null,
      updated_at: now,
    }
    if (!(await patchItem(item, patch, 'Move'))) return
    await supabase
      .from('item_events')
      .insert({ item_id: item.id, from_bucket: item.bucket, to_bucket: to })
  }

  async function saveNotes(item: Item, notes: string) {
    if (!requireOnline('Saving notes')) return
    await patchItem(
      item,
      { notes: notes.trim() || null, updated_at: new Date().toISOString() },
      'Save',
    )
  }

  async function setTags(item: Item, tags: string[]) {
    if (!requireOnline('Editing tags')) return
    await patchItem(item, { tags, updated_at: new Date().toISOString() }, 'Tag')
  }

  /** Soft delete — the row and its history stay, it just moves to Trash. */
  async function trashItem(item: Item) {
    if (!requireOnline('Deleting')) return
    await patchItem(
      item,
      { deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      'Delete',
    )
  }

  async function restoreItem(item: Item) {
    if (!requireOnline('Restoring')) return
    await patchItem(
      item,
      { deleted_at: null, updated_at: new Date().toISOString() },
      'Restore',
    )
  }

  /** The only real delete in the app — gone for good, events cascade out. */
  async function purgeItem(item: Item) {
    if (!requireOnline('Purging')) return
    if (!confirm(`Delete "${item.title}" for good? This can't be undone.`)) return
    const { error } = await supabase.from('items').delete().eq('id', item.id)
    if (error) {
      alert(`Purge failed: ${error.message}`)
      return
    }
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== item.id)
      saveSnapshot(next)
      return next
    })
  }

  const live = useMemo(() => items.filter((i) => !i.deleted_at), [items])

  /** Every tag in use, most-used first — powers the filter strip and suggestions. */
  const allTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const i of live) for (const t of i.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
  }, [live])

  const visible = useMemo(() => {
    let list =
      tab === 'trash'
        ? items.filter((i) => i.deleted_at)
        : live.filter((i) => i.bucket === tab)

    if (tagFilter) list = list.filter((i) => (i.tags ?? []).includes(tagFilter))

    if ((tab === 'closed' || tab === 'trash') && search.trim()) {
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
  }, [items, live, tab, search, tagFilter])

  const counts = useMemo(() => {
    const c = Object.fromEntries(TABS.map((t) => [t, 0])) as Record<Tab, number>
    for (const i of items) {
      if (i.deleted_at) c.trash++
      else c[i.bucket]++
    }
    c.inbound += queued.length
    return c
  }, [items, queued])

  const overdueCount = useMemo(() => live.filter((i) => isOverdue(i)).length, [live])

  return (
    <div className="board">
      <header>
        <div className="hello">
          <span className="hello-greeting">
            {greeting()}, {name}
          </span>
          <span className="hello-sub">
            {overdueCount > 0
              ? `⏳ ${overdueCount} overdue`
              : counts.in_hand > 0
                ? `⚡ ${counts.in_hand} in hand`
                : '✨ all clear'}
          </span>
        </div>
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
        {TABS.map((t) => (
          <button
            key={t}
            className={t === tab ? 'tab active' : 'tab'}
            onClick={() => setTab(t)}
          >
            <span className="tab-emoji">{TAB_EMOJI[t]}</span>
            {TAB_LABELS[t]}
            {counts[t] > 0 && <span className="count">{counts[t]}</span>}
          </button>
        ))}
      </nav>

      {allTags.length > 0 && (
        <div className="tag-filter">
          {allTags.map((t) => (
            <button
              key={t}
              className={t === tagFilter ? 'tag-chip active' : 'tag-chip'}
              onClick={() => setTagFilter(t === tagFilter ? null : t)}
            >
              #{t}
            </button>
          ))}
          {tagFilter && (
            <button className="tag-chip clear" onClick={() => setTagFilter(null)}>
              clear
            </button>
          )}
        </div>
      )}

      {(tab === 'closed' || tab === 'trash') && (
        <input
          className="search"
          placeholder={tab === 'trash' ? 'Search trash…' : 'Search history…'}
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
            suggestions={allTags}
            onMove={(to) => (to === 'standing_by' ? setMoving(item) : moveItem(item, to))}
            onSaveNotes={(notes) => saveNotes(item, notes)}
            onSetTags={(tags) => setTags(item, tags)}
            onTagClick={(t) => setTagFilter(t === tagFilter ? null : normalizeTag(t))}
            onTrash={() => trashItem(item)}
            onRestore={() => restoreItem(item)}
            onPurge={() => purgeItem(item)}
          />
        ))}
        {visible.length === 0 && (tab !== 'inbound' || queued.length === 0) && (
          <p className="empty">
            {TAB_EMOJI[tab]}
            <br />
            {tagFilter ? `Nothing tagged #${tagFilter} here.` : 'Nothing here.'}
          </p>
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
