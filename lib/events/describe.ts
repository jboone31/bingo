import { formatSeconds } from "@/lib/draft/settings";
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
    case "draft_settings_changed": {
      const groups = Number(p.groupCount);
      const seconds = Number(p.pickSeconds);
      if (!Number.isInteger(groups) || !Number.isInteger(seconds)) {
        return "The draft settings changed";
      }
      return `Draft settings changed: ${groups} ${groups === 1 ? "group" : "groups"}, ${formatSeconds(seconds)} per pick`;
    }
    case "pick_made": {
      const group = Number(p.group);
      const round = Number(p.round);
      const who = str(p.name, "Someone");
      const what = str(p.text, "a square");
      const where =
        Number.isInteger(group) && Number.isInteger(round)
          ? `Group ${group}, round ${round}: `
          : "";
      return `${where}${who} picked \u201c${what}\u201d${p.auto === true ? " (auto)" : ""}`;
    }
    case "group_finished": {
      const group = Number(p.group);
      return Number.isInteger(group)
        ? `Group ${group} finished its draft`
        : "A group finished its draft";
    }
    case "draft_completed":
      return "The draft is complete";
    case "draft_started": {
      const groups = Number(p.groupCount);
      if (!Number.isInteger(groups) || groups < 2) return "The draft started";
      return `The draft started with ${groups} groups`;
    }
    default:
      return "Something changed";
  }
}
