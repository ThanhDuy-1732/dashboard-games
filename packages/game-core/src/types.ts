export type PlayerId = string;
export const TOKENS = [
  "car",
  "cat",
  "hat",
  "ship",
  "dog",
  "plane",
  "rocket",
  "bike",
  "robot",
  "butterfly",
  "camera",
  "guitar",
] as const;
export type Token = (typeof TOKENS)[number];
export interface PlayerConfig {
  id: PlayerId;
  name: string;
  token: Token;
  kind: "human" | "bot";
}
export interface Player extends PlayerConfig {
  cash: number;
  position: number;
  bankrupt: boolean;
  jail: { turns: number } | null;
  jailCards: string[];
}
export type Phase =
  | "awaiting-roll"
  | "awaiting-purchase"
  | "auction"
  | "debt"
  | "jail-choice"
  | "mortgage-transfer"
  | "awaiting-end-turn"
  | "finished";
export interface Space {
  id: number;
  name: string;
  kind:
    | "go"
    | "street"
    | "chance"
    | "community"
    | "tax"
    | "station"
    | "utility"
    | "jail"
    | "parking"
    | "go-to-jail";
  price?: number;
  mortgage?: number;
  group?: number;
  color?: string;
  rent?: number[];
  buildCost?: number;
  tax?: number;
}
export interface Property {
  owner: PlayerId | null;
  buildings: number;
  mortgaged: boolean;
}
export interface TradeBundle {
  cash: number;
  spaceIds: number[];
  jailCards: string[];
}
export interface TradeOffer {
  id: string;
  from: PlayerId;
  to: PlayerId;
  give: TradeBundle;
  receive: TradeBundle;
}
export type GameAction =
  | {
      type:
        | "roll"
        | "buy-property"
        | "decline-property"
        | "pass-auction"
        | "pay-jail"
        | "declare-bankruptcy"
        | "end-turn";
    }
  | { type: "bid"; amount: number; spaceId?: number }
  | {
      type: "build" | "sell-building" | "mortgage" | "unmortgage";
      spaceId: number;
    }
  | { type: "use-jail-card"; cardId: string }
  | {
      type: "offer-trade";
      to: PlayerId;
      give: TradeBundle;
      receive: TradeBundle;
    }
  | { type: "accept-trade" | "reject-trade"; tradeId: string }
  | {
      type: "resolve-mortgage-transfer";
      spaceId: number;
      choice: "keep" | "redeem";
    };
export type ActionType = GameAction["type"];
export interface ActionHint {
  type: ActionType;
  spaceIds?: number[];
  playerIds?: PlayerId[];
  minimum?: number;
  maximum?: number;
  cardIds?: string[];
  tradeIds?: string[];
}
export type CardEffect =
  | { type: "move-to"; spaceId: number }
  | { type: "move-relative"; steps: number }
  | { type: "nearest"; kind: "station" | "utility" }
  | { type: "pay" | "receive" | "pay-each" | "receive-each"; amount: number }
  | { type: "repairs"; house: number; hotel: number }
  | { type: "jail" | "jail-card" };
export interface Card {
  id: string;
  text: string;
  effect: CardEffect;
}
export type Effect =
  | {
      type: "payment";
      payer: PlayerId;
      payee: PlayerId | "bank";
      amount: number;
    }
  | {
      type: "land";
      playerId: PlayerId;
      stationMultiplier?: number;
      utilityMultiplier?: number;
    }
  | {
      type: "move";
      playerId: PlayerId;
      spaceId: number;
      salary: boolean;
      stationMultiplier?: number;
      utilityMultiplier?: number;
    }
  | { type: "auction"; spaceId: number };
export interface GameEvent {
  id: number;
  type: string;
  text: string;
  playerId?: PlayerId;
  spaceId?: number;
  amount?: number;
}
export interface Auction {
  spaceId: number;
  bid: number;
  bidder: PlayerId | null;
  participants: PlayerId[];
  kind: "property" | "house" | "hotel";
  targets?: Record<PlayerId, number>;
}
export interface GameState {
  gameId: string;
  rulesVersion: "classic-v1";
  revision: number;
  players: Player[];
  board: Property[];
  turn: {
    playerId: PlayerId;
    doubles: number;
    dice: [number, number] | null;
    extraRoll: boolean;
    number: number;
  };
  phase: Phase;
  decks: { chance: string[]; community: string[] };
  bank: { houses: number; hotels: number };
  purchase: number | null;
  auction: Auction | null;
  debt: { payer: PlayerId; payee: PlayerId | "bank"; amount: number } | null;
  pendingEffects: Effect[];
  mortgageTransfers: {
    playerId: PlayerId;
    spaceId: number;
    choice?: "keep" | "redeem";
  }[];
  trades: TradeOffer[];
  recentEvents: GameEvent[];
  winner: PlayerId | null;
  resumePhase: Phase | null;
}
export interface PlayerView {
  gameId: string;
  rulesVersion: "classic-v1";
  viewerId: PlayerId;
  revision: number;
  phase: Phase;
  players: Player[];
  board: Property[];
  turn: GameState["turn"];
  bank: GameState["bank"];
  purchase: number | null;
  auction: Auction | null;
  debt: GameState["debt"];
  mortgageTransfers: GameState["mortgageTransfers"];
  trades: TradeOffer[];
  recentEvents: GameEvent[];
  winner: PlayerId | null;
  allowedActions: ActionHint[];
}
export interface RandomSource {
  int(minInclusive: number, maxInclusive: number): number;
}
export type RuleErrorCode =
  "NOT_AUTHORIZED" | "INVALID_ACTION" | "INSUFFICIENT_FUNDS" | "INVALID_GAME";
export type ActionResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; code: RuleErrorCode };
