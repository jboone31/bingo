"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { displayCategory, displaySubmitter } from "@/lib/pool/fields";
import type { SubmissionRow } from "@/lib/pool/read";
import styles from "./QueueList.module.css";

/**
 * One queue entry. Only the drag handle starts a drag (and only it disables touch
 * scrolling), so the rest of the row scrolls normally on a phone.
 */
export function QueueRow({
  item,
  position,
  isFirst,
  isLast,
  editable,
  onMove,
  onRemove,
}: {
  item: SubmissionRow;
  position: number;
  isFirst: boolean;
  isLast: boolean;
  editable: boolean;
  onMove: (id: string, delta: -1 | 1) => void;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !editable });

  return (
    <li
      ref={setNodeRef}
      className={`${styles.row} ${isDragging ? styles.dragging : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <span className={styles.position} aria-hidden="true">
        {position}
      </span>
      <div className={styles.body}>
        <p className={styles.text}>{item.text}</p>
        <p className={styles.meta}>
          <span>by {displaySubmitter(item.submitter)}</span>
          <Badge tone={item.category ? "info" : "neutral"}>
            {displayCategory(item.category)}
          </Badge>
        </p>
      </div>
      {editable ? (
        <div className={styles.controls}>
          <button
            type="button"
            ref={setActivatorNodeRef}
            className={styles.handle}
            aria-label={`Drag to reorder: ${item.text}`}
            {...attributes}
            {...listeners}
          >
            ⠿
          </button>
          <Button
            variant="ghost"
            size="sm"
            disabled={isFirst}
            data-move={`up-${item.id}`}
            aria-label={`Move up: ${item.text}`}
            onClick={() => onMove(item.id, -1)}
          >
            ↑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={isLast}
            data-move={`down-${item.id}`}
            aria-label={`Move down: ${item.text}`}
            onClick={() => onMove(item.id, 1)}
          >
            ↓
          </Button>
          <Button
            variant="danger"
            size="sm"
            aria-label={`Remove from queue: ${item.text}`}
            onClick={() => onRemove(item.id)}
          >
            Remove
          </Button>
        </div>
      ) : null}
    </li>
  );
}
