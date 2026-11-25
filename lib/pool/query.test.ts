import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUERY,
  SEARCH_MAX,
  SORT_KEYS,
  categoryParam,
  describeFilter,
  exactPattern,
  isDefaultQuery,
  parsePoolQuery,
  poolQueryToParams,
  searchPattern,
} from "./query";

const toObject = (params: URLSearchParams) => Object.fromEntries(params);

describe("parsePoolQuery", () => {
  it("defaults when nothing is given", () => {
    expect(parsePoolQuery({})).toEqual(DEFAULT_QUERY);
  });

  it("reads cat: missing or empty is all, none is uncategorized, c: is a name", () => {
    expect(parsePoolQuery({}).category).toEqual({ kind: "all" });
    expect(parsePoolQuery({ cat: "" }).category).toEqual({ kind: "all" });
    expect(parsePoolQuery({ cat: "none" }).category).toEqual({ kind: "none" });
    expect(parsePoolQuery({ cat: "c: Pop   Culture " }).category).toEqual({
      kind: "named",
      key: "pop culture",
    });
  });

  it("a category literally named none or all cannot be mistaken for the specials", () => {
    expect(parsePoolQuery({ cat: "c:none" }).category).toEqual({
      kind: "named",
      key: "none",
    });
    expect(categoryParam({ kind: "named", key: "none" })).toBe("c:none");
  });

  it("treats an unrecognized or empty-name cat as all", () => {
    expect(parsePoolQuery({ cat: "sports" }).category).toEqual({ kind: "all" });
    expect(parsePoolQuery({ cat: "c:" }).category).toEqual({ kind: "all" });
    expect(parsePoolQuery({ cat: "c:   " }).category).toEqual({ kind: "all" });
  });

  it("reads q, trimmed and cut to 100", () => {
    expect(parsePoolQuery({ q: "  hello " }).q).toBe("hello");
    expect([...parsePoolQuery({ q: "x".repeat(300) }).q]).toHaveLength(
      SEARCH_MAX,
    );
  });

  it("accepts each sort and falls back for anything else", () => {
    for (const sort of SORT_KEYS) {
      expect(parsePoolQuery({ sort }).sort).toBe(sort);
    }
    expect(parsePoolQuery({ sort: "price" }).sort).toBe("added");
    expect(parsePoolQuery({ sort: "TEXT" }).sort).toBe("added");
  });

  it("uses the first value of a repeated parameter", () => {
    expect(
      parsePoolQuery({ cat: ["c:a", "c:b"], q: ["x", "y"] }),
    ).toMatchObject({
      category: { kind: "named", key: "a" },
      q: "x",
    });
  });

  it("never throws and always returns a valid query", () => {
    const value = fc.oneof(
      fc.string({ unit: "binary" }),
      fc.array(fc.string()),
      fc.constant(undefined),
    );
    fc.assert(
      fc.property(value, value, value, (cat, q, sort) => {
        const query = parsePoolQuery({
          cat: cat as string,
          q: q as string,
          sort: sort as string,
        });
        expect(SORT_KEYS).toContain(query.sort);
        expect([...query.q].length).toBeLessThanOrEqual(SEARCH_MAX);
        if (query.category.kind === "named") {
          expect(query.category.key).not.toBe("");
          expect([...query.category.key].length).toBeLessThanOrEqual(40);
          expect(query.category.key).toBe(query.category.key.toLowerCase());
        }
      }),
      { numRuns: 300 },
    );
  });
});

describe("poolQueryToParams", () => {
  it("omits defaults", () => {
    expect(poolQueryToParams(DEFAULT_QUERY).toString()).toBe("");
    expect(isDefaultQuery(DEFAULT_QUERY)).toBe(true);
  });

  it("writes uncategorized as cat=none and adds the page after 1", () => {
    const params = poolQueryToParams(
      { category: { kind: "none" }, q: "", sort: "text" },
      3,
    );
    expect(params.toString()).toBe("cat=none&sort=text&page=3");
    expect(poolQueryToParams(DEFAULT_QUERY, 1).toString()).toBe("");
  });

  it("round-trips any parsed query", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        fc.constantFrom(...SORT_KEYS),
        fc.boolean(),
        (cat, q, sort, hasCat) => {
          const query = parsePoolQuery({
            ...(hasCat ? { cat: `c:${cat}` } : {}),
            q,
            sort,
          });
          const again = parsePoolQuery(toObject(poolQueryToParams(query)));
          expect(again).toEqual(query);
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe("searchPattern", () => {
  it("wraps the term and escapes LIKE wildcards", () => {
    expect(searchPattern("100%")).toBe("%100\\%%");
    expect(searchPattern("a_b")).toBe("%a\\_b%");
    expect(searchPattern("back\\slash")).toBe("%back\\\\slash%");
    expect(searchPattern('say "hi"')).toBe('%say "hi"%');
  });

  it("removes asterisks, which PostgREST treats as wildcards", () => {
    expect(searchPattern("a*b")).toBe("%ab%");
  });

  it("never leaves an unescaped wildcard from the input", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary" }), (term) => {
        const pattern = searchPattern(term);
        expect(pattern.startsWith("%")).toBe(true);
        expect(pattern.endsWith("%")).toBe(true);
        expect(pattern).not.toContain("*");
        const inner = pattern.slice(1, -1);
        // Every %, _ or \ in the inner part must be the second half of an escape.
        for (let i = 0; i < inner.length; i += 1) {
          if (inner[i] === "\\") {
            expect("\\%_").toContain(inner[i + 1]);
            i += 1;
          } else {
            expect("%_").not.toContain(inner[i]);
          }
        }
      }),
      { numRuns: 400 },
    );
  });
});

describe("exactPattern", () => {
  it("escapes wildcards but adds none", () => {
    expect(exactPattern("100%_x")).toBe("100\\%\\_x");
    expect(exactPattern("sports")).toBe("sports");
  });
});

describe("describeFilter", () => {
  it("lists active filters only", () => {
    expect(describeFilter(DEFAULT_QUERY)).toEqual([]);
    expect(
      describeFilter({ category: { kind: "none" }, q: "cup", sort: "text" }),
    ).toEqual(["category: Uncategorized", 'text contains "cup"']);
  });
});
