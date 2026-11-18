import {BOARD} from './board.js';
import {CHANCE,COMMUNITY} from './cards.js';
import type {GameState,PlayerId,RandomSource,CardEffect,Effect} from './types.js';
import {advanceTurn,playerById,recordEvent,requireRule} from './rules.js';
import {getRent,settlePayment,startAuction} from './economy.js';

export function dice(random:RandomSource):[number,number]{
 const pair:[number,number]=[random.int(1,6),random.int(1,6)];
 requireRule(pair.every(n=>Number.isInteger(n)&&n>=1&&n<=6),'INVALID_GAME');return pair;
}
export function sendToJail(state:GameState,id:PlayerId){
 const player=playerById(state,id);player.position=10;player.jail={turns:0};state.turn.extraRoll=false;state.turn.doubles=0;
 recordEvent(state,'jail',`${player.name} vào tù.`,{playerId:id,spaceId:10});
}
function applyCard(state:GameState,id:PlayerId,effect:CardEffect,cardId:string){
 const player=playerById(state,id);
 switch(effect.type){
  case 'move-to':state.pendingEffects.unshift({type:'move',playerId:id,spaceId:effect.spaceId,salary:effect.spaceId<=player.position});break;
  case 'move-relative':{const target=(player.position+effect.steps+40)%40;state.pendingEffects.unshift({type:'move',playerId:id,spaceId:target,salary:effect.steps>0&&target<player.position});break;}
  case 'nearest':{const options=BOARD.filter(s=>s.kind===effect.kind);const target=options.find(s=>s.id>player.position)??options[0]!;
   state.pendingEffects.unshift({type:'move',playerId:id,spaceId:target.id,salary:target.id<player.position,...(effect.kind==='station'?{stationMultiplier:2}:{utilityMultiplier:10})});break;}
  case 'pay':state.pendingEffects.unshift({type:'payment',payer:id,payee:'bank',amount:effect.amount});break;
  case 'receive':state.pendingEffects.unshift({type:'payment',payer:'bank',payee:id,amount:effect.amount});break;
  case 'pay-each':case 'receive-each':state.pendingEffects.unshift(...state.players.filter(p=>p.id!==id&&!p.bankrupt).map(p=>({type:'payment' as const,payer:effect.type==='pay-each'?id:p.id,payee:effect.type==='pay-each'?p.id:id,amount:effect.amount})));break;
  case 'repairs':{const amount=state.board.reduce((sum,p)=>sum+(p.owner===id?(p.buildings===5?effect.hotel:p.buildings*effect.house):0),0);state.pendingEffects.unshift({type:'payment',payer:id,payee:'bank',amount});break;}
  case 'jail':sendToJail(state,id);break;
  case 'jail-card':player.jailCards.push(cardId);break;
 }
}
function land(state:GameState,effect:Extract<Effect,{type:'land'}>,random:RandomSource){
 const player=playerById(state,effect.playerId);const space=BOARD[player.position]!;
 recordEvent(state,'land',`${player.name} đến ${space.name}.`,{playerId:player.id,spaceId:space.id});
 if(['street','station','utility'].includes(space.kind)){
  const property=state.board[space.id]!;
  if(property.owner===null){state.purchase=space.id;state.phase='awaiting-purchase';}
  else if(property.owner!==player.id&&!property.mortgaged){
   let total=(state.turn.dice?.[0]??0)+(state.turn.dice?.[1]??0);
   if(space.kind==='utility'&&effect.utilityMultiplier){const pair=dice(random);total=pair[0]+pair[1];recordEvent(state,'utility-roll',`Gieo tính tiền tiện ích: ${total}.`,{playerId:player.id,amount:total});}
   state.pendingEffects.unshift({type:'payment',payer:player.id,payee:property.owner,amount:getRent(state,space.id,total,effect)});
  }
 }else if(space.kind==='tax')state.pendingEffects.unshift({type:'payment',payer:player.id,payee:'bank',amount:space.tax!});
 else if(space.kind==='go-to-jail')sendToJail(state,player.id);
 else if(space.kind==='chance'||space.kind==='community'){
  const deck=space.kind==='chance'?state.decks.chance:state.decks.community;
  const cardId=deck.shift();requireRule(cardId,'INVALID_GAME');
  const card=(space.kind==='chance'?CHANCE:COMMUNITY).find(c=>c.id===cardId);requireRule(card,'INVALID_GAME');
  if(card.effect.type!=='jail-card')deck.push(cardId);
  recordEvent(state,'card',card.text,{playerId:player.id});applyCard(state,player.id,card.effect,cardId);
 }
}
export function runEffects(state:GameState,random:RandomSource){
 if(state.phase==='finished'||state.phase==='mortgage-transfer')return;
 while(state.pendingEffects.length){
  const effect=state.pendingEffects.shift()!;
  if(effect.type==='payment'){if(!settlePayment(state,effect.payer,effect.payee,effect.amount))return;}
  else if(effect.type==='move'){
   const player=playerById(state,effect.playerId);if(player.bankrupt)continue;
   if(effect.salary)settlePayment(state,'bank',player.id,200);player.position=effect.spaceId;
   state.pendingEffects.unshift({type:'land',playerId:player.id,stationMultiplier:effect.stationMultiplier,utilityMultiplier:effect.utilityMultiplier});
  }else if(effect.type==='auction')startAuction(state,effect.spaceId);
  else land(state,effect,random);
  if(['awaiting-purchase','auction','debt','mortgage-transfer','finished'].includes(state.phase))return;
 }
 if(state.mortgageTransfers.length){state.phase='mortgage-transfer';return;}
 if(playerById(state,state.turn.playerId).bankrupt){state.resumePhase=null;advanceTurn(state);return;}
 state.phase=state.resumePhase??(state.turn.extraRoll?'awaiting-roll':'awaiting-end-turn');state.resumePhase=null;
}
export function roll(state:GameState,actor:PlayerId,random:RandomSource){
 requireRule(state.turn.playerId===actor,'NOT_AUTHORIZED');requireRule(state.phase==='awaiting-roll'||state.phase==='jail-choice');
 const player=playerById(state,actor);const pair=dice(random);const sum=pair[0]+pair[1];const doubles=pair[0]===pair[1];
 state.turn.dice=pair;state.turn.extraRoll=false;recordEvent(state,'roll',`${player.name} gieo ${pair[0]} và ${pair[1]}.`,{playerId:actor,amount:sum});
 if(player.jail){
  if(!doubles){player.jail.turns++;if(player.jail.turns<3){state.phase='awaiting-end-turn';return;}state.pendingEffects.push({type:'payment',payer:actor,payee:'bank',amount:50});}
  player.jail=null;state.turn.doubles=0;
 }else{
  state.turn.doubles=doubles?state.turn.doubles+1:0;
  if(state.turn.doubles===3){sendToJail(state,actor);state.phase='awaiting-end-turn';return;}
  state.turn.extraRoll=doubles;
 }
 state.pendingEffects.push({type:'move',playerId:actor,spaceId:(player.position+sum)%40,salary:player.position+sum>=40});
 // Resolve from a neutral phase so a previously pending purchase cannot stop a new effect chain.
 state.phase='awaiting-end-turn';runEffects(state,random);
}
