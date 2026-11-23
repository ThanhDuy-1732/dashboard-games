/** @vitest-environment jsdom */
import { beforeEach, expect, it, vi } from "vitest";
import { DINO_BEST_KEY, readDinoBest, saveDinoBest } from "../src/dino/save.js";

beforeEach(() => localStorage.clear());

it("reads zero with empty, corrupt or negative data", () => {
  expect(readDinoBest(localStorage)).toBe(0);
  for (const value of ["NaN", "Infinity", "-3", "2.5", "bad"]) {
    localStorage.setItem(DINO_BEST_KEY, value);
    expect(readDinoBest(localStorage)).toBe(0);
  }
});

it("records whole meters and retains existing records across shorter runs", () => {
  expect(saveDinoBest(localStorage, 248.9)).toBe(248);
  expect(saveDinoBest(localStorage, 200)).toBe(248);
  expect(readDinoBest(localStorage)).toBe(248);
});

it("leaves the current record visible when storage cannot write", () => {
  const storage: Storage = {
    clear: vi.fn(), getItem: vi.fn(() => "12"), key: vi.fn(), length: 1,
    removeItem: vi.fn(),
    setItem: vi.fn(() => { throw new DOMException("Quota", "QuotaExceededError"); }),
  };
  expect(saveDinoBest(storage, 25)).toBe(25);
});

it("keeps map records separate and reads the existing volcano record", () => {
  localStorage.setItem(DINO_BEST_KEY, "248");
  expect(readDinoBest(localStorage, "volcano")).toBe(248);
  expect(readDinoBest(localStorage, "forest")).toBe(0);
  expect(saveDinoBest(localStorage, 320, "forest")).toBe(320);
  expect(readDinoBest(localStorage, "ice")).toBe(0);
  expect(readDinoBest(localStorage)).toBe(248);
});
