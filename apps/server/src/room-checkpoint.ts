import { z } from "zod";
import {
  authorityCheckpointSchema,
  playerConfigSchema,
} from "@nha-choi/protocol";
const timestamp = z.number().int().nonnegative().safe();
export const roomCheckpointSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    id: z.uuid(),
    code: z.string().regex(/^[A-Z0-9]{6}$/),
    hostId: z.uuid(),
    members: z
      .array(
        z.strictObject({
          id: z.uuid(),
          name: playerConfigSchema.shape.name,
          token: playerConfigSchema.shape.token,
          ready: z.boolean(),
          discardOnLeave: z.literal(true).optional(),
          socketId: z.string().min(1).max(128).nullable(),
          disconnectedAt: timestamp.nullable(),
          tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
        }),
      )
      .min(1)
      .max(6),
    authority: authorityCheckpointSchema.nullable(),
    lastActivity: timestamp,
    closedAt: timestamp.nullable(),
    reason: z.string().max(500),
    publishedCanEnd: z.boolean(),
  })
  .superRefine((room, ctx) => {
    const members = room.members,
      ids = new Set(members.map((m) => m.id));
    if (
      ids.size !== members.length ||
      !ids.has(room.hostId) ||
      new Set(members.map((m) => m.token)).size !== members.length ||
      new Set(members.map((m) => m.tokenHash)).size !== members.length
    )
      ctx.addIssue({ code: "custom", message: "Invalid room members" });
    if (
      room.authority &&
      (room.authority.state.gameId !== room.id ||
        room.authority.state.players.length !== members.length ||
        room.authority.state.players.some(
          (p) =>
            !members.some(
              (m) => m.id === p.id && m.name === p.name && m.token === p.token,
            ) || p.kind !== "human",
        ))
    )
      ctx.addIssue({ code: "custom", message: "Invalid room game" });
  });
export type RoomCheckpoint = z.infer<typeof roomCheckpointSchema>;
