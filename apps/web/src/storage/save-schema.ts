import { z } from "zod";
import { gameStateSchema } from "@nha-choi/protocol";
import type { GameState, PlayerId } from "@nha-choi/game-core";
export const savedGameSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    rulesVersion: z.literal("classic-v1"),
    gameId: z.string().min(1).max(64),
    revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    savedAt: z.iso.datetime(),
    state: gameStateSchema,
    humanId: z.string().min(1).max(64),
  })
  .superRefine((save, ctx) => {
    if (
      save.gameId !== save.state.gameId ||
      save.revision !== save.state.revision ||
      save.rulesVersion !== save.state.rulesVersion
    )
      ctx.addIssue({ code: "custom", message: "Snapshot metadata mismatch" });
    const humans = save.state.players.filter((p) => p.kind === "human");
    if (humans.length !== 1 || humans[0]!.id !== save.humanId)
      ctx.addIssue({ code: "custom", message: "Invalid offline player" });
  });
export type SavedGame = z.infer<typeof savedGameSchema>;
export function makeSavedGame(state: GameState, humanId: PlayerId): SavedGame {
  return savedGameSchema.parse({
    schemaVersion: 1,
    rulesVersion: "classic-v1",
    gameId: state.gameId,
    revision: state.revision,
    savedAt: new Date().toISOString(),
    state: structuredClone(state),
    humanId,
  });
}
