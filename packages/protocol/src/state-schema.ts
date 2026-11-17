import {z} from 'zod';
import type {GameState} from '@nha-choi/game-core';
import {moneySchema,playerConfigSchema,tradeBundleSchema} from './messages.js';
const id=z.string().min(1).max(64);
const spaceId=z.number().int().min(0).max(39);
const payer=id;
const payee=id;
const player=playerConfigSchema.extend({cash:moneySchema,position:spaceId,bankrupt:z.boolean(),jail:z.strictObject({turns:z.number().int().min(0).max(3)}).nullable(),jailCards:z.array(z.string().max(32)).max(2)});
const effect=z.union([
 z.strictObject({type:z.literal('payment'),payer,payee,amount:moneySchema}),
 z.strictObject({type:z.literal('land'),playerId:id,stationMultiplier:moneySchema.optional(),utilityMultiplier:moneySchema.optional()}),
 z.strictObject({type:z.literal('move'),playerId:id,spaceId,salary:z.boolean(),stationMultiplier:moneySchema.optional(),utilityMultiplier:moneySchema.optional()}),
]);
export const gameStateSchema:z.ZodType<GameState>=z.strictObject({
 gameId:id,rulesVersion:z.literal('classic-v1'),revision:moneySchema,
 players:z.array(player).min(2).max(6),
 board:z.array(z.strictObject({owner:id.nullable(),buildings:z.number().int().min(0).max(5),mortgaged:z.boolean()})).length(40),
 turn:z.strictObject({playerId:id,doubles:z.number().int().min(0).max(3),dice:z.tuple([z.number().int().min(1).max(6),z.number().int().min(1).max(6)]).nullable(),extraRoll:z.boolean(),number:moneySchema.min(1)}),
 phase:z.enum(['awaiting-roll','awaiting-purchase','auction','debt','jail-choice','mortgage-transfer','awaiting-end-turn','finished']),
 decks:z.strictObject({chance:z.array(z.string().max(32)).max(16),community:z.array(z.string().max(32)).max(16)}),
 bank:z.strictObject({houses:z.number().int().min(0).max(32),hotels:z.number().int().min(0).max(12)}),
 purchase:spaceId.nullable(),
 auction:z.strictObject({spaceId,bid:moneySchema,bidder:id.nullable(),participants:z.array(id).min(1).max(6),kind:z.enum(['property','house','hotel'])}).nullable(),
 debt:z.strictObject({payer,payee,amount:moneySchema.min(1)}).nullable(),
 pendingEffects:z.array(effect).max(100),mortgageTransfers:z.array(z.strictObject({playerId:id,spaceId})).max(28),
 trades:z.array(z.strictObject({id,from:id,to:id,give:tradeBundleSchema,receive:tradeBundleSchema})).max(50),
 recentEvents:z.array(z.strictObject({id:moneySchema,type:z.string().max(50),text:z.string().max(500),playerId:id.optional(),spaceId:spaceId.optional(),amount:moneySchema.optional()})).max(100),winner:id.nullable(),
});
