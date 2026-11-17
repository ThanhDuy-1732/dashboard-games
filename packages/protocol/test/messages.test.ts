import { expect,it } from 'vitest';
import { commandSchema, playerConfigSchema, gameStateSchema } from '../src/index.js';
import { makeState } from '../../game-core/test/fixtures/state-factory.js';
const command={protocolVersion:1,gameId:'game-1',commandId:'d3311df8-3437-4afb-9da3-afb6790b99c8',expectedRevision:0,action:{type:'bid',amount:10}};
it('validates_command_and_name_boundaries',()=>{
  expect(commandSchema.safeParse(command).success).toBe(true);
  for(const amount of [NaN,Infinity,-1,1.5,Number.MAX_SAFE_INTEGER+1,'10'])expect(commandSchema.safeParse({...command,action:{type:'bid',amount}}).success).toBe(false);
  for(const bad of [{...command,protocolVersion:2},{...command,playerId:'p2'},{...command,action:{type:'hack'}},{...command,action:{type:'roll',dice:[6,6]}},{...command,expectedRevision:-1},{...command,commandId:'bad'}])expect(commandSchema.safeParse(bad).success).toBe(false);
  const player={id:'p1',name:' Bạn ',token:'car',kind:'human'};
  expect(playerConfigSchema.parse(player).name).toBe('Bạn');
  for(const name of ['', '   ', 'a'.repeat(21)])expect(playerConfigSchema.safeParse({...player,name}).success).toBe(false);
});
it('validates_full_state_before_loading',()=>{
  const state=makeState();expect(gameStateSchema.safeParse(state).success).toBe(true);
  expect(gameStateSchema.safeParse({...state,players:[{...state.players[0],cash:-1}]}).success).toBe(false);
  expect(gameStateSchema.safeParse({...state,board:[]}).success).toBe(false);
  expect(gameStateSchema.safeParse({...state,rulesVersion:'other'}).success).toBe(false);
});
