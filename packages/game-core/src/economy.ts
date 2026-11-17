import type {GameState,PlayerId} from './types.js';
import {playerById,recordEvent,requireRule} from './rules.js';
export function settlePayment(state:GameState,payer:PlayerId|'bank',payee:PlayerId|'bank',amount:number):boolean {
 requireRule(Number.isSafeInteger(amount)&&amount>=0,'INVALID_GAME');
 if(amount===0||payer===payee)return true;
 if(payer!=='bank'){
  const from=playerById(state,payer);if(from.bankrupt)return true;
  if(from.cash<amount){state.debt={payer,payee,amount};state.phase='debt';recordEvent(state,'debt',`${from.name} cần thanh toán ${amount}.`,{playerId:payer,amount});return false;}
  from.cash-=amount;
 }
 if(payee!=='bank'){const recipient=playerById(state,payee);requireRule(Number.isSafeInteger(recipient.cash+amount),'INVALID_GAME');recipient.cash+=amount;}
 recordEvent(state,'payment',`${payer==='bank'?'Ngân hàng':playerById(state,payer).name} trả ${amount} cho ${payee==='bank'?'ngân hàng':playerById(state,payee).name}.`,{amount});
 return true;
}
