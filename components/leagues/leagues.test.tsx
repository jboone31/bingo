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

import { ConfirmAction } from "./ConfirmAction";
import { CreateLeagueForm } from "./CreateLeagueForm";
import { DeleteLeagueDialog } from "./DeleteLeagueDialog";
import { InvitePanel } from "./InvitePanel";
import { JoinLeagueForm } from "./JoinLeagueForm";
import { MemberList } from "./MemberList";
import { TransferAdminForm } from "./TransferAdminForm";

const wrap = (node: ReactNode) => render(<ToastProvider>{node}</ToastProvider>);
const reply = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({
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

describe("ConfirmAction", () => {
  const props = {
    label: "Leave league",
    title: "Leave this league?",
    confirmLabel: "Leave",
    request: { url: "/api/leagues/x/leave", method: "POST" as const },
    after: { kind: "go" as const, to: "/" },
    successMessage: "You left the league.",
  };

  it("sends nothing until confirmed, then navigates", async () => {
    const fetchMock = reply(200, { ok: true });
    vi.stubGlobal("fetch", fetchMock);
    wrap(<ConfirmAction {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Leave league" }));
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/leagues/x/leave",
      expect.objectContaining({ method: "POST" }),
    );
    expect(await screen.findByText("You left the league.")).toBeInTheDocument();
    expect(push).toHaveBeenCalledWith("/");
  });

  it("shows the reason as a toast and stays put on failure", async () => {
    vi.stubGlobal(
      "fetch",
      reply(409, { ok: false, reason: "admin_cannot_leave" }),
    );
    wrap(<ConfirmAction {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Leave league" }));
    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(await screen.findByText(/admin cannot leave/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("can be disabled", () => {
    wrap(<ConfirmAction {...props} disabled />);
    expect(screen.getByRole("button", { name: "Leave league" })).toBeDisabled();
  });
});

describe("CreateLeagueForm", () => {
  it("posts the name and a request id, then opens the league", async () => {
    const fetchMock = reply(201, { ok: true, league: { id: "L1" } });
    vi.stubGlobal("fetch", fetchMock);
    wrap(<CreateLeagueForm />);
    await userEvent.type(screen.getByLabelText("League name"), "Office 2026");
    await userEvent.click(
      screen.getByRole("button", { name: "Create league" }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.name).toBe("Office 2026");
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.draftAt).toBeUndefined();
    expect(push).toHaveBeenCalledWith("/leagues/L1");
  });

  it("converts the draft date to an ISO timestamp", async () => {
    const fetchMock = reply(201, { ok: true, league: { id: "L1" } });
    vi.stubGlobal("fetch", fetchMock);
    wrap(<CreateLeagueForm />);
    await userEvent.type(screen.getByLabelText("League name"), "A");
    await userEvent.type(
      screen.getByLabelText("Draft date (optional)"),
      "2026-03-01T19:00",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Create league" }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.draftAt).toBe(new Date("2026-03-01T19:00").toISOString());
  });

  it("shows a field error for a rejected name", async () => {
    vi.stubGlobal("fetch", reply(400, { ok: false, reason: "invalid_name" }));
    wrap(<CreateLeagueForm />);
    await userEvent.click(
      screen.getByRole("button", { name: "Create league" }),
    );
    expect(await screen.findByText(/1 to 60 characters/)).toBeInTheDocument();
    expect(screen.getByLabelText("League name")).toBeInvalid();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("JoinLeagueForm", () => {
  it("posts the code and opens the league", async () => {
    const fetchMock = reply(200, {
      ok: true,
      leagueId: "L1",
      alreadyMember: false,
    });
    vi.stubGlobal("fetch", fetchMock);
    wrap(<JoinLeagueForm />);
    await userEvent.type(screen.getByLabelText("Join code"), "k7p2-qx9m");
    await userEvent.click(screen.getByRole("button", { name: "Join league" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      code: "k7p2-qx9m",
    });
    expect(push).toHaveBeenCalledWith("/leagues/L1");
  });

  it("shows an error under the field for an unknown code", async () => {
    vi.stubGlobal(
      "fetch",
      reply(404, { ok: false, reason: "league_not_found" }),
    );
    wrap(<JoinLeagueForm initialCode="K7P2QX9M" />);
    await userEvent.click(screen.getByRole("button", { name: "Join league" }));
    expect(
      await screen.findByText(/could not find that league/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Join code")).toBeInvalid();
  });
});

describe("InvitePanel", () => {
  it("shows the formatted code and copies the code and link", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    wrap(<InvitePanel code="K7P2QX9M" />);
    expect(screen.getByText("K7P2-QX9M")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Copy code" }));
    expect(writeText).toHaveBeenLastCalledWith("K7P2-QX9M");
    await userEvent.click(
      screen.getByRole("button", { name: "Copy invite link" }),
    );
    expect(writeText).toHaveBeenLastCalledWith(
      `${window.location.origin}/join/K7P2QX9M`,
    );
    expect(await screen.findByText("Invite link copied.")).toBeInTheDocument();
  });
});

describe("DeleteLeagueDialog", () => {
  it("keeps Delete disabled until the name is typed, in any case", async () => {
    const fetchMock = reply(200, { ok: true });
    vi.stubGlobal("fetch", fetchMock);
    wrap(<DeleteLeagueDialog leagueId="L1" leagueName="Office 2026" />);
    await userEvent.click(
      screen.getByRole("button", { name: "Delete league" }),
    );
    const confirm = screen.getByRole("button", { name: "Delete forever" });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText("League name"), "OFFICE 20");
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText("League name"), "26");
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/leagues/L1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      confirmName: "OFFICE 2026",
    });
    expect(push).toHaveBeenCalledWith("/");
  });
});

describe("MemberList", () => {
  const members = [
    { userId: "a", displayName: "Ada", role: "admin" as const },
    { userId: "b", displayName: "Bob", role: "member" as const },
  ];

  it("gives the admin Remove actions on other players only, pre-draft", () => {
    wrap(
      <MemberList
        leagueId="L1"
        members={members}
        viewerId="a"
        viewerRole="admin"
        status="pre_draft"
      />,
    );
    expect(screen.getByText("Ada (you)")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(1);
  });

  it("hides Remove for members and after the draft starts", () => {
    const { unmount } = wrap(
      <MemberList
        leagueId="L1"
        members={members}
        viewerId="b"
        viewerRole="member"
        status="pre_draft"
      />,
    );
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    unmount();
    wrap(
      <MemberList
        leagueId="L1"
        members={members}
        viewerId="a"
        viewerRole="admin"
        status="drafting"
      />,
    );
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });
});

describe("TransferAdminForm", () => {
  it("is disabled until a player is chosen, then posts the choice", async () => {
    const fetchMock = reply(200, { ok: true });
    vi.stubGlobal("fetch", fetchMock);
    wrap(
      <TransferAdminForm
        leagueId="L1"
        candidates={[{ userId: "b", displayName: "Bob", role: "member" }]}
      />,
    );
    const open = screen.getByRole("button", { name: "Transfer admin" });
    expect(open).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText("New admin"), "b");
    expect(open).toBeEnabled();
    await userEvent.click(open);
    await userEvent.click(screen.getByRole("button", { name: "Transfer" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      userId: "b",
    });
    expect(push).toHaveBeenCalledWith("/leagues/L1");
  });
});
