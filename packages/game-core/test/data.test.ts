import { describe, expect, it } from "vitest";
import { BOARD, CHANCE, COMMUNITY } from "../src/index.js";

describe("classic-v1 data", () => {
  it("board_has_40_spaces_and_28_assets", () => {
    expect(BOARD).toHaveLength(40);
    expect(BOARD.map((s) => s.id)).toEqual(
      Array.from({ length: 40 }, (_, i) => i),
    );
    expect(BOARD.filter((s) => s.kind === "street")).toHaveLength(22);
    expect(BOARD.filter((s) => s.kind === "station")).toHaveLength(4);
    expect(BOARD.filter((s) => s.kind === "utility")).toHaveLength(2);
    expect(BOARD[6]).toMatchObject({
      name: "Phố Hàng Buồm",
      price: 100,
      rent: [6, 30, 90, 270, 400, 550],
    });
    expect(BOARD[39]).toMatchObject({ name: "Phố Phú Mỹ", price: 400 });
    expect(
      BOARD.filter((s) => s.kind === "street").map((s) => s.group),
    ).toEqual([
      0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7,
    ]);
  });
  it("every_asset_has_integer_economics_and_streets_have_six_rents", () => {
    for (const space of BOARD.filter((s) =>
      ["street", "station", "utility"].includes(s.kind),
    )) {
      expect(space.price).toBeGreaterThan(0);
      expect(Number.isSafeInteger(space.price)).toBe(true);
      expect(space.mortgage).toBe(space.price! / 2);
      if (space.kind === "street") {
        expect(space.rent).toHaveLength(6);
        expect(space.buildCost).toBeGreaterThan(0);
      }
    }
  });
  it("decks_have_16_unique_cards_each", () => {
    for (const cards of [CHANCE, COMMUNITY]) {
      expect(cards).toHaveLength(16);
      expect(new Set(cards.map((c) => c.id)).size).toBe(16);
      expect(cards.filter((c) => c.effect.type === "jail-card")).toHaveLength(
        1,
      );
      expect(cards.every((c) => c.text.length > 0)).toBe(true);
    }
  });
});
