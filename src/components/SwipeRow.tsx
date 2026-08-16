import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'

/** Width of one revealed action button, in px. Mirrored in .swipe-action CSS. */
const ACTION_W = 82
/** How far you must drag, as a fraction of the panel, before it snaps open. */
const OPEN_RATIO = 0.4
/** Movement before we commit to an axis — below this it's still a tap. */
const SLOP = 8

export type Side = 'left' | 'right' | null

interface Props {
  children: ReactNode
  /** Revealed by swiping right. */
  left?: ReactNode
  leftCount?: number
  /** Revealed by swiping left. */
  right?: ReactNode
  rightCount?: number
  open: Side
  onOpenChange: (side: Side) => void
}

/**
 * A row you can swipe sideways to reveal actions behind it.
 *
 * Vertical scrolling has to keep working, so we watch the first few pixels of
 * movement and only claim the gesture once it's clearly horizontal — until
 * then the browser is free to scroll the page.
 */
export default function SwipeRow({
  children,
  left,
  leftCount = 1,
  right,
  rightCount = 1,
  open,
  onOpenChange,
}: Props) {
  const leftW = left ? leftCount * ACTION_W : 0
  const rightW = right ? rightCount * ACTION_W : 0
  const openX = open === 'left' ? leftW : open === 'right' ? -rightW : 0

  const [dragX, setDragX] = useState<number | null>(null) // non-null while dragging
  const start = useRef({ x: 0, y: 0, base: 0 })
  const axis = useRef<'x' | 'y' | null>(null)
  const moved = useRef(false)
  /** Id of the pointer currently held down, or null. Guards against hover. */
  const active = useRef<number | null>(null)

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    active.current = e.pointerId
    start.current = { x: e.clientX, y: e.clientY, base: openX }
    axis.current = null
    moved.current = false
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    // pointermove also fires on hover — without a pointer held down there is
    // no drag, and acting on it makes the row chase the cursor after a click.
    if (active.current !== e.pointerId) return
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      active.current = null
      return
    }
    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y

    if (axis.current === null) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return
      // Let the page scroll if the gesture is mostly vertical.
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (axis.current === 'x') e.currentTarget.setPointerCapture(e.pointerId)
    }
    if (axis.current !== 'x') return

    moved.current = true
    // Clamp to the panels that actually exist, with no rubber-banding past them.
    const next = Math.max(-rightW, Math.min(leftW, start.current.base + dx))
    setDragX(next)
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (active.current !== e.pointerId) return
    active.current = null
    const x = dragX
    setDragX(null)
    if (axis.current !== 'x' || x === null) return
    if (x < 0 && rightW && -x > rightW * OPEN_RATIO) onOpenChange('right')
    else if (x > 0 && leftW && x > leftW * OPEN_RATIO) onOpenChange('left')
    else onOpenChange(null)
  }

  const x = dragX ?? openX

  return (
    <div className="swipe">
      {/* Hidden actions are inert so they can't be tabbed into or announced —
          the gestures are a shortcut, the expanded card is the accessible path. */}
      {left && (
        <div className="swipe-actions swipe-left" inert={open !== 'left'}>
          {left}
        </div>
      )}
      {right && (
        <div className="swipe-actions swipe-right" inert={open !== 'right'}>
          {right}
        </div>
      )}
      <div
        className={dragX === null ? 'swipe-fg' : 'swipe-fg dragging'}
        style={{ transform: `translate3d(${x}px, 0, 0)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          // A drag can still emit a click on release; swallow it, but leave the
          // row as the drag left it — closing here would undo the swipe.
          if (moved.current) {
            e.preventDefault()
            e.stopPropagation()
            moved.current = false
            return
          }
          // A genuine tap on an open row closes it instead of expanding.
          if (open !== null) {
            e.preventDefault()
            e.stopPropagation()
            onOpenChange(null)
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}
