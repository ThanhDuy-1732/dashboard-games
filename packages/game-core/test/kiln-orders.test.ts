import { expect, it } from "vitest";
import { advanceKilnOrder, startKilnOrder } from "../src/kiln-orders.js";

const move = (pots = 0, rows = 0, columns = 0) => ({ pots, rows, columns });

it("starts timing on the first harvest and rewards a second pot on the last turn", () => {
  let order = startKilnOrder();
  expect(advanceKilnOrder(order, move()).next).toEqual(order);
  order = advanceKilnOrder(order, move(1)).next;
  expect(order).toMatchObject({ progress: 1, remaining: 4 });
  for (let i = 0; i < 3; i++) order = advanceKilnOrder(order, move()).next;
  expect(advanceKilnOrder(order, move(1))).toMatchObject({ outcome: "completed", bonus: 60, next: { kind: "cross" } });
  expect(advanceKilnOrder(order, move())).toMatchObject({ outcome: "expired", bonus: 0, next: { kind: "cross" } });
});

it("requires both directions for a cross and consecutive harvests for a streak", () => {
  let order = startKilnOrder("cross");
  expect(advanceKilnOrder(order, move(0, 2, 0)).outcome).toBeNull();
  order = advanceKilnOrder(order, move(0, 1, 1)).next;
  expect(order.kind).toBe("streak");
  order = advanceKilnOrder(order, move(1)).next;
  expect(order.progress).toBe(1);
  order = advanceKilnOrder(order, move()).next;
  expect(order.progress).toBe(0);
  order = advanceKilnOrder(order, move(2)).next;
  expect(order.progress).toBe(1);
  expect(advanceKilnOrder(order, move(1))).toMatchObject({ outcome: "completed", bonus: 100, next: { kind: "pots" } });
});
