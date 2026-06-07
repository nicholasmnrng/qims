import { describe, expect, it } from "vitest";

import { paginationMeta, parsePagination } from "./pagination";

describe("pagination foundation", () => {
  it("uses safe defaults", () => {
    const pagination = parsePagination(new URLSearchParams());

    expect(pagination).toEqual({
      page: 1,
      limit: 20,
      offset: 0,
    });
  });

  it("caps limit at 100", () => {
    expect(() => parsePagination(new URLSearchParams("limit=101"))).toThrow();
  });

  it("builds pagination metadata", () => {
    expect(paginationMeta(2, 20, 45)).toEqual({
      page: 2,
      limit: 20,
      total: 45,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });
});
