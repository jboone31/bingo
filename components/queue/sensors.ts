/**
 * How a queue row is picked up, per input type.
 *
 * - Mouse: a few pixels of movement starts a drag.
 * - Touch: press and hold the handle briefly. A quick swipe that starts on the handle
 *   scrolls the page instead, and moving more than `tolerance` pixels before the hold
 *   finishes cancels the pick-up. Once picked up, the row follows that one finger
 *   (the touch sensor ignores other fingers) and the page scrolls by itself near the
 *   top and bottom edges.
 * - Keyboard: space to lift, arrows to move (see QueueList).
 *
 * Pointer events are not used: they fire for every finger, so a second finger moving
 * anywhere would drag the row.
 */
export const MOUSE_ACTIVATION = { distance: 4 } as const;
export const TOUCH_ACTIVATION = { delay: 200, tolerance: 8 } as const;

/** Edge scrolling while a row is held: how fast, and how close to an edge it starts. */
export const AUTO_SCROLL = {
  acceleration: 14,
  threshold: { x: 0.1, y: 0.2 },
} as const;
