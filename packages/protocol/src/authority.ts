import { applyAction, projectGame } from "@nha-choi/game-core";
import type {
  GameState,
  PlayerId,
  RandomSource,
  PlayerView,
} from "@nha-choi/game-core";
import { z } from "zod";
import { commandSchema, commandReplySchema } from "./messages.js";
import type {
  CommandEnvelope,
  CommandReply,
  CommandErrorCode,
} from "./messages.js";
import { gameStateSchema } from "./state-schema.js";
export const authorityCheckpointSchema = z
  .strictObject({
    state: gameStateSchema,
    replies: z
      .array(
        z.strictObject({
          actor: z.string().min(1).max(64),
          command: commandSchema,
          reply: commandReplySchema,
        }),
      )
      .max(6144),
  })
  .superRefine(({ state, replies }, ctx) => {
    const seen = new Set<string>(),
      counts = new Map<string, number>();
    for (const entry of replies) {
      const key = `${entry.actor}:${entry.command.commandId}`;
      counts.set(entry.actor, (counts.get(entry.actor) ?? 0) + 1);
      if (
        !state.players.some((p) => p.id === entry.actor) ||
        entry.command.gameId !== state.gameId ||
        entry.command.commandId !== entry.reply.commandId ||
        entry.reply.revision > state.revision ||
        entry.reply.revision !==
          entry.command.expectedRevision + (entry.reply.ok ? 1 : 0) ||
        seen.has(key) ||
        counts.get(entry.actor)! > 1024
      )
        ctx.addIssue({ code: "custom", message: "Invalid command receipt" });
      seen.add(key);
    }
  });
export type AuthorityCheckpoint = z.infer<typeof authorityCheckpointSchema>;
export interface GameAuthority {
  checkpoint(): AuthorityCheckpoint;
  dispatch(actor: PlayerId, command: CommandEnvelope): CommandReply;
  cachedReply(
    actor: PlayerId,
    command: CommandEnvelope,
  ): CommandReply | undefined;
  getView(viewer: PlayerId): PlayerView;
  snapshot(): GameState;
}
export function createAuthority(
  initial: GameState,
  random: RandomSource,
  receipts: AuthorityCheckpoint["replies"] = [],
): GameAuthority {
  const parsed = authorityCheckpointSchema.parse({
    state: initial,
    replies: receipts,
  });
  let state = structuredClone(parsed.state);
  const caches = new Map<
    string,
    Map<string, { fingerprint: string; reply: CommandReply }>
  >();
  for (const entry of parsed.replies) {
    let cache = caches.get(entry.actor);
    if (!cache) {
      cache = new Map();
      caches.set(entry.actor, cache);
    }
    cache.set(entry.command.commandId, {
      fingerprint: JSON.stringify(entry.command),
      reply: structuredClone(entry.reply),
    });
  }
  function cachedReply(
    actor: PlayerId,
    command: CommandEnvelope,
  ): CommandReply | undefined {
    if (command.gameId !== state.gameId || command.protocolVersion !== 1)
      return undefined;
    const previous = caches.get(actor)?.get(command.commandId);
    if (!previous) return undefined;
    return previous.fingerprint === JSON.stringify(command)
      ? structuredClone(previous.reply)
      : {
          ok: false,
          code: "COMMAND_ID_REUSED",
          commandId: command.commandId,
          revision: state.revision,
        };
  }
  return {
    checkpoint() {
      return structuredClone({
        state,
        replies: [...caches].flatMap(([actor, cache]) =>
          [...cache.values()].map((value) => ({
            actor,
            command: JSON.parse(value.fingerprint) as CommandEnvelope,
            reply: value.reply,
          })),
        ),
      });
    },
    cachedReply,
    dispatch(actor, command) {
      const fail = (code: CommandErrorCode): CommandReply => ({
        ok: false,
        commandId:
          typeof command?.commandId === "string"
            ? command.commandId
            : "invalid",
        revision: state.revision,
        code,
      });
      if (!state.players.some((p) => p.id === actor))
        return fail("NOT_AUTHORIZED");
      if (command?.protocolVersion !== 1) return fail("PROTOCOL_MISMATCH");
      const parsed = commandSchema.safeParse(command);
      if (!parsed.success) return fail("INVALID_ACTION");
      const input = parsed.data;
      if (input.gameId !== state.gameId) return fail("INVALID_GAME");
      let cache = caches.get(actor);
      if (!cache) {
        cache = new Map();
        caches.set(actor, cache);
      }
      const fingerprint = JSON.stringify(input);
      const previous = cachedReply(actor, input);
      if (previous) return previous;
      if (input.expectedRevision !== state.revision)
        return fail("STALE_REVISION");
      const result = applyAction(state, actor, input.action, random);
      if (result.ok) state = result.state;
      const reply: CommandReply = result.ok
        ? { ok: true, commandId: input.commandId, revision: state.revision }
        : fail(result.code);
      cache.set(input.commandId, { fingerprint, reply });
      if (cache.size > 1024) cache.delete(cache.keys().next().value!);
      return structuredClone(reply);
    },
    getView(viewer) {
      if (!state.players.some((p) => p.id === viewer))
        throw new Error("NOT_AUTHORIZED");
      return projectGame(state, viewer);
    },
    snapshot() {
      return structuredClone(state);
    },
  };
}
