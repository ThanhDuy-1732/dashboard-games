import { z } from "zod";
import { BOARD_SIZES } from "@nha-choi/game-core";
import { playerConfigSchema } from "./messages.js";
export const resumeTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const boardSizeSchema = z.literal(BOARD_SIZES);
export const createRoomSchema = playerConfigSchema
  .pick({ name: true, token: true })
  .extend({
    resumeToken: resumeTokenSchema.optional(),
    boardSize: boardSizeSchema.optional(),
  });
export const joinRoomSchema = createRoomSchema.omit({ boardSize: true }).extend({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/),
});
export const readySchema = z.strictObject({ ready: z.boolean() });
export const leaveRoomSchema = z.strictObject({
  discard: z.boolean().optional(),
});
export const emptyRoomSchema = z.strictObject({});
export const resumeRoomSchema = z.strictObject({
  resumeToken: resumeTokenSchema,
});
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
