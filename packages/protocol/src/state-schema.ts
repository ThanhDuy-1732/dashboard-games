import { z } from "zod";
import type { GameState } from "@nha-choi/game-core";
import { BOARD, CHANCE, COMMUNITY, buildableSpaces } from "@nha-choi/game-core";
import {
  moneySchema,
  playerConfigSchema,
  tradeBundleSchema,
} from "./messages.js";
const id = z.string().min(1).max(64);
const spaceId = z.number().int().min(0).max(39);
const payer = id;
const payee = id;
const player = playerConfigSchema.extend({
  cash: moneySchema,
  position: spaceId,
  bankrupt: z.boolean(),
  jail: z.strictObject({ turns: z.number().int().min(0).max(3) }).nullable(),
  jailCards: z.array(z.string().max(32)).max(2),
});
const effect = z.union([
  z.strictObject({
    type: z.literal("payment"),
    payer,
    payee,
    amount: moneySchema,
  }),
  z.strictObject({
    type: z.literal("land"),
    playerId: id,
    stationMultiplier: moneySchema.optional(),
    utilityMultiplier: moneySchema.optional(),
  }),
  z.strictObject({ type: z.literal("auction"), spaceId }),
  z.strictObject({
    type: z.literal("move"),
    playerId: id,
    spaceId,
    salary: z.boolean(),
    stationMultiplier: moneySchema.optional(),
    utilityMultiplier: moneySchema.optional(),
  }),
]);
export const gameStateSchema: z.ZodType<GameState> = z
  .strictObject({
    gameId: id,
    rulesVersion: z.literal("classic-v1"),
    revision: moneySchema,
    players: z.array(player).min(2).max(6),
    board: z
      .array(
        z.strictObject({
          owner: id.nullable(),
          buildings: z.number().int().min(0).max(5),
          mortgaged: z.boolean(),
        }),
      )
      .length(40),
    turn: z.strictObject({
      playerId: id,
      doubles: z.number().int().min(0).max(3),
      dice: z
        .tuple([z.number().int().min(1).max(6), z.number().int().min(1).max(6)])
        .nullable(),
      extraRoll: z.boolean(),
      number: moneySchema.min(1),
    }),
    phase: z.enum([
      "awaiting-roll",
      "awaiting-purchase",
      "auction",
      "debt",
      "jail-choice",
      "mortgage-transfer",
      "awaiting-end-turn",
      "finished",
    ]),
    resumePhase: z
      .enum([
        "awaiting-roll",
        "awaiting-purchase",
        "auction",
        "debt",
        "jail-choice",
        "mortgage-transfer",
        "awaiting-end-turn",
        "finished",
      ])
      .nullable(),
    decks: z.strictObject({
      chance: z.array(z.string().max(32)).max(16),
      community: z.array(z.string().max(32)).max(16),
    }),
    bank: z.strictObject({
      houses: z.number().int().min(0).max(32),
      hotels: z.number().int().min(0).max(12),
    }),
    purchase: spaceId.nullable(),
    auction: z
      .strictObject({
        spaceId,
        bid: moneySchema,
        bidder: id.nullable(),
        participants: z.array(id).min(1).max(6),
        kind: z.enum(["property", "house", "hotel"]),
        targets: z.record(id, spaceId).optional(),
      })
      .nullable(),
    debt: z
      .strictObject({ payer, payee, amount: moneySchema.min(1) })
      .nullable(),
    pendingEffects: z.array(effect).max(100),
    mortgageTransfers: z
      .array(
        z.strictObject({
          playerId: id,
          spaceId,
          choice: z.enum(["keep", "redeem"]).optional(),
        }),
      )
      .max(28),
    trades: z
      .array(
        z.strictObject({
          id,
          from: id,
          to: id,
          give: tradeBundleSchema,
          receive: tradeBundleSchema,
        }),
      )
      .max(50),
    recentEvents: z
      .array(
        z.strictObject({
          id: moneySchema,
          type: z.string().max(50),
          text: z.string().max(500),
          playerId: id.optional(),
          spaceId: spaceId.optional(),
          amount: moneySchema.optional(),
        }),
      )
      .max(100),
    winner: id.nullable(),
  })
  .superRefine((state, ctx) => {
    if (state.board.length !== 40) return;
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const ids = new Set(state.players.map((p) => p.id));
    if (
      ids.size !== state.players.length ||
      ids.has("bank") ||
      new Set(state.players.map((p) => p.token)).size !== state.players.length
    )
      fail("Invalid player identities");
    if (!ids.has(state.turn.playerId)) fail("Unknown current player");
    let houses = state.bank.houses;
    let hotels = state.bank.hotels;
    for (const space of BOARD) {
      const property = state.board[space.id]!;
      if (
        property.owner !== null &&
        (!ids.has(property.owner) ||
          state.players.find((p) => p.id === property.owner)?.bankrupt)
      )
        fail("Invalid property owner");
      if (
        space.mortgage === undefined &&
        (property.owner !== null || property.mortgaged || property.buildings)
      )
        fail("Non-property asset state");
      if (property.owner === null && (property.mortgaged || property.buildings))
        fail("Unowned property has obligations");
      if (property.buildings) {
        if (space.kind !== "street" || property.mortgaged)
          fail("Invalid building");
        const group = BOARD.filter(
          (s) => s.kind === "street" && s.group === space.group,
        );
        if (
          group.some(
            (s) =>
              state.board[s.id]!.owner !== property.owner ||
              state.board[s.id]!.mortgaged,
          )
        )
          fail("Incomplete building group");
        if (
          Math.max(...group.map((s) => state.board[s.id]!.buildings)) -
            Math.min(...group.map((s) => state.board[s.id]!.buildings)) >
          1
        )
          fail("Uneven buildings");
        if (property.buildings === 5) hotels++;
        else houses += property.buildings;
      }
    }
    if (houses !== 32 || hotels !== 12) fail("Invalid building inventory");
    const held = state.players.flatMap((p) => p.jailCards);
    const cards = [...state.decks.chance, ...state.decks.community, ...held];
    const expected = [...CHANCE, ...COMMUNITY].map((c) => c.id);
    if (
      cards.length !== 32 ||
      new Set(cards).size !== 32 ||
      cards.some((c) => !expected.includes(c))
    )
      fail("Invalid card distribution");
    if (
      state.decks.chance.some((c) => !CHANCE.some((v) => v.id === c)) ||
      state.decks.community.some((c) => !COMMUNITY.some((v) => v.id === c)) ||
      held.some(
        (c) =>
          ![...CHANCE, ...COMMUNITY].some(
            (v) => v.id === c && v.effect.type === "jail-card",
          ),
      )
    )
      fail("Invalid card placement");
    if ((state.phase === "debt") !== (state.debt !== null))
      fail("Invalid debt phase");
    if (
      state.debt &&
      (!ids.has(state.debt.payer) ||
        (!ids.has(state.debt.payee) && state.debt.payee !== "bank"))
    )
      fail("Unknown debt party");
    if ((state.phase === "auction") !== (state.auction !== null))
      fail("Invalid auction phase");
    if (
      state.auction &&
      (state.auction.participants.some((p) => !ids.has(p)) ||
        new Set(state.auction.participants).size !==
          state.auction.participants.length ||
        (state.auction.bidder !== null &&
          !state.auction.participants.includes(state.auction.bidder)))
    )
      fail("Invalid auction participants");
    if (state.auction && state.auction.kind !== "property") {
      const auction = state.auction;
      if (
        !auction.targets ||
        auction.participants.some(
          (player) => auction.targets?.[player] === undefined,
        ) ||
        Object.entries(auction.targets ?? {}).some(
          ([player, target]) =>
            !ids.has(player) ||
            !buildableSpaces(
              state,
              player,
              auction.kind as "house" | "hotel",
            ).includes(target),
        ) ||
        (auction.kind === "house" ? state.bank.houses : state.bank.hotels) !== 1
      )
        fail("Invalid building auction targets");
    }
    if (state.phase === "awaiting-purchase" && state.purchase === null)
      fail("Missing purchase");
    if (state.phase === "mortgage-transfer" && !state.mortgageTransfers.length)
      fail("Missing mortgage obligation");
    if (
      state.mortgageTransfers.some(
        (t) =>
          state.board[t.spaceId]!.owner !== t.playerId ||
          !state.board[t.spaceId]!.mortgaged,
      )
    )
      fail("Invalid mortgage transfer");
    if (
      state.phase === "finished" &&
      (state.players.filter((p) => !p.bankrupt).length !== 1 ||
        !state.players.some((p) => p.id === state.winner && !p.bankrupt))
    )
      fail("Invalid winner");
    if (
      state.trades.some(
        (t) => !ids.has(t.from) || !ids.has(t.to) || t.from === t.to,
      )
    )
      fail("Invalid trade parties");
  });
