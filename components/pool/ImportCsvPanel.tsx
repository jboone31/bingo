"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { newRequestId } from "@/lib/ids/requestId";
import { csvErrorMessage, reasonMessage } from "@/lib/leagues/messages";
import { CSV_TEMPLATE } from "@/lib/pool/importCsv";
import { MAX_CSV_BYTES } from "@/lib/pool/limits";
import styles from "./Pool.module.css";

interface Preview {
  rowCount: number;
  preview: { text: string; submitter: string; category: string }[];
}

interface Problems {
  reason: string;
  errors: { row: number; column: string; reason: string }[];
  totalErrors: number;
}

type State =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ready"; csv: string; result: Preview }
  | { kind: "problems"; result: Problems }
  | { kind: "importing"; csv: string; result: Preview };

/**
 * Choose a CSV, check it without saving (preview), then import it. Uploads add to
 * the pool and are all or nothing. The same request id is used for the check and
 * the import, so a double click imports once.
 */
export function ImportCsvPanel({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [requestId, setRequestId] = useState(() => newRequestId());
  const [state, setState] = useState<State>({ kind: "idle" });

  const url = `/api/leagues/${leagueId}/submissions/import`;
  const send = (csv: string, dryRun: boolean) =>
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ csv, requestId, dryRun }),
    });

  function reset() {
    setState({ kind: "idle" });
    setRequestId(newRequestId());
    if (input.current) input.current.value = "";
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_CSV_BYTES) {
      toast.show(reasonMessage("csv_too_large"), "danger");
      reset();
      return;
    }
    setState({ kind: "checking" });
    try {
      const csv = await file.text();
      const res = await send(csv, true);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setState({ kind: "ready", csv, result: data as Preview });
      } else if (res.status === 422) {
        setState({ kind: "problems", result: data as Problems });
      } else {
        toast.show(
          reasonMessage((data as { reason?: string }).reason),
          "danger",
        );
        reset();
      }
    } catch {
      toast.show(reasonMessage(undefined), "danger");
      reset();
    }
  }

  async function confirm() {
    if (state.kind !== "ready") return;
    const { csv, result } = state;
    setState({ kind: "importing", csv, result });
    try {
      const res = await send(csv, false);
      const data = (await res.json().catch(() => ({}))) as {
        imported?: number;
        reason?: string;
      };
      if (res.ok) {
        toast.show(
          `Imported ${data.imported ?? result.rowCount} squares.`,
          "success",
        );
        reset();
        router.refresh();
      } else {
        toast.show(reasonMessage(data.reason), "danger");
        setState({ kind: "ready", csv, result });
      }
    } catch {
      toast.show(reasonMessage(undefined), "danger");
      setState({ kind: "ready", csv, result });
    }
  }

  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`;

  return (
    <div className={styles.stack}>
      <p className={styles.muted}>
        Upload a CSV with a header row (<code>text</code>,{" "}
        <code>submitter</code>, <code>category</code>). Rows are added to the
        pool, including duplicates. If any row has a problem, nothing is
        imported.{" "}
        <a href={templateHref} download="pool-template.csv">
          Download template
        </a>
      </p>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        aria-label="CSV file"
        onChange={onFile}
        disabled={state.kind === "checking" || state.kind === "importing"}
      />

      {state.kind === "checking" ? <p>Checking file…</p> : null}

      {state.kind === "problems" ? (
        <div role="alert" className={styles.stack}>
          <strong>
            {state.result.reason === "csv_invalid"
              ? `${state.result.totalErrors} problem${state.result.totalErrors === 1 ? "" : "s"} found. Nothing was imported.`
              : reasonMessage(state.result.reason)}
          </strong>
          <ul className={styles.errors}>
            {state.result.errors.map((error, i) => (
              <li key={i}>{csvErrorMessage(error)}</li>
            ))}
          </ul>
          {state.result.totalErrors > state.result.errors.length ? (
            <p className={styles.muted}>
              Showing the first {state.result.errors.length}. Fix these and
              choose the file again to see the rest.
            </p>
          ) : null}
          <div>
            <Button variant="ghost" onClick={reset}>
              Choose another file
            </Button>
          </div>
        </div>
      ) : null}

      {state.kind === "ready" || state.kind === "importing" ? (
        <div className={styles.stack}>
          <strong>
            {state.result.rowCount} square
            {state.result.rowCount === 1 ? "" : "s"} ready to import
          </strong>
          <ul className={styles.preview}>
            {state.result.preview.map((row, i) => (
              <li key={i}>
                {row.text}
                <span className={styles.muted}>
                  {" "}
                  — {row.submitter || "Unknown"},{" "}
                  {row.category || "Uncategorized"}
                </span>
              </li>
            ))}
          </ul>
          {state.result.rowCount > state.result.preview.length ? (
            <p className={styles.muted}>
              and {state.result.rowCount - state.result.preview.length} more
            </p>
          ) : null}
          <div className={styles.actions}>
            <Button loading={state.kind === "importing"} onClick={confirm}>
              Import {state.result.rowCount}
            </Button>
            <Button
              variant="ghost"
              onClick={reset}
              disabled={state.kind === "importing"}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
