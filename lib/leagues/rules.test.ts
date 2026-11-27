import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  canDelete,
  canJoin,
  canLeave,
  canRegenerateCode,
  canSetDraftDate,
  canRemove,
  canTransfer,
} from "./rules";
import { MAX_MEMBERS, type LeagueStatus, type MemberRole } from "./types";

const status = fc.constantFrom<LeagueStatus>(
  "pre_draft",
  "drafting",
  "in_progress",
);
const role = fc.constantFrom<MemberRole>("admin", "member");
const later = fc.constantFrom<LeagueStatus>("drafting", "in_progress");

const reason = (r: { ok: boolean; reason?: string }) =>
  r.ok ? null : r.reason;

describe("canJoin", () => {
  it("allows a new member in a pre_draft league with room", () => {
    expect(
      canJoin({ status: "pre_draft", memberCount: 5, alreadyMember: false }),
    ).toEqual({ ok: true });
  });

  it("refuses when full or started", () => {
    expect(
      reason(
        canJoin({
          status: "pre_draft",
          memberCount: MAX_MEMBERS,
          alreadyMember: false,
        }),
      ),
    ).toBe("league_full");
    expect(
      reason(
        canJoin({ status: "drafting", memberCount: 3, alreadyMember: false }),
      ),
    ).toBe("league_not_pre_draft");
  });

  it("treats an existing member as a no-op success in any state", () => {
    fc.assert(
      fc.property(status, fc.integer({ min: 0, max: 200 }), (s, n) => {
        expect(
          canJoin({ status: s, memberCount: n, alreadyMember: true }),
        ).toEqual({ ok: true });
      }),
      { numRuns: 100 },
    );
  });

  it("never admits a new member once the draft has started", () => {
    fc.assert(
      fc.property(later, fc.integer({ min: 0, max: 200 }), (s, n) => {
        expect(
          canJoin({ status: s, memberCount: n, alreadyMember: false }).ok,
        ).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

describe("canLeave", () => {
  it("lets a member leave pre_draft", () => {
    expect(canLeave({ status: "pre_draft", role: "member" })).toEqual({
      ok: true,
    });
  });

  it("never lets the admin leave", () => {
    fc.assert(
      fc.property(status, (s) => {
        expect(reason(canLeave({ status: s, role: "admin" }))).toBe(
          "admin_cannot_leave",
        );
      }),
      { numRuns: 100 },
    );
  });

  it("refuses members after the draft starts", () => {
    fc.assert(
      fc.property(later, (s) => {
        expect(reason(canLeave({ status: s, role: "member" }))).toBe(
          "league_not_pre_draft",
        );
      }),
      { numRuns: 100 },
    );
  });
});

describe("canRemove", () => {
  it("lets the admin remove another member pre_draft", () => {
    expect(
      canRemove({ status: "pre_draft", actorRole: "admin", isSelf: false }),
    ).toEqual({ ok: true });
  });

  it("refuses a non-admin", () => {
    fc.assert(
      fc.property(status, fc.boolean(), (s, self) => {
        const r = canRemove({ status: s, actorRole: "member", isSelf: self });
        expect(r).toEqual({ ok: false, reason: "not_admin", status: 403 });
      }),
      { numRuns: 100 },
    );
  });

  it("refuses self-removal and removal after the start", () => {
    expect(
      reason(
        canRemove({ status: "pre_draft", actorRole: "admin", isSelf: true }),
      ),
    ).toBe("cannot_remove_self");
    expect(
      reason(
        canRemove({ status: "drafting", actorRole: "admin", isSelf: false }),
      ),
    ).toBe("league_not_pre_draft");
  });
});

describe("canRegenerateCode", () => {
  it("admin pre_draft only", () => {
    fc.assert(
      fc.property(status, role, (s, r) => {
        expect(canRegenerateCode({ status: s, actorRole: r }).ok).toBe(
          s === "pre_draft" && r === "admin",
        );
      }),
      { numRuns: 100 },
    );
  });
});

describe("canTransfer", () => {
  it("admin to a member, in any status", () => {
    expect(canTransfer({ actorRole: "admin", targetIsMember: true })).toEqual({
      ok: true,
    });
  });

  it("refuses non-admins and non-members", () => {
    expect(
      reason(canTransfer({ actorRole: "member", targetIsMember: true })),
    ).toBe("not_admin");
    expect(
      reason(canTransfer({ actorRole: "admin", targetIsMember: false })),
    ).toBe("target_not_member");
  });
});

describe("canDelete", () => {
  const base = {
    status: "pre_draft" as LeagueStatus,
    actorRole: "admin" as MemberRole,
    leagueName: "Office 2026",
  };

  it("needs the name, ignoring case and edge spaces", () => {
    expect(canDelete({ ...base, confirmName: " Office 2026 " })).toEqual({
      ok: true,
    });
    expect(canDelete({ ...base, confirmName: "OFFICE 2026" })).toEqual({
      ok: true,
    });
    expect(reason(canDelete({ ...base, confirmName: "Office 202" }))).toBe(
      "confirmation_mismatch",
    );
  });

  it("only the admin, in any status", () => {
    fc.assert(
      fc.property(status, role, (s, r) => {
        const result = canDelete({
          status: s,
          actorRole: r,
          leagueName: "X",
          confirmName: "X",
        });
        expect(result.ok).toBe(r === "admin");
      }),
      { numRuns: 100 },
    );
  });
});

describe("canSetDraftDate", () => {
  it("admin pre_draft only", () => {
    fc.assert(
      fc.property(status, role, (s, r) => {
        expect(canSetDraftDate({ status: s, actorRole: r }).ok).toBe(
          s === "pre_draft" && r === "admin",
        );
      }),
      { numRuns: 100 },
    );
  });
});
