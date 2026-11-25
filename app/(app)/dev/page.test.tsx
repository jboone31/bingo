import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/dev/seedUsers", () => ({ listSeedUsers: async () => [] }));

import DevPage from "./page";

describe("/dev", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is not found when dev tools are off", async () => {
    vi.stubEnv("ENABLE_DEV_TOOLS", "");
    await expect(DevPage()).rejects.toThrow();
  });

  it("is not found on Vercel Production even with the flag set", async () => {
    vi.stubEnv("ENABLE_DEV_TOOLS", "1");
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(DevPage()).rejects.toThrow();
  });

  it("renders when dev tools are on", async () => {
    vi.stubEnv("ENABLE_DEV_TOOLS", "1");
    vi.stubEnv("VERCEL_ENV", "development");
    await expect(DevPage()).resolves.toBeTruthy();
  });
});
