import { z } from "zod";
import type { GameAction, PlayerConfig } from "@nha-choi/game-core";
const wireTextSchema = z.string().regex(/^[^\u0000\uD800-\uDFFF]*$/u);
export const moneySchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const playerConfigSchema = z.strictObject({
  id: wireTextSchema.min(1).max(64),
  name: wireTextSchema.trim().min(1).max(20),
  token: z.enum(["car", "cat", "hat", "ship", "dog", "plane"]),
  kind: z.enum(["human", "bot"]),
}) satisfies z.ZodType<PlayerConfig>;
const spaceId = z.number().int().min(0).max(39);
export const tradeBundleSchema = z.strictObject({
  cash: moneySchema,
  spaceIds: z
    .array(spaceId)
    .max(28)
    .refine((a) => new Set(a).size === a.length),
  jailCards: z
    .array(wireTextSchema.min(1).max(32))
    .max(2)
    .refine((a) => new Set(a).size === a.length),
});
export const gameActionSchema: z.ZodType<GameAction> = z.union([
  z.strictObject({
    type: z.enum([
      "roll",
      "buy-property",
      "decline-property",
      "pass-auction",
      "pay-jail",
      "declare-bankruptcy",
      "end-turn",
    ]),
  }),
  z.strictObject({
    type: z.literal("bid"),
    amount: moneySchema.min(1),
    spaceId: spaceId.optional(),
  }),
  z.strictObject({
    type: z.enum(["build", "sell-building", "mortgage", "unmortgage"]),
    spaceId,
  }),
  z.strictObject({
    type: z.literal("use-jail-card"),
    cardId: wireTextSchema.min(1).max(32),
  }),
  z.strictObject({
    type: z.literal("offer-trade"),
    to: wireTextSchema.min(1).max(64),
    give: tradeBundleSchema,
    receive: tradeBundleSchema,
  }),
  z.strictObject({
    type: z.enum(["accept-trade", "reject-trade"]),
    tradeId: wireTextSchema.min(1).max(64),
  }),
  z.strictObject({
    type: z.literal("resolve-mortgage-transfer"),
    spaceId,
    choice: z.enum(["keep", "redeem"]),
  }),
]);
export const commandSchema = z.strictObject({
  protocolVersion: z.literal(1),
  gameId: wireTextSchema.min(1).max(64),
  commandId: z.uuid(),
  expectedRevision: moneySchema,
  action: gameActionSchema,
});
export type CommandEnvelope = z.infer<typeof commandSchema>;
export const commandErrorCodeSchema = z.enum([
  "RATE_LIMITED",
  "STALE_REVISION",
  "NOT_AUTHORIZED",
  "INVALID_ACTION",
  "PROTOCOL_MISMATCH",
  "COMMAND_ID_REUSED",
  "PAUSED",
  "INSUFFICIENT_FUNDS",
  "INVALID_GAME",
  "STORAGE_UNAVAILABLE",
]);
export type CommandErrorCode = z.infer<typeof commandErrorCodeSchema>;
export const commandReplySchema = z.discriminatedUnion("ok", [
  z.strictObject({
    ok: z.literal(true),
    commandId: z.uuid(),
    revision: moneySchema,
  }),
  z.strictObject({
    ok: z.literal(false),
    commandId: z.uuid(),
    code: commandErrorCodeSchema,
    revision: moneySchema,
  }),
]);
export type CommandReply = z.infer<typeof commandReplySchema>;
