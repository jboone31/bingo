"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmAction } from "@/components/leagues/ConfirmAction";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Panel } from "@/components/ui/Panel";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { LocalTime } from "@/components/LocalTime";
import { STATUS_LABEL, STATUS_TONE } from "@/components/leagues/status";
import { Badge } from "@/components/ui/Badge";
import type { LeagueStatus } from "@/lib/leagues/types";
import { SCENARIOS } from "@/lib/dev/scenarios";
import styles from "./DevTools.module.css";

export interface SeedUserOption {
  readonly id: string;
  readonly displayName: string;
}

export interface SeedLeagueOption {
  readonly id: string;
  readonly name: string;
  readonly scenario: string;
  readonly status: string;
  readonly createdAt: string;
}

interface Created {
  readonly leagueId: string;
  readonly label: string;
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, data };
}

/** Dev hub: run scenarios, reset seed data, and act as a seed player. */
export function DevTools({
  seedUsers,
  seedLeagues = [],
}: {
  seedUsers: readonly SeedUserOption[];
  seedLeagues?: readonly SeedLeagueOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [running, setRunning] = useState<string | null>(null);
  const [created, setCreated] = useState<Created[]>([]);
  const [confirmAll, setConfirmAll] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [target, setTarget] = useState("");

  async function run(scenario: string) {
    setRunning(scenario);
    try {
      const { ok, data } = await post("/api/dev/seed", { scenario });
      if (ok && typeof data.leagueId === "string") {
        const label = SCENARIOS[scenario].label;
        setCreated((list) => [
          { leagueId: data.leagueId as string, label },
          ...list,
        ]);
        toast.show(`${label} created.`, "success");
        router.refresh();
      } else {
        toast.show("Could not run that scenario.", "danger");
      }
    } catch {
      toast.show("Could not run that scenario.", "danger");
    } finally {
      setRunning(null);
    }
  }

  async function reset(scope: "mine" | "all") {
    setResetting(true);
    try {
      const { ok, data } = await post("/api/dev/reset", { scope });
      if (ok) {
        toast.show(
          `Removed ${data.leagues} league(s) and ${data.users} seed user(s).`,
          "success",
        );
        if (scope === "all") setTarget("");
        setCreated([]);
        router.refresh();
      } else {
        toast.show("Could not reset.", "danger");
      }
    } catch {
      toast.show("Could not reset.", "danger");
    } finally {
      setResetting(false);
      setConfirmAll(false);
    }
  }

  const chosen = seedUsers.find((u) => u.id === target);

  return (
    <div className={styles.stack}>
      <Panel title="Scenarios">
        <ul className={styles.list}>
          {Object.entries(SCENARIOS).map(([name, scenario]) => (
            <li key={name} className={styles.item}>
              <div className={styles.text}>
                <strong>{scenario.label}</strong>
                <span className={styles.muted}>{scenario.description}</span>
              </div>
              <Button
                size="sm"
                loading={running === name}
                disabled={running !== null && running !== name}
                onClick={() => run(name)}
              >
                Run
              </Button>
            </li>
          ))}
        </ul>
        {created.length > 0 ? (
          <div className={styles.created}>
            <p className={styles.muted}>Created this session</p>
            <ul className={styles.links}>
              {created.map((c) => (
                <li key={c.leagueId}>
                  <Link href={`/leagues/${c.leagueId}`}>{c.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Panel>

      <Panel title="My seed leagues">
        {seedLeagues.length === 0 ? (
          <p className={styles.muted}>You are in no seed leagues.</p>
        ) : (
          <ul className={styles.list}>
            {seedLeagues.map((league) => (
              <li key={league.id} className={styles.item}>
                <div className={styles.text}>
                  <Link href={`/leagues/${league.id}`}>{league.name}</Link>
                  <span className={styles.muted}>
                    {SCENARIOS[league.scenario]?.label ?? league.scenario} ·
                    created <LocalTime iso={league.createdAt} />
                  </span>
                </div>
                <Badge
                  tone={STATUS_TONE[league.status as LeagueStatus] ?? "neutral"}
                >
                  {STATUS_LABEL[league.status as LeagueStatus] ?? league.status}
                </Badge>
                <ConfirmAction
                  label="Delete"
                  variant="danger"
                  size="sm"
                  title={`Delete ${league.name}?`}
                  confirmLabel="Delete"
                  request={{
                    url: "/api/dev/reset",
                    method: "POST",
                    body: { scope: "league", leagueId: league.id },
                  }}
                  after={{ kind: "refresh" }}
                  refreshOnError
                  successMessage="Seed league deleted."
                >
                  <p>
                    This deletes this seed league and everything in it, in any
                    status. Other leagues are not touched.
                  </p>
                </ConfirmAction>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Reset">
        <div className={styles.row}>
          <Button
            variant="secondary"
            loading={resetting}
            onClick={() => reset("mine")}
          >
            Reset my seed leagues
          </Button>
          <Button variant="danger" onClick={() => setConfirmAll(true)}>
            Reset all seed data
          </Button>
        </div>
        <p className={styles.muted}>
          Only leagues created by these tools and the fake players are removed.
        </p>
        <Dialog
          open={confirmAll}
          onClose={() => setConfirmAll(false)}
          title="Reset all seed data?"
        >
          <p>
            This deletes every seed league and every fake player, for everyone.
          </p>
          <div className={styles.row}>
            <Button
              variant="danger"
              loading={resetting}
              onClick={() => reset("all")}
            >
              Reset all
            </Button>
            <Button variant="ghost" onClick={() => setConfirmAll(false)}>
              Cancel
            </Button>
          </div>
        </Dialog>
      </Panel>

      <Panel title="Act as a seed player">
        <div className={styles.stack}>
          <Select
            label="Player"
            placeholder={
              seedUsers.length ? "Choose a player" : "No seed players yet"
            }
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            disabled={seedUsers.length === 0}
            options={seedUsers.map((u) => ({
              value: u.id,
              label: u.displayName,
            }))}
          />
          <div>
            <ConfirmAction
              label="Switch"
              title={`Act as ${chosen?.displayName ?? "this player"}?`}
              confirmLabel="Switch"
              disabled={!chosen}
              request={{
                url: "/api/dev/act-as",
                method: "POST",
                body: { userId: target },
              }}
              after={{ kind: "go", to: "/" }}
            >
              <p>
                This replaces your session. To return, sign in with Google
                again, or use a second browser profile for the fake player.
              </p>
            </ConfirmAction>
          </div>
        </div>
      </Panel>

      <p>
        <Link href="/dev/components">Component gallery</Link>
      </p>
      <p className={styles.muted}>
        Never set ENABLE_DEV_TOOLS on Vercel Production.
      </p>
    </div>
  );
}
