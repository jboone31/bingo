import {
  POOL_CHANGE_KINDS,
  type LeagueEvent,
  type PoolChangeKind,
} from "./types";

const str = (value: unknown, fallback: string): string =>
  typeof value === "string" && value !== "" ? value : fallback;

const squares = (n: number): string => `${n} ${n === 1 ? "square" : "squares"}`;

function describePool(payload: LeagueEvent["payload"]): string {
  const kind = POOL_CHANGE_KINDS.find((k) => k === payload.kind) as
    PoolChangeKind | undefined;
  const raw = Number(payload.count);
  const count = Number.isFinite(raw) && raw >= 0 ? Math.trunc(raw) : 0;
  switch (kind) {
    case "added":
      return `${squares(count)} added to the pool`;
    case "imported":
      return `${squares(count)} imported into the pool`;
    case "edited":
      return `${squares(count)} edited`;
    case "deleted":
      return `${squares(count)} removed from the pool`;
    case "cleared":
      return `Pool cleared (${squares(count)} removed)`;
    default:
      return "The pool changed";
  }
}

/** One plain sentence for an event. Unknown types never throw. */
export function describeEvent(
  event: Pick<LeagueEvent, "type" | "payload">,
): string {
  const p = event.payload ?? {};
  switch (event.type) {
    case "member_joined":
      return `${str(p.name, "Someone")} joined the league`;
    case "member_left":
      return `${str(p.name, "Someone")} left the league`;
    case "member_removed":
      return `${str(p.name, "Someone")} was removed from the league`;
    case "admin_transferred":
      return `${str(p.from, "The admin")} made ${str(p.to, "someone")} the admin`;
    case "draft_date_changed":
      return p.draftAt
        ? "The draft date was changed"
        : "The draft date was cleared";
    case "join_code_regenerated":
      return "The join code was regenerated";
    case "pool_changed":
      return describePool(p);
    default:
      return "Something changed";
  }
}
