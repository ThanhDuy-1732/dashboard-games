export const KILN_ORDER_KINDS = ["pots", "cross", "streak"] as const;
export type KilnOrderKind = (typeof KILN_ORDER_KINDS)[number];

export const KILN_ORDERS = {
  pots: { name: "Hai bình đúng hẹn", description: "Lấy 2 bình chín trong 5 lượt, tính từ lần lấy bình đầu tiên.", turns: 5, bonus: 60 },
  cross: { name: "Mẻ kép", description: "Xóa một hàng và một cột trong cùng một nước.", turns: 10, bonus: 80 },
  streak: { name: "Giữ nhịp", description: "Lấy bình chín trong hai nước đặt liên tiếp.", turns: 8, bonus: 100 },
} as const;

export type KilnOrderState = { kind: KilnOrderKind; progress: number; remaining: number | null };
export type KilnOrderResult = {
  next: KilnOrderState;
  outcome: "completed" | "expired" | null;
  bonus: number;
};

export function startKilnOrder(kind: KilnOrderKind = "pots"): KilnOrderState {
  return { kind, progress: 0, remaining: kind === "pots" ? null : KILN_ORDERS[kind].turns };
}

export function validKilnOrder({ kind, progress, remaining }: KilnOrderState): boolean {
  if (kind === "pots") return progress === 0 ? remaining === null : progress === 1 && remaining !== null && remaining >= 1 && remaining < KILN_ORDERS.pots.turns;
  return (progress === 0 || (kind === "streak" && progress === 1))
    && remaining !== null && remaining >= 1 && remaining <= KILN_ORDERS[kind].turns;
}

export function advanceKilnOrder(
  order: KilnOrderState,
  { pots, rows, columns }: { pots: number; rows: number; columns: number },
): KilnOrderResult {
  const config = KILN_ORDERS[order.kind];
  const remaining = order.remaining === null ? pots ? config.turns - 1 : null : order.remaining - 1;
  const progress = order.kind === "pots" ? order.progress + pots
    : order.kind === "streak" ? pots ? order.progress + 1 : 0
      : Number(rows > 0 && columns > 0);
  const completed = progress >= (order.kind === "cross" ? 1 : 2);
  const outcome = completed ? "completed" : remaining === 0 ? "expired" : null;
  const next = outcome
    ? startKilnOrder(KILN_ORDER_KINDS[(KILN_ORDER_KINDS.indexOf(order.kind) + 1) % KILN_ORDER_KINDS.length])
    : { ...order, progress, remaining };
  return { next, outcome, bonus: completed ? config.bonus : 0 };
}
