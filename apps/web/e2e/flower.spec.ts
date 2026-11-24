import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createFlowerGame, swapFlower, flowerHint } from "../../../packages/game-core/src/flower.js";
import type { FlowerGame } from "../../../packages/game-core/src/flower.js";
const KEY="nha-choi-flower-offline-v1";
const flower=(page:Page)=>page.locator('.flower-screen');
const cell=(page:Page,index:number)=>flower(page).locator(`[data-flower-cell="${index}"]`);
async function enter(page:Page){await page.goto('/');await page.getByRole('button',{name:'Chơi Vườn Hoa',exact:true}).click();}
async function quick(page:Page){await enter(page);await flower(page).getByRole('button',{name:'Chơi một ván',exact:true}).click();}
async function drag(page:Page,a:number,b:number){const from=await cell(page,a).boundingBox(),to=await cell(page,b).boundingBox();if(!from||!to)throw new Error('Missing tile');await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:8});await page.mouse.up();}
async function saved(page:Page):Promise<FlowerGame>{return page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).quick,KEY);}

test('flower swaps, rejects invalid moves and restores a completed turn while effects are running',async({page})=>{
  await quick(page);await expect(cell(page,48)).toBeVisible();
  await expect(flower(page).locator('.flower-board')).toHaveCSS('border-top-width','5px');
  await expect(flower(page).locator('.blossom.flower-yellow').first()).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  const before=await saved(page);let invalid:[number,number]|null=null;
  for(let a=0;a<49&&!invalid;a++)for(const b of [a+1,a+7])if(b<49&&!swapFlower(before,a,b)){if((a%7!==6&&b===a+1)||b===a+7){invalid=[a,b];break;}}
  expect(invalid).not.toBeNull();await drag(page,...invalid!);
  await expect(flower(page).getByRole('status').filter({hasText:'không mất lượt'})).toBeVisible();expect(await saved(page)).toEqual(before);
  await drag(page,16,23);await expect.poll(async()=> (await saved(page)).movesLeft).toBe(19);
  const accepted=await saved(page);expect(accepted.score).toBeGreaterThanOrEqual(90);
  await page.reload();await page.getByRole('button',{name:'Chơi Vườn Hoa',exact:true}).click();await flower(page).getByRole('button',{name:'Tiếp tục Chơi nhanh'}).click();
  await expect(flower(page).locator('.flower-moves')).toHaveText('19');expect((await saved(page)).board).toEqual(accepted.board);
  if(accepted.status==='playing'){await flower(page).getByRole('button',{name:'Gợi ý nước đi'}).click();await expect(flower(page).locator('.flower-cell.guide')).toHaveCount(2);}else await expect(flower(page).getByRole('heading',{name:'Khu vườn bừng nở!'})).toBeVisible();
});

test('flower campaign awards stars, unlocks the next level and preserves independent quick play',async({page})=>{
  const game={...createFlowerGame('journey',1),score:790};
  const quickGame=createFlowerGame('quick');
  await page.goto('/');await page.evaluate(({key,game,quickGame})=>localStorage.setItem(key,JSON.stringify({version:1,levels:Array.from({length:12},()=>({stars:0,score:0})),quick:quickGame,journey:game})),{key:KEY,game,quickGame});
  await page.reload();await page.getByRole('button',{name:'Chơi Vườn Hoa',exact:true}).click();await flower(page).getByRole('button',{name:'Tiếp tục Hành trình'}).click();
  await drag(page,16,23);await expect(flower(page).getByRole('heading',{name:'Khu vườn bừng nở!'})).toBeVisible({timeout:25000});
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).levels[0].stars,KEY)).toBe(3);
  expect((await saved(page)).movesLeft).toBe(20);
  await flower(page).getByRole('button',{name:'Chơi màn tiếp'}).click();await expect(flower(page).getByRole('heading',{name:'Một sắc hồng'})).toBeVisible();
  await flower(page).getByRole('button',{name:'Hành trình',exact:true}).click();await expect(flower(page).getByRole('button',{name:/Màn 2,/})).toBeEnabled();await expect(flower(page).getByRole('button',{name:/Màn 3,/})).toBeDisabled();
});

test('flower mobile swipes, keyboard swaps, offline PWA and responsive accessible screens',async({page,context,browserName})=>{
  await page.setViewportSize({width:375,height:950});await quick(page);
  await expect(page.getByText('Đã sẵn sàng chơi với máy khi offline.',{exact:false})).toBeVisible();
  await page.emulateMedia({reducedMotion:'reduce'});
  if(browserName==='chromium'){
    const client=await context.newCDPSession(page);const a=await cell(page,16).boundingBox(),b=await cell(page,23).boundingBox();if(!a||!b)throw new Error('Missing tile');
    const x=a.x+a.width/2,y=a.y+a.height/2,end=b.y+b.height/2;
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=6;i++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+(end-y)*i/6}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{await cell(page,16).focus();await page.keyboard.press('Shift+ArrowDown');}
  await expect.poll(async()=>(await saved(page)).movesLeft).toBe(19);
  if((await saved(page)).status==='playing')await expect(flower(page).getByRole('button',{name:'Gợi ý nước đi'})).toBeEnabled();else await expect(flower(page).getByRole('heading',{name:'Khu vườn bừng nở!'})).toBeVisible();
  for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.setViewportSize({width:375,height:950});
  const scan=await new AxeBuilder({page}).include('.flower-screen').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(scan.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))).toEqual([]);
  await page.reload();await context.setOffline(true);await page.reload();await page.getByRole('button',{name:'Chơi Vườn Hoa',exact:true}).click();await flower(page).getByRole('button',{name:'Tiếp tục Chơi nhanh'}).click();
  await expect(flower(page).locator('.flower-moves')).toHaveText('19');
  await page.screenshot({path:'test-results/flower-mobile.png',fullPage:true});
  await page.setViewportSize({width:1200,height:1000});await page.screenshot({path:'test-results/flower-desktop.png',fullPage:true});
});

test('flower rejects diagonal and long drags and consumes a tool only after release',async({page})=>{
  await quick(page);const before=await saved(page);
  await drag(page,16,24);await expect(flower(page).locator('.flower-cell.is-dragging')).toHaveCount(0);expect(await saved(page)).toEqual(before);
  await drag(page,16,30);expect(await saved(page)).toEqual(before);
  const campaign=createFlowerGame('journey',7);
  await page.evaluate(({key,campaign})=>localStorage.setItem(key,JSON.stringify({version:1,levels:Array.from({length:12},(_,i)=>({stars:i<6?3:0,score:i<6?3000:0})),quick:null,journey:campaign})),{key:KEY,campaign});
  await page.reload();await page.getByRole('button',{name:'Chơi Vườn Hoa',exact:true}).click();await flower(page).getByRole('button',{name:'Tiếp tục Hành trình'}).click();
  await flower(page).getByRole('button',{name:/^Xẻng/}).click();
  const rock=await cell(page,11).boundingBox();if(!rock)throw new Error('Missing rock');
  await page.mouse.move(rock.x+rock.width/2,rock.y+rock.height/2);await page.mouse.down();
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).journey.tools.shovel,KEY)).toBe(1);
  await page.mouse.move(rock.x-150,rock.y+150,{steps:5});await page.mouse.up();
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).journey.tools.shovel,KEY)).toBe(1);
  await flower(page).getByRole('button',{name:/^Xẻng/}).click();await cell(page,11).click();
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).journey.tools.shovel,KEY)).toBe(0);
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).journey.board[11].obstacle.hp,KEY)).toBe(1);
});

test('flower mode picker, map and results are accessible',async({page})=>{
  await enter(page);
  async function scan(){const result=await new AxeBuilder({page}).include('.flower-screen').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))).toEqual([]);}
  await scan();await flower(page).getByRole('button',{name:'Khám phá khu vườn'}).click();await scan();
  const game={...createFlowerGame('journey',1),score:790};
  const turn=swapFlower(game,16,23)!;
  await page.evaluate(({key,game,stars})=>localStorage.setItem(key,JSON.stringify({version:1,levels:Array.from({length:12},(_,i)=>({stars:i===0?stars:0,score:i===0?game.score:0})),quick:null,journey:game})),{key:KEY,game:turn.game,stars:3});
  await page.reload();await page.getByRole('button',{name:'Chơi Vườn Hoa',exact:true}).click();await flower(page).getByRole('button',{name:'Tiếp tục Hành trình'}).click();await scan();
});

test('flower simultaneous tab saves accept one writer and require explicit conflict resolution',async({page,context})=>{
  await enter(page);const second=await context.newPage();await enter(second);
  await page.evaluate(async()=>{
    const opening=indexedDB.open('nha-choi-flower-save-lock',1);
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{opening.onupgradeneeded=()=>opening.result.createObjectStore('mutex');opening.onsuccess=()=>resolve(opening.result);opening.onerror=()=>reject(opening.error);});
    const tx=db.transaction('mutex','readwrite'),store=tx.objectStore('mutex');let keep=true;
    function hold(){const request=store.get('lock');request.onsuccess=()=>{if(keep)hold();};}hold();
    (window as unknown as {releaseFlowerLock:()=>void}).releaseFlowerLock=()=>{keep=false;};
    tx.oncomplete=()=>db.close();
  });
  await Promise.all([flower(page).getByRole('button',{name:'Chơi một ván'}).click(),flower(second).getByRole('button',{name:'Chơi một ván'}).click()]);
  await expect(cell(page,48)).toBeVisible();await expect(cell(second,48)).toBeVisible();
  await page.evaluate(()=>(window as unknown as {releaseFlowerLock:()=>void}).releaseFlowerLock());
  await expect.poll(async()=>await page.getByText(/Bản lưu đã thay đổi ở trang khác/).count()+await second.getByText(/Bản lưu đã thay đổi ở trang khác/).count()).toBe(1);
  expect((await saved(page)).revision).toBe(0);
  const loser=await page.getByText(/Bản lưu đã thay đổi ở trang khác/).count()?page:second;
  await loser.getByRole('button',{name:'Tải bản lưu mới'}).click();await loser.getByRole('button',{name:'Tiếp tục Chơi nhanh'}).click();
  expect((await saved(loser)).board).toEqual((await saved(page)).board);
  await second.close();
});

test('mystery locks show distinct counters, block swaps and restore exactly after reload',async({page})=>{
  await enter(page);await flower(page).getByRole('button',{name:'Chơi Vườn khóa bí ẩn',exact:true}).click();
  const read=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).mystery as FlowerGame,KEY);
  await expect.poll(async()=>(await read())?.mode).toBe('mystery');
  const initial=await read();const locks=initial.board.flatMap((c,i)=>c.obstacle?[i]:[]);
  expect(locks.length).toBeGreaterThanOrEqual(4);expect(locks.length).toBeLessThanOrEqual(6);
  await expect(flower(page).locator('.flower-lock')).toHaveCount(locks.length);
  const blocked=locks[0]!;await cell(page,blocked).click({force:true});expect((await read()).revision).toBe(0);
  await drag(page,16,23);await expect.poll(async()=>(await read()).movesLeft).toBe(19);
  const next=await read();
  locks.filter(i=>initial.board[i]!.obstacle!.kind==='turn-lock').forEach(i=>expect(next.board[i]!.obstacle).toEqual({...initial.board[i]!.obstacle,hp:initial.board[i]!.obstacle!.hp-1}));
  await page.reload();await page.getByRole('button',{name:'Chơi Vườn Hoa',exact:true}).click();await flower(page).getByRole('button',{name:'Tiếp tục Vườn khóa bí ẩn'}).click();
  expect((await read()).board).toEqual(next.board);
  await page.setViewportSize({width:375,height:950});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const scan=await new AxeBuilder({page}).include('.flower-screen').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(scan.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))).toEqual([]);
  await page.screenshot({path:'test-results/flower-mystery-mobile.png',fullPage:true});
});

test('mystery turn locks open after a valid move and the revealed board remains playable',async({page})=>{
  const game=createFlowerGame('mystery',0,()=>0);game.movesLeft=19;game.revision=1;
  game.board.forEach(cell=>{if(cell.obstacle)cell.obstacle.hp=1;});
  await page.goto('/');await page.evaluate(({key,game})=>localStorage.setItem(key,JSON.stringify({version:1,levels:Array.from({length:12},()=>({stars:0,score:0})),quick:null,journey:null,mystery:game})),{key:KEY,game});
  await page.reload();await page.getByRole('button',{name:'Chơi Vườn Hoa',exact:true}).click();await flower(page).getByRole('button',{name:'Tiếp tục Vườn khóa bí ẩn'}).click();
  await expect(flower(page).locator('.flower-lock')).toHaveCount(4);
  await drag(page,16,23);
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).mystery.board.filter((c:{obstacle:unknown})=>c.obstacle).length,KEY)).toBe(0);
  await expect(flower(page).locator('.flower-lock')).toHaveCount(0);
  await expect(flower(page).getByRole('group',{name:'Bàn hoa 7 × 7'})).toHaveAttribute('aria-busy','false',{timeout:25000});
  const completed=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).mystery as FlowerGame,KEY);
  expect(flowerHint(completed.board)).not.toBeNull();
});
