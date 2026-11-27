import { getSql, withTransaction } from "@/lib/db/server";
import { startDraft } from "@/lib/draft/start";
import { addMember, createLeague, createUser } from "./helpers";

/** Shared setup for the draft engine suites: a started league in a known shape. */
export interface StartedLeague {
  readonly id: string;
  readonly admin: string;
  readonly players: string[];
  /** Group id to user ids in draft position order. */
  readonly groups: Map<string, string[]>;
  readonly submissions: string[];
}

export async function startedLeague(options: {
  players: number;
  groups?: number;
  extraPool?: number;
  pickSeconds?: number;
}): Promise<StartedLeague> {
  const groupCount = options.groups ?? 1;
  const admin = await createUser({ full_name: "E Admin" });
  const id = await createLeague(admin);
  const players = [admin];
  for (let i = 1; i < options.players; i += 1) {
    const p = await createUser({ full_name: `E Player ${i}` });
    await addMember(id, p);
    players.push(p);
  }
  const perGroup = Math.ceil(options.players / groupCount);
  const poolSize = perGroup * 25 + (options.extraPool ?? 0);
  const rows = await getSql()`
    insert into public.submissions (league_id, text)
    select ${id}, 'Square ' || g from generate_series(1, ${poolSize}::int) g
    returning id`;
  await getSql()`
    update public.leagues
       set group_count = ${groupCount}, pick_seconds = ${options.pickSeconds ?? 60}
     where id = ${id}`;
  await withTransaction((tx) =>
    startDraft(tx, id, admin, {
      members: options.players,
      groupCount,
    }),
  );
  const members = await getSql()`
    select group_id, user_id from public.draft_group_members
     where league_id = ${id} order by group_id, position`;
  const groups = new Map<string, string[]>();
  for (const m of members) {
    const list = groups.get(String(m.group_id)) ?? [];
    list.push(String(m.user_id));
    groups.set(String(m.group_id), list);
  }
  return {
    id,
    admin,
    players,
    groups,
    submissions: rows.map((r) => String(r.id)),
  };
}

export const clock = async (groupId: string) =>
  (
    await getSql()`
      select next_pick, total_picks, deadline, turn_started_at, finished_at
        from public.draft_clocks where group_id = ${groupId}`
  )[0];

export const picks = (groupId: string) =>
  getSql()`select pick_number, round, user_id, submission_id, auto
             from public.draft_picks where group_id = ${groupId}
            order by pick_number`;

export const settle = async (leagueId: string) =>
  Number((await getSql()`select public.settle_league(${leagueId}) as n`)[0].n);

/** Move every running deadline into the past by `seconds`. */
export const expire = (leagueId: string, seconds = 1) =>
  getSql()`update public.draft_clocks
              set deadline = now() - make_interval(secs => ${seconds})
            where league_id = ${leagueId} and finished_at is null`;

export const pick = (
  leagueId: string,
  userId: string,
  submissionId: string,
  pickNumber: number,
) =>
  getSql()`select public.draft_pick(${leagueId}, ${userId}, ${submissionId},
                                    ${pickNumber}) as result`.then((r) =>
    String(r[0].result),
  );

export const queue = async (
  leagueId: string,
  userId: string,
  submissionIds: string[],
) => {
  for (const [i, s] of submissionIds.entries()) {
    await getSql()`insert into public.queue_items
                     (league_id, user_id, submission_id, position)
                   values (${leagueId}, ${userId}, ${s}, ${i + 1})`;
  }
};

export const queueOf = async (leagueId: string, userId: string) =>
  (
    await getSql()`select submission_id from public.queue_items
                    where league_id = ${leagueId} and user_id = ${userId}
                    order by position`
  ).map((r) => String(r.submission_id));
