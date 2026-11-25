// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pagination } from "./Pagination";

describe("Pagination", () => {
  it("renders nothing for a single page", () => {
    const { container } = render(
      <Pagination basePath="/x" page={1} pageCount={1} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("links to neighbors and drops ?page for page 1", () => {
    render(<Pagination basePath="/x" page={2} pageCount={3} />);
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/x",
    );
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/x?page=3",
    );
  });

  it("keeps other parameters in every link", () => {
    render(
      <Pagination
        basePath="/x"
        page={2}
        pageCount={3}
        params={new URLSearchParams("cat=none&sort=text&page=2")}
      />,
    );
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/x?cat=none&sort=text",
    );
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/x?cat=none&sort=text&page=3",
    );
  });

  it("disables Previous on the first page and Next on the last", () => {
    const { rerender } = render(
      <Pagination basePath="/x" page={1} pageCount={2} />,
    );
    expect(screen.queryByRole("link", { name: "Previous" })).toBeNull();
    rerender(<Pagination basePath="/x" page={2} pageCount={2} />);
    expect(screen.queryByRole("link", { name: "Next" })).toBeNull();
  });
});
