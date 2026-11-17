import {BOARD} from './board.js';
import {CHANCE,COMMUNITY} from './cards.js';
import type {GameState,GameAction,PlayerConfig,PlayerId,RandomSource,ActionResult} from './types.js';
import {dice,roll} from './movement.js';
import {playerById,requireRule,RuleViolation} from './rules.js';
import {settlePayment} from './economy.js';
function shuffled(ids:string[],random:RandomSource){
 for(let i=ids.length-1;i>0;i--){const j=random.int(0,i);requireRule(Number.isInteger(j)&&j>=0&&j<=i,'INVALID_GAME');[ids[i],ids[j]]=[ids[j]!,ids[i]!];}return ids;
}
export function createGame(config:{gameId:string;players:PlayerConfig[]},random:RandomSource):GameState {
 const {players,gameId}=config;
 requireRule(gameId.length>0&&gameId.length<=64,'INVALID_GAME');
 requireRule(players.length>=2&&players.length<=6&&new Set(players.map(p=>p.id)).size===players.length&&new Set(players.map(p=>p.token)).size===players.length,'INVALID_GAME');
 requireRule(players.every(p=>p.id.length>0&&p.name.trim().length>0&&p.name.trim().length<=20),'INVALID_GAME');
 let candidates=players.map(p=>p.id);
 // A faulty random provider must not hang the application forever when selecting a starter.
 for(let attempts=0;candidates.length>1;attempts++){
  requireRule(attempts<100,'INVALID_GAME');const rolls=candidates.map(id=>({id,total:dice(random).reduce((a,b)=>a+b,0)}));const best=Math.max(...rolls.map(r=>r.total));candidates=rolls.filter(r=>r.total===best).map(r=>r.id);
 }
 return {gameId,rulesVersion:'classic-v1',revision:0,players:players.map(p=>({...p,name:p.name.trim(),cash:1500,position:0,bankrupt:false,jail:null,jailCards:[]})),board:BOARD.map(()=>({owner:null,buildings:0,mortgaged:false})),turn:{playerId:candidates[0]!,doubles:0,dice:null,extraRoll:false,number:1},phase:'awaiting-roll',decks:{chance:shuffled(CHANCE.map(c=>c.id),random),community:shuffled(COMMUNITY.map(c=>c.id),random)},bank:{houses:32,hotels:12},purchase:null,auction:null,debt:null,pendingEffects:[],mortgageTransfers:[],trades:[],recentEvents:[],winner:null};
}
export function applyAction(input:GameState,actor:PlayerId,action:GameAction,random:RandomSource):ActionResult {
 const state=structuredClone(input);const previousEvent=input.recentEvents.at(-1)?.id??0;
 try{
  const player=playerById(state,actor);requireRule(!player.bankrupt,'NOT_AUTHORIZED');requireRule(state.phase!=='finished');
  switch(action.type){
   case 'roll':roll(state,actor,random);break;
   case 'pay-jail':
    requireRule(state.turn.playerId===actor,'NOT_AUTHORIZED');requireRule(state.phase==='jail-choice'&&player.jail);requireRule(player.cash>=50,'INSUFFICIENT_FUNDS');
    settlePayment(state,actor,'bank',50);player.jail=null;state.phase='awaiting-roll';break;
   case 'use-jail-card':{
    requireRule(state.turn.playerId===actor,'NOT_AUTHORIZED');requireRule(state.phase==='jail-choice'&&player.jail);
    const index=player.jailCards.indexOf(action.cardId);requireRule(index>=0);player.jailCards.splice(index,1);
    (action.cardId.startsWith('chance-')?state.decks.chance:state.decks.community).push(action.cardId);player.jail=null;state.phase='awaiting-roll';break;
   }
   case 'end-turn':{
    requireRule(state.turn.playerId===actor,'NOT_AUTHORIZED');requireRule(state.phase==='awaiting-end-turn');
    const index=state.players.findIndex(p=>p.id===actor);let next=index;
    do{next=(next+1)%state.players.length;}while(state.players[next]!.bankrupt);
    const target=state.players[next]!;state.turn={playerId:target.id,doubles:0,dice:null,extraRoll:false,number:state.turn.number+1};state.phase=target.jail?'jail-choice':'awaiting-roll';break;
   }
   default:requireRule(false);
  }
  state.revision++;return {ok:true,state,events:state.recentEvents.filter(e=>e.id>previousEvent)};
 }catch(error){if(error instanceof RuleViolation)return {ok:false,code:error.code};throw error;}
}
