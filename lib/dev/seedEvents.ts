import "server-only";
import type { QueryRunner } from "@/lib/db/server";
import { SEED_EVENT_GAP_MINUTES, seedEventDrafts } from "./scenarios";

/**
 * Insert past events with spread-out timestamps, then set the league's counter to
 * match, so the next real event continues the sequence. This writes the table
 * directly (the append function stamps "now"), but keeps its invariants: seq runs
 * 1..count with no gaps and `last_event_seq` equals the last one.
 */
export async function insertSeedEvents(
  tx: QueryRunner,
  leagueId: string,
  count: number,
  memberIds: readonly string[],
): Promise<void> {
  const { rows } = await tx.query(
    `select display_name from public.profiles where id = any($1::uuid[])
      order by display_name`,
    [memberIds],
  );
  const names = rows.map((r) => String(r.display_name));
  const drafts = seedEventDrafts(count, names);
  const now = Date.now();
  const step = SEED_EVENT_GAP_MINUTES * 60 * 1000;
  await tx.query(
    `insert into public.league_events (league_id, seq, type, payload, created_at)
     select $1, t.seq, t.type, t.payload::jsonb, t.created_at
       from unnest($2::bigint[], $3::text[], $4::text[], $5::timestamptz[])
         as t(seq, type, payload, created_at)`,
    [
      leagueId,
      drafts.map((_, i) => i + 1),
      drafts.map((d) => d.type),
      drafts.map((d) => JSON.stringify(d.payload)),
      drafts.map((_, i) =>
        new Date(now - (count - 1 - i) * step).toISOString(),
      ),
    ],
  );
  await tx.query(
    `update public.leagues set last_event_seq = $2 where id = $1`,
    [leagueId, count],
  );
}
