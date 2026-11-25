// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";

const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { AddSubmissionForm } from "./AddSubmissionForm";
import { ClearPoolButton } from "./ClearPoolButton";
import { ImportCsvPanel } from "./ImportCsvPanel";
import { SubmissionActions } from "./SubmissionActions";
import { SubmissionList } from "./SubmissionList";

const wrap = (node: ReactNode) => render(<ToastProvider>{node}</ToastProvider>);
const reply = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const row = {
  id: "S1",
  text: "Team X wins",
  submitter: "Sam",
  category: "Sports",
};

describe("SubmissionList", () => {
  it("shows text, submitter and category with fallbacks", () => {
    wrap(
      <SubmissionList
        leagueId="L1"
        canEdit={false}
        items={[
          row,
          { id: "S2", text: "Blank one", submitter: "", category: "" },
        ]}
      />,
    );
    expect(screen.getByText("Team X wins")).toBeInTheDocument();
    expect(screen.getByText("by Sam")).toBeInTheDocument();
    expect(screen.getByText("Sports")).toBeInTheDocument();
    expect(screen.getByText("by Unknown")).toBeInTheDocument();
    expect(screen.getByText("Uncategorized")).toBeInTheDocument();
  });

  it("shows Edit and Delete only when the viewer can edit", () => {
    const { unmount } = wrap(
      <SubmissionList leagueId="L1" canEdit={false} items={[row]} />,
    );
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    unmount();
    wrap(<SubmissionList leagueId="L1" canEdit items={[row]} />);
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("lists identical text as separate rows", () => {
    wrap(
      <SubmissionList
        leagueId="L1"
        canEdit={false}
        items={[row, { ...row, id: "S2" }]}
      />,
    );
    expect(screen.getAllByText("Team X wins")).toHaveLength(2);
  });
});

describe("AddSubmissionForm", () => {
  it("posts the fields with a request id, clears, and renews the id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(201, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    wrap(<AddSubmissionForm leagueId="L1" />);
    await userEvent.type(screen.getByLabelText("Text"), "Hello");
    await userEvent.type(screen.getByLabelText("Category"), "Fun");
    await userEvent.click(screen.getByRole("button", { name: "Add square" }));
    const first = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(first).toMatchObject({
      text: "Hello",
      submitter: "",
      category: "Fun",
    });
    expect(first.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(await screen.findByText("Square added.")).toBeInTheDocument();
    expect(screen.getByLabelText("Text")).toHaveValue("");
    expect(refresh).toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("Text"), "Again");
    await userEvent.click(screen.getByRole("button", { name: "Add square" }));
    const second = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(second.requestId).not.toBe(first.requestId);
  });

  it("shows a field error and keeps the typed text", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(reply(400, { ok: false, reason: "invalid_text" })),
    );
    wrap(<AddSubmissionForm leagueId="L1" />);
    await userEvent.type(screen.getByLabelText("Text"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Add square" }));
    expect(await screen.findByText(/1 to 200 characters/)).toBeInTheDocument();
    expect(screen.getByLabelText("Text")).toBeInvalid();
    expect(screen.getByLabelText("Text")).toHaveValue("x");
  });
});

describe("SubmissionActions", () => {
  it("edits one row and refreshes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    wrap(<SubmissionActions leagueId="L1" submission={row} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const text = screen.getByLabelText("Text");
    expect(text).toHaveValue("Team X wins");
    await userEvent.clear(text);
    await userEvent.type(text, "Team Y wins");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/leagues/L1/submissions/S1",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      text: "Team Y wins",
      submitter: "Sam",
      category: "Sports",
    });
    expect(await screen.findByText("Square updated.")).toBeInTheDocument();
  });

  it("deletes after confirming", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    wrap(<SubmissionActions leagueId="L1" submission={row} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(fetchMock).not.toHaveBeenCalled();
    const buttons = screen.getAllByRole("button", { name: "Delete" });
    await userEvent.click(buttons[buttons.length - 1]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/leagues/L1/submissions/S1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("ClearPoolButton", () => {
  it("is disabled for an empty pool and sends { all: true } after confirming", async () => {
    const { unmount } = wrap(<ClearPoolButton leagueId="L1" count={0} />);
    expect(screen.getByRole("button", { name: "Clear pool" })).toBeDisabled();
    unmount();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(reply(200, { ok: true, deleted: 4 }));
    vi.stubGlobal("fetch", fetchMock);
    wrap(<ClearPoolButton leagueId="L1" count={4} />);
    await userEvent.click(screen.getByRole("button", { name: "Clear pool" }));
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Delete all" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ all: true });
  });
});

describe("ImportCsvPanel", () => {
  const fileWith = (csv: string) => {
    const file = new File([csv], "pool.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: async () => csv });
    return file;
  };

  it("previews, then imports with the same request id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        reply(200, {
          ok: true,
          rowCount: 7,
          preview: [{ text: "A", submitter: "Sam", category: "X" }],
        }),
      )
      .mockResolvedValueOnce(reply(201, { ok: true, imported: 7 }));
    vi.stubGlobal("fetch", fetchMock);
    wrap(<ImportCsvPanel leagueId="L1" />);
    await userEvent.upload(
      screen.getByLabelText("CSV file"),
      fileWith("text\nA"),
    );
    expect(
      await screen.findByText("7 squares ready to import"),
    ).toBeInTheDocument();
    expect(screen.getByText(/and 6 more/)).toBeInTheDocument();
    const preview = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(preview).toMatchObject({ csv: "text\nA", dryRun: true });

    await userEvent.click(screen.getByRole("button", { name: "Import 7" }));
    const real = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(real).toMatchObject({ csv: "text\nA", dryRun: false });
    expect(real.requestId).toBe(preview.requestId);
    expect(await screen.findByText("Imported 7 squares.")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("lists row problems and offers no import button", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        reply(422, {
          ok: false,
          reason: "csv_invalid",
          errors: [{ row: 4, column: "text", reason: "invalid_text" }],
          totalErrors: 120,
        }),
      ),
    );
    wrap(<ImportCsvPanel leagueId="L1" />);
    await userEvent.upload(
      screen.getByLabelText("CSV file"),
      fileWith("text\n,"),
    );
    expect(await screen.findByText(/120 problems found/)).toBeInTheDocument();
    expect(screen.getByText(/Row 4, text:/)).toBeInTheDocument();
    expect(screen.getByText(/Showing the first 1/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Import/ })).toBeNull();
  });

  it("rejects an oversized file without calling the server", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    wrap(<ImportCsvPanel leagueId="L1" />);
    const big = fileWith("x");
    Object.defineProperty(big, "size", { value: 1_000_001 });
    await userEvent.upload(screen.getByLabelText("CSV file"), big);
    expect(await screen.findByText(/too large/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("offers a template download", () => {
    wrap(<ImportCsvPanel leagueId="L1" />);
    expect(
      screen.getByRole("link", { name: "Download template" }),
    ).toHaveAttribute("download", "pool-template.csv");
  });
});
