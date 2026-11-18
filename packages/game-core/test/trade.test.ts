import {describe,expect,it} from 'vitest';
import {applyAction} from '../src/index.js';
import type {GameState,GameAction} from '../src/index.js';
import {makeState} from './fixtures/state-factory.js';
import {randomTape} from './fixtures/random-tape.js';
function act(s:GameState,actor:string,action:GameAction){const r=applyAction(s,actor,action,randomTape([]));expect(r.ok).toBe(true);if(!r.ok)throw new Error(r.code);return r.state;}
function offer(){const s=makeState();s.board[6]!.owner='p1';return act(s,'p1',{type:'offer-trade',to:'p2',give:{cash:0,spaceIds:[6],jailCards:[]},receive:{cash:100,spaceIds:[],jailCards:[]}});}
describe('atomic trades',()=>{
 it('trade_transfers_atomically_and_does_not_skip_the_current_turn',()=>{
  const s=offer();const next=act(s,'p2',{type:'accept-trade',tradeId:s.trades[0]!.id});
  expect(next.board[6]!.owner).toBe('p2');expect(next.players.map(p=>p.cash)).toEqual([1600,1400]);expect(next.trades).toHaveLength(0);expect(next.phase).toBe('awaiting-roll');
 });
 it('trade_revalidates_both_balances_and_ownership',()=>{
  const s=offer();s.players[1]!.cash=0;
  expect(applyAction(s,'p2',{type:'accept-trade',tradeId:s.trades[0]!.id},randomTape([])).ok).toBe(false);
  expect(s.board[6]!.owner).toBe('p1');expect(s.players[0]!.cash).toBe(1500);
  s.players[1]!.cash=1500;s.board[6]!.owner=null;
  expect(applyAction(s,'p2',{type:'accept-trade',tradeId:s.trades[0]!.id},randomTape([])).ok).toBe(false);
 });
 it('mortgaged_transfer_requires_receiver_choice_and_preserves_phase',()=>{
  const s=offer();s.board[6]!.mortgaged=true;
  let next=act(s,'p2',{type:'accept-trade',tradeId:s.trades[0]!.id});expect(next.phase).toBe('mortgage-transfer');
  expect(applyAction(next,'p1',{type:'resolve-mortgage-transfer',spaceId:6,choice:'keep'},randomTape([])).ok).toBe(false);
  next=act(next,'p2',{type:'resolve-mortgage-transfer',spaceId:6,choice:'keep'});
  expect(next.players[1]!.cash).toBe(1395);expect(next.board[6]!.mortgaged).toBe(true);expect(next.phase).toBe('awaiting-roll');
 });
 it('redeem_is_applied_only_after_the_transfer_fee_is_paid',()=>{
  const s=offer();s.board[6]!.mortgaged=true;
  let next=act(s,'p2',{type:'accept-trade',tradeId:s.trades[0]!.id});
  next.players[1]!.cash=0;next=act(next,'p2',{type:'resolve-mortgage-transfer',spaceId:6,choice:'redeem'});
  expect(next.phase).toBe('debt');expect(next.debt?.amount).toBe(55);expect(next.board[6]!.mortgaged).toBe(true);
 });
 it('only_the_recipient_can_accept_and_trades_cannot_include_buildings',()=>{
  const s=offer();expect(applyAction(s,'p1',{type:'accept-trade',tradeId:s.trades[0]!.id},randomTape([])).ok).toBe(false);
  s.board[6]!.buildings=1;expect(applyAction(s,'p2',{type:'accept-trade',tradeId:s.trades[0]!.id},randomTape([])).ok).toBe(false);
 });
});
