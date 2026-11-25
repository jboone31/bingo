"use client";

import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { reasonMessage } from "@/lib/leagues/messages";
import type { SubmissionRow } from "@/lib/pool/read";
import { moveById, moveItem } from "@/lib/queue/order";
import { QUEUE_MAX } from "@/lib/queue/rules";
import { OrderSaver, type SaveResult } from "@/lib/queue/saver";
import { QueueRow } from "./QueueRow";
import { AUTO_SCROLL, MOUSE_ACTIVATION, TOUCH_ACTIVATION } from "./sensors";
import styles from "./QueueList.module.css";

/**
 * A player's queue, re-orderable by dragging a handle or with Move buttons. Every
 * change shows at once and saves in the background. Give it a `key` that changes when
 * the server's queue changes, so it starts over from the new data.
 */
export function QueueList({
  leagueId,
  items,
  editable,
  poolHref,
}: {
  leagueId: string;
  items: readonly SubmissionRow[];
  editable: boolean;
  poolHref: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [byId] = useState(() => new Map(items.map((item) => [item.id, item])));
  const [order, setOrder] = useState(() => items.map((item) => item.id));
  const listRef = useRef<HTMLOListElement>(null);
  const focusNext = useRef<{ id: string; delta: -1 | 1 } | null>(null);

  const [saver] = useState(
    () =>
      new OrderSaver(
        items.map((item) => item.id),
        async (next): Promise<SaveResult> => {
          const res = await fetch(`/api/leagues/${leagueId}/queue`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ order: next }),
          });
          if (res.ok) return { ok: true };
          const data = (await res.json().catch(() => ({}))) as {
            reason?: string;
          };
          return { ok: false, reason: data.reason ?? "unknown" };
        },
        (reason, lastSaved) => {
          setOrder(lastSaved);
          if (reason === "queue_changed") {
            toast.show(reasonMessage(reason), "info");
            router.refresh();
          } else {
            toast.show(reasonMessage(reason), "danger");
          }
        },
      ),
  );

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: MOUSE_ACTIVATION }),
    useSensor(TouchSensor, { activationConstraint: TOUCH_ACTIVATION }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function apply(next: string[]) {
    setOrder(next);
    saver.request(next);
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    apply(moveItem(order, from, to));
  }

  function onMove(id: string, delta: -1 | 1) {
    focusNext.current = { id, delta };
    apply(moveById(order, id, delta));
  }

  // After a button move the row has been re-inserted, which drops keyboard focus.
  // Put it back on the same button, or the other one if this one is now at the end.
  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (!target || !listRef.current) return;
    const find = (kind: "up" | "down") =>
      listRef.current?.querySelector<HTMLButtonElement>(
        `[data-move="${kind}-${target.id}"]`,
      );
    const same = find(target.delta === -1 ? "up" : "down");
    (same && !same.disabled
      ? same
      : find(target.delta === -1 ? "down" : "up")
    )?.focus();
  }, [order]);

  async function onRemove(id: string) {
    try {
      const res = await fetch(`/api/leagues/${leagueId}/queue/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          reason?: string;
        };
        toast.show(reasonMessage(data.reason), "danger");
        return;
      }
      const next = order.filter((existing) => existing !== id);
      saver.reset(next);
      setOrder(next);
      router.refresh();
    } catch {
      toast.show(reasonMessage(undefined), "danger");
    }
  }

  if (order.length === 0) {
    return (
      <EmptyState
        title="Your queue is empty"
        message="Add squares from the pool. They are drafted for you, top first, if your clock runs out."
        action={<ButtonLink href={poolHref}>Browse the pool</ButtonLink>}
      />
    );
  }

  const rows = order
    .map((id) => byId.get(id))
    .filter((item): item is SubmissionRow => item !== undefined);

  return (
    <div>
      <p className={styles.count}>
        {rows.length} of {QUEUE_MAX} squares
      </p>
      {editable ? (
        <p className={styles.hint}>
          Press and hold the handle (⠿), then drag. Or use the arrows.
        </p>
      ) : null}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        autoScroll={AUTO_SCROLL}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ol ref={listRef} className={styles.list}>
            {rows.map((item, index) => (
              <QueueRow
                key={item.id}
                item={item}
                position={index + 1}
                isFirst={index === 0}
                isLast={index === rows.length - 1}
                editable={editable}
                onMove={onMove}
                onRemove={onRemove}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  );
}
