import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { newRequestId } from "./requestId";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newRequestId", () => {
  it("uses randomUUID when the context provides it", () => {
    const source = {
      randomUUID: () => "11111111-1111-4111-8111-111111111111",
      getRandomValues: () => {
        throw new Error("should not be called");
      },
    } as unknown as Crypto;
    expect(newRequestId(source)).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("builds a valid v4 UUID without randomUUID (insecure context)", () => {
    const source = {
      getRandomValues: (array: Uint8Array) => {
        for (let i = 0; i < array.length; i += 1)
          array[i] = (i * 37 + 11) % 256;
        return array;
      },
    } as unknown as Crypto;
    expect(newRequestId(source)).toMatch(UUID_V4);
  });

  it("any random bytes give a valid v4 UUID", () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 16, maxLength: 16 }), (bytes) => {
        const source = {
          getRandomValues: (array: Uint8Array) => {
            array.set(bytes);
            return array;
          },
        } as unknown as Crypto;
        expect(newRequestId(source)).toMatch(UUID_V4);
      }),
      { numRuns: 300 },
    );
  });

  it("works with the real crypto in this runtime", () => {
    expect(newRequestId()).toMatch(UUID_V4);
  });
});
