import type { RandomSource } from '../../src/index.js';
export function randomTape(values:number[]):RandomSource {
  let index=0;
  return {int(min,max){const value=values[index++];if(value===undefined)throw new Error('Random tape exhausted');if(value<min||value>max)throw new Error(`Random value ${value} outside ${min}..${max}`);return value;}};
}
export function seededRandom(seed:number):RandomSource {
  let next=seed>>>0;
  return {int(min,max){next=(Math.imul(1664525,next)+1013904223)>>>0;return min+next%(max-min+1);}};
}
