// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Select } from "./Select";

describe("Select", () => {
  it("is labelled, lists options and changes value", async () => {
    render(
      <Select
        label="Member"
        placeholder="Choose"
        options={[
          { value: "a", label: "Ada" },
          { value: "b", label: "Bob" },
        ]}
      />,
    );
    const select = screen.getByLabelText("Member");
    expect(screen.getAllByRole("option")).toHaveLength(3);
    await userEvent.selectOptions(select, "b");
    expect(select).toHaveValue("b");
  });
});
