// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Badge } from "./Badge";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { PageHeader } from "./PageHeader";
import { Panel } from "./Panel";
import { Skeleton } from "./Skeleton";
import { Spinner } from "./Spinner";

describe("display components", () => {
  it("Panel is a labelled region when it has a title", () => {
    render(<Panel title="Players">x</Panel>);
    expect(screen.getByRole("region", { name: "Players" })).toBeInTheDocument();
  });

  it("Badge renders its text", () => {
    render(<Badge tone="accent">Live</Badge>);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("PageHeader has one h1 and optional parts", () => {
    render(
      <PageHeader
        title="Leagues"
        subtitle="Yours"
        actions={<button>A</button>}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Leagues" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Yours")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "A" })).toBeInTheDocument();
  });

  it("EmptyState shows title, message and action", () => {
    render(
      <EmptyState
        title="Nothing"
        message="Add one"
        action={<button>Add</button>}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Nothing" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Add one")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("ErrorState is an alert and retries", async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Boom" onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Boom");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("Spinner has an accessible label; Skeleton is hidden", () => {
    const { container } = render(
      <>
        <Spinner label="Saving" />
        <Skeleton lines={2} />
      </>,
    );
    expect(screen.getByRole("status", { name: "Saving" })).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
