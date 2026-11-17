import { z } from 'zod';
import type { GameAction, PlayerConfig } from '@nha-choi/game-core';
export const moneySchema=z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const playerConfigSchema=z.strictObject({id:z.string().min(1).max(64),name:z.string().trim().min(1).max(20),token:z.enum(['car','cat','hat','ship','dog','plane']),kind:z.enum(['human','bot'])}) satisfies z.ZodType<PlayerConfig>;
const spaceId=z.number().int().min(0).max(39);
export const tradeBundleSchema=z.strictObject({cash:moneySchema,spaceIds:z.array(spaceId).max(28).refine(a=>new Set(a).size===a.length),jailCards:z.array(z.string().min(1).max(32)).max(2).refine(a=>new Set(a).size===a.length)});
export const gameActionSchema:z.ZodType<GameAction>=z.union([
 z.strictObject({type:z.enum(['roll','buy-property','decline-property','pass-auction','pay-jail','declare-bankruptcy','end-turn'])}),
 z.strictObject({type:z.literal('bid'),amount:moneySchema.min(1)}),
 z.strictObject({type:z.enum(['build','sell-building','mortgage','unmortgage']),spaceId}),
 z.strictObject({type:z.literal('use-jail-card'),cardId:z.string().min(1).max(32)}),
 z.strictObject({type:z.literal('offer-trade'),to:z.string().min(1).max(64),give:tradeBundleSchema,receive:tradeBundleSchema}),
 z.strictObject({type:z.enum(['accept-trade','reject-trade']),tradeId:z.string().min(1).max(64)}),
 z.strictObject({type:z.literal('resolve-mortgage-transfer'),spaceId,choice:z.enum(['keep','redeem'])}),
]);
export const commandSchema=z.strictObject({protocolVersion:z.literal(1),gameId:z.string().min(1).max(64),commandId:z.uuid(),expectedRevision:moneySchema,action:gameActionSchema});
export type CommandEnvelope=z.infer<typeof commandSchema>;
export type CommandErrorCode='STALE_REVISION'|'NOT_AUTHORIZED'|'INVALID_ACTION'|'PROTOCOL_MISMATCH'|'COMMAND_ID_REUSED'|'PAUSED'|'INSUFFICIENT_FUNDS'|'INVALID_GAME';
export type CommandReply={ok:true;commandId:string;revision:number}|{ok:false;commandId:string;code:CommandErrorCode;revision:number};
