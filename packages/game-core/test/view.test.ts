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
