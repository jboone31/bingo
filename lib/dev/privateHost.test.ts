import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { hostnameOf, isPrivateHost } from "./privateHost";

describe("hostnameOf", () => {
  it.each([
    ["localhost:3000", "localhost"],
    ["Example.COM", "example.com"],
    ["192.168.86.243:3000", "192.168.86.243"],
    ["host.local.", "host.local"],
    ["[::1]:3000", "[::1]"],
  ])("%s -> %s", (input, expected) => {
    expect(hostnameOf(input)).toBe(expected);
  });

  it.each([[null], [undefined], [""], ["  "], ["[::1"]])(
    "%j -> null",
    (input) => {
      expect(hostnameOf(input)).toBeNull();
    },
  );
});

describe("isPrivateHost", () => {
  it.each([
    "localhost:3000",
    "LOCALHOST",
    "app.localhost:3000",
    "hadens-macbook-neo.local:3000",
    "127.0.0.1:3000",
    "10.0.0.5",
    "192.168.86.243:3000",
    "172.16.0.1",
    "172.31.255.255",
    "[::1]:3000",
  ])("accepts %s", (host) => {
    expect(isPrivateHost(host)).toBe(true);
  });

  it.each([
    "bingo-tau-tan.vercel.app",
    "example.com",
    "localhost.evil.com",
    "192.168.1.1.evil.com",
    "evil.com:192",
    "8.8.8.8",
    "172.15.0.1",
    "172.32.0.1",
    "192.169.1.1",
    "11.0.0.1",
    "300.168.1.1",
    "010.0.0.1",
    "192.168.1",
    "",
  ])("rejects %s", (host) => {
    expect(isPrivateHost(host)).toBe(false);
  });

  it("matches the private IPv4 ranges exactly, with or without a port", () => {
    const octet = fc.integer({ min: 0, max: 255 });
    fc.assert(
      fc.property(
        octet,
        octet,
        octet,
        octet,
        fc.boolean(),
        (a, b, c, d, port) => {
          const expected =
            a === 127 ||
            a === 10 ||
            (a === 192 && b === 168) ||
            (a === 172 && b >= 16 && b <= 31);
          const host = `${a}.${b}.${c}.${d}${port ? ":3000" : ""}`;
          expect(isPrivateHost(host)).toBe(expected);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("never accepts a public-looking domain name", () => {
    fc.assert(
      fc.property(
        fc
          .domain()
          .filter((d) => !/\.(local|localhost)$/.test(d) && d !== "localhost"),
        (domain) => {
          expect(isPrivateHost(domain)).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });
});
