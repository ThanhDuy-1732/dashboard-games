import type { GameState, PlayerId, PlayerView } from './types.js';
export function projectGame(state:GameState,viewer:PlayerId):PlayerView {
  return structuredClone({gameId:state.gameId,rulesVersion:state.rulesVersion,viewerId:viewer,revision:state.revision,phase:state.phase,players:state.players,board:state.board,turn:state.turn,bank:state.bank,purchase:state.purchase,auction:state.auction,debt:state.debt,mortgageTransfers:state.mortgageTransfers,trades:state.trades,recentEvents:state.recentEvents,winner:state.winner,allowedActions:state.phase==='awaiting-roll'&&state.turn.playerId===viewer?[{type:'roll'}]:[]});
}
