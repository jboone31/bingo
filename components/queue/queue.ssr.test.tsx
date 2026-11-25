// @vitest-environment jsdom
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { QueueList } from "./QueueList";

const items = [
  { id: "A", text: "Alpha", submitter: "Sam", category: "Sports" },
  { id: "B", text: "Bravo", submitter: "", category: "" },
];

const html = () =>
  renderToString(
    <ToastProvider>
      <QueueList leagueId="L1" items={items} editable poolHref="/p" />
    </ToastProvider>,
  );

describe("QueueList server rendering", () => {
  it("renders identical HTML every time, so hydration always matches", () => {
    // The server process renders many requests. The drag library's own id counter
    // keeps climbing between them, while a browser starts at zero on each page load.
    // Rendering several times in one process reproduces that.
    const first = html();
    const second = html();
    const third = html();
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it("does not use the library's global counter for its accessibility ids", () => {
    expect(html()).not.toMatch(/DndDescribedBy-\d+/);
  });
});
