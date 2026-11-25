import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./Gallery", () => ({ Gallery: () => null }));

import ComponentsPage from "./page";

describe("/dev/components", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is not found when the dev flag is off", () => {
    vi.stubEnv("ENABLE_DEV_TOOLS", "");
    expect(() => ComponentsPage()).toThrow();
  });

  it("renders when the dev flag is on", () => {
    vi.stubEnv("ENABLE_DEV_TOOLS", "1");
    expect(() => ComponentsPage()).not.toThrow();
  });
});
