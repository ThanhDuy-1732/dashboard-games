import { applyAction, projectGame } from "@nha-choi/game-core";
import type {
  GameState,
  PlayerId,
  RandomSource,
  PlayerView,
} from "@nha-choi/game-core";
import { commandSchema } from "./messages.js";
import type {
  CommandEnvelope,
  CommandReply,
  CommandErrorCode,
} from "./messages.js";
import { gameStateSchema } from "./state-schema.js";
export interface GameAuthority {
  dispatch(actor: PlayerId, command: CommandEnvelope): CommandReply;
  getView(viewer: PlayerId): PlayerView;
  snapshot(): GameState;
}
export function createAuthority(
  initial: GameState,
  random: RandomSource,
): GameAuthority {
  let state = structuredClone(gameStateSchema.parse(initial));
  const caches = new Map<
    string,
    Map<string, { fingerprint: string; reply: CommandReply }>
  >();
  return {
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
      const previous = cache.get(input.commandId);
      if (previous)
        return previous.fingerprint === fingerprint
          ? structuredClone(previous.reply)
          : fail("COMMAND_ID_REUSED");
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
