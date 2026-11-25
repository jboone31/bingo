import type { BadgeTone } from "@/components/ui/Badge";
import type { LeagueStatus } from "@/lib/leagues/types";

export const STATUS_LABEL: Record<LeagueStatus, string> = {
  pre_draft: "Pre-draft",
  drafting: "Drafting",
  in_progress: "In progress",
};

export const STATUS_TONE: Record<LeagueStatus, BadgeTone> = {
  pre_draft: "info",
  drafting: "accent",
  in_progress: "success",
};
