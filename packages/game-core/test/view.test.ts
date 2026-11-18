import { expect, it } from 'vitest';
import { projectGame } from '../src/index.js';
import { makeState } from './fixtures/state-factory.js';
it('project_hides_deck_order_and_never_exposes_mutable_state',()=>{
  const state=makeState();const view=projectGame(state,'p1');
  expect(view.viewerId).toBe('p1');expect(view.revision).toBe(0);
  expect(view).not.toHaveProperty('decks');expect(view).not.toHaveProperty('pendingEffects');
  expect(view).not.toHaveProperty('random');expect(view).not.toHaveProperty('resumeToken');
  view.players[0]!.cash=0;view.board[0]!.owner='p2';
  expect(state.players[0]!.cash).toBe(1500);expect(state.board[0]!.owner).toBeNull();
});
it('only_current_player_gets_roll_capability',()=>{
  expect(projectGame(makeState(),'p1').allowedActions.some(a=>a.type==='roll')).toBe(true);
  expect(projectGame(makeState(),'p2').allowedActions.some(a=>a.type==='roll')).toBe(false);
});
it('exposes_only_relevant_auction_and_debt_actions',()=>{
 const state=makeState();state.phase='auction';state.auction={kind:'property',spaceId:6,bid:100,bidder:'p1',participants:['p1','p2']};
 expect(projectGame(state,'p1').allowedActions.map(a=>a.type)).not.toContain('pass-auction');
 expect(projectGame(state,'p2').allowedActions.map(a=>a.type)).toEqual(['bid','pass-auction']);
 state.phase='debt';state.auction=null;state.debt={payer:'p1',payee:'bank',amount:50};state.players[0]!.cash=0;
 expect(projectGame(state,'p1').allowedActions.map(a=>a.type)).toContain('declare-bankruptcy');
 expect(projectGame(state,'p2').allowedActions).toEqual([]);
});
it('offers_asset_actions_without_revealing_internal_continuations',()=>{
 const state=makeState();for(const i of [6,8,9])state.board[i]!.owner='p1';
 const view=projectGame(state,'p1');expect(view.allowedActions.find(a=>a.type==='build')?.spaceIds).toEqual([6,8,9]);expect(view.allowedActions.find(a=>a.type==='mortgage')?.spaceIds).toEqual([6,8,9]);expect(view).not.toHaveProperty('resumePhase');
});
