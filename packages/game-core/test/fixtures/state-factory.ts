import { BOARD, CHANCE, COMMUNITY } from '../../src/index.js';
import type { GameState, PlayerConfig } from '../../src/index.js';
export const players:PlayerConfig[]=[{id:'p1',name:'Bạn',token:'car',kind:'human'},{id:'p2',name:'Máy 1',token:'cat',kind:'bot'}];
export function makeState():GameState {
  return {gameId:'game-1',rulesVersion:'classic-v1',revision:0,players:players.map(p=>({...p,cash:1500,position:0,bankrupt:false,jail:null,jailCards:[]})),board:BOARD.map(()=>({owner:null,buildings:0,mortgaged:false})),turn:{playerId:'p1',doubles:0,dice:null,extraRoll:false,number:1},phase:'awaiting-roll',decks:{chance:CHANCE.map(c=>c.id),community:COMMUNITY.map(c=>c.id)},bank:{houses:32,hotels:12},purchase:null,auction:null,debt:null,pendingEffects:[],mortgageTransfers:[],trades:[],recentEvents:[],winner:null};
}
