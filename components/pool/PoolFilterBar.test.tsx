// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEFAULT_QUERY } from "@/lib/pool/query";
import { PoolFilterBar } from "./PoolFilterBar";

const categories = [
  { key: "movies", label: "Movies", count: 4 },
  { key: "sports", label: "Sports", count: 12 },
  { key: "", label: "", count: 3 },
];

const show = (query = DEFAULT_QUERY) =>
  render(
    <PoolFilterBar
      basePath="/leagues/L1/pool"
      query={query}
      categories={categories}
    />,
  );

describe("PoolFilterBar", () => {
  it("is a GET form to the base path, so it works without JavaScript", () => {
    const { container } = show();
    const form = container.querySelector("form")!;
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/leagues/L1/pool");
    expect(screen.getByRole("button", { name: "Apply" })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("lists All, each category with its count, and Uncategorized", () => {
    show();
    const options = screen
      .getAllByRole("option")
      .map((o) => [(o as HTMLOptionElement).value, o.textContent]);
    expect(options.slice(0, 4)).toEqual([
      ["", "All categories"],
      ["c:movies", "Movies (4)"],
      ["c:sports", "Sports (12)"],
      ["none", "Uncategorized (3)"],
    ]);
  });

  it("reflects the current query in each field", () => {
    show({
      category: { kind: "named", key: "sports" },
      q: "cup",
      sort: "text",
    });
    expect(screen.getByRole("combobox", { name: "Category" })).toHaveValue(
      "c:sports",
    );
    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveValue(
      "cup",
    );
    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveValue(
      "text",
    );
  });

  it("selects Uncategorized for the none filter", () => {
    show({ category: { kind: "none" }, q: "", sort: "added" });
    expect(screen.getByRole("combobox", { name: "Category" })).toHaveValue(
      "none",
    );
  });

  it("shows Clear only when a filter is active", () => {
    const { unmount } = show();
    expect(screen.queryByRole("link", { name: "Clear" })).toBeNull();
    unmount();
    show({ category: { kind: "all" }, q: "x", sort: "added" });
    expect(screen.getByRole("link", { name: "Clear" })).toHaveAttribute(
      "href",
      "/leagues/L1/pool",
    );
  });

  it("omits the Uncategorized option when every square has a category", () => {
    render(
      <PoolFilterBar
        basePath="/p"
        query={DEFAULT_QUERY}
        categories={[{ key: "sports", label: "Sports", count: 1 }]}
      />,
    );
    expect(screen.queryByRole("option", { name: /Uncategorized/ })).toBeNull();
  });
});
