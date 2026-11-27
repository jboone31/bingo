// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  usePathname: () => "/",
}));

import { AppHeader } from "@/components/shell/AppHeader";
import { SCENARIOS } from "@/lib/dev/scenarios";
import { ToastProvider } from "@/components/ui/Toast";
import { DevBanner } from "./DevBanner";
import { DevSignIn } from "./DevSignIn";
import { DevTools } from "./DevTools";

const reply = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });

const users = [
  { id: "u1", displayName: "Seed Player 001" },
  { id: "u2", displayName: "Seed Player 002" },
];

const setup = (seedUsers = users) =>
  render(
    <ToastProvider>
      <DevTools seedUsers={seedUsers} />
    </ToastProvider>,
  );

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DevTools", () => {
  it("lists every scenario and runs one, then links to the league", async () => {
    const fetchMock = reply(201, { ok: true, leagueId: "L1" });
    vi.stubGlobal("fetch", fetchMock);
    setup();
    expect(screen.getAllByRole("button", { name: "Run" })).toHaveLength(
      Object.keys(SCENARIOS).length,
    );
    await userEvent.click(screen.getAllByRole("button", { name: "Run" })[1]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/dev/seed",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      scenario: "league_with_players",
    });
    expect(
      await screen.findByRole("link", { name: "League with players" }),
    ).toHaveAttribute("href", "/leagues/L1");
  });

  it("resets only your seed leagues directly", async () => {
    const fetchMock = reply(200, { ok: true, leagues: 2, users: 0 });
    vi.stubGlobal("fetch", fetchMock);
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Reset my seed leagues" }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      scope: "mine",
    });
    expect(await screen.findByText(/Removed 2 league/)).toBeInTheDocument();
  });

  it("asks before resetting all seed data", async () => {
    const fetchMock = reply(200, { ok: true, leagues: 3, users: 12 });
    vi.stubGlobal("fetch", fetchMock);
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Reset all seed data" }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Reset all" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      scope: "all",
    });
  });

  it("keeps Switch disabled until a player is chosen, then posts the choice", async () => {
    const fetchMock = reply(200, { ok: true });
    vi.stubGlobal("fetch", fetchMock);
    setup();
    const open = screen.getByRole("button", { name: "Switch" });
    expect(open).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText("Player"), "u2");
    expect(open).toBeEnabled();
    await userEvent.click(open);
    await userEvent.click(screen.getAllByRole("button", { name: "Switch" })[1]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      userId: "u2",
    });
    expect(push).toHaveBeenCalledWith("/");
  });

  it("disables the picker when there are no seed players", () => {
    setup([]);
    expect(screen.getByLabelText("Player")).toBeDisabled();
  });
});

describe("dev banner", () => {
  it("renders on its own with a link to the hub", () => {
    render(<DevBanner name="Seed Player 003" />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Dev: acting as Seed Player 003",
    );
    expect(screen.getByRole("link", { name: "Dev tools" })).toHaveAttribute(
      "href",
      "/dev",
    );
  });

  it("shows in the header only when devActingAs is set", () => {
    const { rerender } = render(<AppHeader displayName="Ada" />);
    expect(screen.queryByText(/acting as/)).toBeNull();
    rerender(
      <AppHeader displayName="Seed Player 003" devActingAs="Seed Player 003" />,
    );
    expect(
      screen.getByText("Dev: acting as Seed Player 003"),
    ).toBeInTheDocument();
  });
});

describe("DevSignIn", () => {
  it("is disabled until a player is chosen, then signs in and goes to next", async () => {
    const fetchMock = reply(200, { ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ToastProvider>
        <DevSignIn users={users} next="/leagues/L1" />
      </ToastProvider>,
    );
    const button = screen.getByRole("button", { name: "Sign in as player" });
    expect(button).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText("Seed player"), "u2");
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/dev/sign-in",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      userId: "u2",
    });
    expect(push).toHaveBeenCalledWith("/leagues/L1");
  });

  it("shows a toast and stays put when sign-in fails", async () => {
    vi.stubGlobal("fetch", reply(404, { ok: false, reason: "not_found" }));
    render(
      <ToastProvider>
        <DevSignIn users={users} next="/" />
      </ToastProvider>,
    );
    await userEvent.selectOptions(screen.getByLabelText("Seed player"), "u1");
    await userEvent.click(
      screen.getByRole("button", { name: "Sign in as player" }),
    );
    expect(
      await screen.findByText("Could not sign in as that player."),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
