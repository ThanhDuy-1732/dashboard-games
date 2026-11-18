import {BOARD} from './board.js';
import type {GameState,PlayerId,TradeBundle} from './types.js';
import {playerById,recordEvent,requireRule} from './rules.js';
import {groupSpaces,requireManagement} from './assets.js';
import {settlePayment} from './economy.js';

function checkBundle(state:GameState,owner:PlayerId,bundle:TradeBundle){
 const player=playerById(state,owner);requireRule(!player.bankrupt);requireRule(Number.isSafeInteger(bundle.cash)&&bundle.cash>=0&&player.cash>=bundle.cash,'INSUFFICIENT_FUNDS');
 requireRule(new Set(bundle.spaceIds).size===bundle.spaceIds.length&&new Set(bundle.jailCards).size===bundle.jailCards.length);
 for(const id of bundle.spaceIds){requireRule(Number.isInteger(id)&&BOARD[id]?.mortgage!==undefined&&state.board[id]!.owner===owner);requireRule(groupSpaces(id).every(i=>state.board[i]!.buildings===0));requireRule(!state.mortgageTransfers.some(t=>t.spaceId===id&&t.choice==='redeem'));}
 requireRule(bundle.jailCards.every(card=>player.jailCards.includes(card)));
}
export function offerTrade(state:GameState,actor:PlayerId,to:PlayerId,give:TradeBundle,receive:TradeBundle){
 requireManagement(state,actor,state.phase==='debt');requireRule(actor!==to&&!playerById(state,to).bankrupt);requireRule(state.trades.length<50);
 checkBundle(state,actor,give);checkBundle(state,to,receive);
 state.trades.push({id:`trade-${state.revision+1}`,from:actor,to,give:structuredClone(give),receive:structuredClone(receive)});
 recordEvent(state,'trade-offer',`${playerById(state,actor).name} đề nghị giao dịch với ${playerById(state,to).name}.`,{playerId:actor});
}
export function acceptTrade(state:GameState,actor:PlayerId,tradeId:string){
 const trade=state.trades.find(t=>t.id===tradeId);requireRule(trade&&trade.to===actor,'NOT_AUTHORIZED');
 if(state.phase==='debt')requireRule(trade.from===state.debt?.payer);else requireManagement(state,actor);
 checkBundle(state,trade.from,trade.give);checkBundle(state,trade.to,trade.receive);
 const from=playerById(state,trade.from);const to=playerById(state,trade.to);
 requireRule(Number.isSafeInteger(from.cash-trade.give.cash+trade.receive.cash)&&Number.isSafeInteger(to.cash-trade.receive.cash+trade.give.cash));
 from.cash+=trade.receive.cash-trade.give.cash;to.cash+=trade.give.cash-trade.receive.cash;
 const previousPhase=state.phase;
 for(const [sender,recipient,bundle] of [[trade.from,trade.to,trade.give],[trade.to,trade.from,trade.receive]] as const){
  for(const id of bundle.spaceIds){state.board[id]!.owner=recipient;if(state.board[id]!.mortgaged)state.mortgageTransfers.push({playerId:recipient,spaceId:id});}
  for(const card of bundle.jailCards){const player=playerById(state,sender);player.jailCards.splice(player.jailCards.indexOf(card),1);playerById(state,recipient).jailCards.push(card);}
 }
 state.trades=state.trades.filter(t=>t.id!==tradeId);
 if(state.mortgageTransfers.length&&previousPhase!=='debt'){state.resumePhase??=previousPhase;state.phase='mortgage-transfer';}
 recordEvent(state,'trade',`${from.name} và ${to.name} hoàn tất giao dịch.`);
}
export function rejectTrade(state:GameState,actor:PlayerId,tradeId:string){
 const trade=state.trades.find(t=>t.id===tradeId);requireRule(trade&&(trade.from===actor||trade.to===actor),'NOT_AUTHORIZED');
 requireRule(state.phase!=='auction'&&state.phase!=='mortgage-transfer');if(state.phase==='debt')requireRule(trade.from===state.debt?.payer);
 state.trades=state.trades.filter(t=>t.id!==tradeId);
}
export function resolveMortgageTransfer(state:GameState,actor:PlayerId,spaceId:number,choice:'keep'|'redeem'){
 const pending=state.mortgageTransfers[0];requireRule(state.phase==='mortgage-transfer'&&pending&&pending.playerId===actor&&pending.spaceId===spaceId,'NOT_AUTHORIZED');
 requireRule(choice==='keep'||choice==='redeem');pending.choice=choice;
 const value=BOARD[spaceId]!.mortgage!;const cost=Math.ceil(value/10)+(choice==='redeem'?value:0);
 if(settlePayment(state,actor,'bank',cost))finishPaidTransfer(state);
}
export function finishPaidTransfer(state:GameState){
 const transfer=state.mortgageTransfers[0];if(!transfer?.choice)return;
 if(transfer.choice==='redeem'&&state.board[transfer.spaceId]!.owner===transfer.playerId)state.board[transfer.spaceId]!.mortgaged=false;
 state.mortgageTransfers.shift();state.phase=state.mortgageTransfers.length?'mortgage-transfer':'awaiting-end-turn';
}
