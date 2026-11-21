import { chooseBotAction, createGame, TOKENS } from "@nha-choi/game-core";
import type { BoardSize, PlayerConfig, GameState } from "@nha-choi/game-core";
import { createAuthority } from "@nha-choi/protocol";
import type {
  GameSession,
  SessionUpdate,
  CommandEnvelope,
} from "@nha-choi/protocol";
import { cryptoRandom } from "../random.js";
import { savedGameSchema } from "../storage/save-schema.js";
import type { SavedGame } from "../storage/save-schema.js";
import { trackGame } from "../telemetry.js";
export interface OfflineSession extends GameSession {
  snapshot(): GameState;
  pause(reason: string): void;
  resume(): void;
}
export function createOfflineSession(
  {
    human,
    botCount,
    boardSize,
  }: {
    human: PlayerConfig;
    botCount: number;
    boardSize?: BoardSize;
  },
  saved?: SavedGame,
): OfflineSession {
  if (!Number.isInteger(botCount) || botCount < 1 || botCount > 5)
    throw new RangeError("Chọn từ 1 đến 5 đối thủ máy.");
  const bots = TOKENS.filter((t) => t !== human.token)
    .slice(0, botCount)
    .map((token, i): PlayerConfig => ({
      id: `bot-${i + 1}`,
      name: `Máy ${i + 1}`,
      token,
      kind: "bot",
    }));
  const restored = saved ? savedGameSchema.parse(saved) : undefined;
  if (restored && restored.humanId !== human.id)
    throw new Error("Offline player does not match snapshot");
  const authority = createAuthority(
    restored?.state ??
      createGame(
        {
          gameId: crypto.randomUUID(),
          players: [{ ...human, kind: "human" }, ...bots],
          boardSize,
        },
        cryptoRandom,
      ),
    cryptoRandom,
  );
  const listeners = new Set<(update: SessionUpdate) => void>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  let failure: string | undefined;
  function update(): SessionUpdate {
    return {
      connection: closed ? "closed" : failure ? "paused" : "connected",
      view: authority.getView(human.id),
      ...(failure ? { reason: failure } : {}),
    };
  }
  let finished = restored?.state.phase === "finished";
  function emit() {
    const value = update();
    if (!finished && value.view?.phase === "finished") {
      finished = true;
      trackGame("ty-phu", value.view.gameId, "game_completed");
    }
    for (const listener of listeners) listener(value);
  }
  function schedule() {
    clearTimeout(timer);
    if (closed || failure) return;
    const state = authority.snapshot();
    if (state.phase === "finished") return;
    let actor: string | undefined;
    if (state.phase === "auction")
      actor = state.auction!.participants.find(
        (id) =>
          id !== state.auction!.bidder &&
          state.players.find((p) => p.id === id)?.kind === "bot",
      );
    else if (state.phase === "debt")
      actor =
        state.trades.find(
          (t) =>
            t.from === state.debt!.payer &&
            state.players.find((p) => p.id === t.to)?.kind === "bot",
        )?.to ?? state.debt!.payer;
    else if (state.phase === "mortgage-transfer")
      actor = state.mortgageTransfers[0]!.playerId;
    else
      actor =
        state.trades.find(
          (t) => state.players.find((p) => p.id === t.to)?.kind === "bot",
        )?.to ?? state.turn.playerId;
    if (!actor || state.players.find((p) => p.id === actor)?.kind !== "bot")
      return;
    const botId = actor;
    timer = setTimeout(() => {
      if (closed) return;
      try {
        const view = authority.getView(botId);
        const reply = authority.dispatch(botId, {
          protocolVersion: 1,
          gameId: view.gameId,
          commandId: crypto.randomUUID(),
          expectedRevision: view.revision,
          action: chooseBotAction(view),
        });
        if (!reply.ok)
          failure =
            "Máy chưa thực hiện được bước tiếp theo. Ván được giữ để bạn thử mở lại.";
      } catch {
        failure = "Máy gặp lỗi khi xử lý lượt. Ván hiện tại được giữ nguyên.";
      }
      emit();
      schedule();
    }, 120);
  }
  schedule();
  return {
    async setActive(active) {
      if (active) this.resume();
      else this.pause("Ván đang tạm dừng khi ứng dụng ở nền.");
    },
    async send(command: CommandEnvelope) {
      if (closed || failure)
        return {
          ok: false,
          code: "PAUSED",
          commandId: command.commandId,
          revision: authority.snapshot().revision,
        };
      const reply = authority.dispatch(human.id, command);
      emit();
      schedule();
      return reply;
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(update());
      return () => {
        listeners.delete(listener);
      };
    },
    async close() {
      closed = true;
      clearTimeout(timer);
      emit();
      listeners.clear();
    },
    snapshot() {
      return authority.snapshot();
    },
    pause(reason) {
      if (closed) return;
      failure = reason;
      clearTimeout(timer);
      emit();
    },
    resume() {
      if (closed) return;
      failure = undefined;
      emit();
      schedule();
    },
  };
}
