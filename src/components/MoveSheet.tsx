import { useState } from 'react'
import type { Item } from '../types'

interface Props {
  item: Item
  onConfirm: (waitingOn: string, chaseBy: string) => void
  onCancel: () => void
}

export default function MoveSheet({ item, onConfirm, onCancel }: Props) {
  const [waitingOn, setWaitingOn] = useState(item.waiting_on ?? '')
  const [chaseBy, setChaseBy] = useState(item.chase_by ?? '')

  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Standing by</h2>
        <p className="sheet-item">{item.title}</p>
        <label>
          Waiting on
          <input
            autoFocus
            placeholder="Who?"
            value={waitingOn}
            onChange={(e) => setWaitingOn(e.target.value)}
          />
        </label>
        <label>
          Chase by (optional)
          <input type="date" value={chaseBy} onChange={(e) => setChaseBy(e.target.value)} />
        </label>
        <div className="sheet-buttons">
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={() => onConfirm(waitingOn.trim(), chaseBy)}>
            Move
          </button>
        </div>
      </div>
    </div>
  )
}
