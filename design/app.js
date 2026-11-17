'use strict';
// shortcut: thao tác game và kết nối chỉ là dữ liệu mẫu, thay bằng lõi luật và transport khi triển khai sản phẩm.
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const tokens = {car:'🚙',cat:'🐈',hat:'🎩',ship:'⛵'};
const state = {mode:'offline',platform:'web',roomAction:'create',token:'car',name:'Bạn',balance:1500,position:0,rolls:0,owned:false};
const labels = {home:'Khám phá',setup:'Chọn chế độ',lobby:'Phòng chờ',game:'Bàn chơi'};
let toastTimeout;
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { $('#toast').hidden = true; }, 4200);
}
function showScreen(name) {
  clearTimeout(toastTimeout); $('#toast').hidden=true;
  if (!Object.hasOwn(labels,name)) name='home';
  $$('[data-screen]').forEach(el => { el.hidden = el.dataset.screen !== name; });
  $('#page-label').textContent=labels[name];
  $$('[data-go]').forEach(el => el.classList.toggle('active',el.dataset.go===(name==='home'?'home':'setup')));
  history.replaceState(null,'','#'+name);
  $('#main').focus({preventScroll:true});
  window.scrollTo({top:0,behavior:'instant'});
}
function updateSetup() {
  $$('[data-mode]').forEach(el => {
    const selected = el.dataset.mode===state.mode;
    el.classList.toggle('selected',selected); el.setAttribute('aria-pressed',String(selected));
  });
  for (const mode of ['offline','online','bluetooth']) $('#'+mode+'-options').hidden=mode!==state.mode;
  const bluetoothWeb=state.mode==='bluetooth' && state.platform==='web';
  $('#setup-title').textContent={offline:'Chuẩn bị ván của bạn',online:'Hẹn nhau ở bàn chơi',bluetooth:'Một bàn chơi ở gần'}[state.mode];
  $('#setup-description').textContent={offline:'Chọn quân cờ, rồi để máy vào bàn cùng bạn.',online:'Tạo phòng riêng hoặc nhập mã từ bạn bè.',bluetooth:'Chơi cùng nhau, không cần internet.'}[state.mode];
  $('#setup-submit').disabled=bluetoothWeb;
  $('#setup-submit').firstChild.textContent=bluetoothWeb?'Cần ứng dụng Android hoặc iOS ':state.mode==='offline'?'Bắt đầu ván mẫu ':state.mode==='online'&&state.roomAction==='join'?'Vào phòng mẫu ':'Tạo phòng mẫu ';
  $('#bt-title').textContent=state.platform==='web'?'Chơi gần nhau trên mobile':'Kết nối Bluetooth trên '+(state.platform==='ios'?'iOS':'Android');
  $('#bt-description').textContent=state.platform==='web'?'Mở ứng dụng Nhà Chơi trên Android hoặc iOS để kết nối Bluetooth. Bản web hỗ trợ online và chơi với máy.':'Bật Bluetooth và cho phép truy cập thiết bị ở gần khi ứng dụng yêu cầu. Bạn đang xem mô phỏng, chưa có kết nối thật.';
  $('#bt-mode-caption').textContent=state.platform==='web'?'Bluetooth · Cần ứng dụng mobile':'Bluetooth · Không cần internet';
  $('#room-code-field').hidden=state.roomAction!=='join';
  $('#room-code').required=state.mode==='online'&&state.roomAction==='join';
  $('#room-code').pattern=state.mode==='online'&&state.roomAction==='join'?'[A-Za-z0-9]{6}':'.*';
}
function addActivity(title,description) {
  const li=document.createElement('li');
  const dot=document.createElement('span'); dot.className='activity-dot';
  const p=document.createElement('p'); p.textContent=title;
  const small=document.createElement('small'); small.textContent=description;
  p.append(small);li.append(dot,p);$('#activity-list').prepend(li);
}
function renderPlayers() {
  const opponents=state.mode==='offline'?Number($('#bot-count').value):3;
  $('#players-count').textContent=(opponents+1)+' người';
  $('#player-list').replaceChildren();
  const colors=['mint','lavender','yellow','mint','lavender','yellow'];
  const sampleNames=['Bạn','Minh','Linh','Nam','An','Hà'];
  for (let i=0;i<=opponents;i++) {
    const row=document.createElement('div');row.className='player-row';
    const avatar=document.createElement('span');avatar.className='player-avatar '+colors[i];avatar.textContent=i===0?tokens[state.token]:['🎩','🐈','⛵','🚙','🎩'][i-1];
    const info=document.createElement('div');const name=document.createElement('strong');name.textContent=i===0?state.name:state.mode==='offline'?'Máy '+i:sampleNames[i];
    const detail=document.createElement('small');detail.textContent=i===0?'Bạn · '+(state.owned?'1 tài sản':'Chưa có tài sản'):state.mode==='offline'?'Đối thủ máy mẫu':'Người chơi mẫu';
    info.append(name,detail);const balance=document.createElement('b');balance.textContent=(i===0?state.balance:1500).toLocaleString('en-US').replaceAll(',','.');
    row.append(avatar,info,balance);$('#player-list').append(row);
  }
}
function startGame() {
  Object.assign(state,{balance:1500,position:0,rolls:0,owned:false});
  $('#balance').textContent='1.500';$('#turn-name').textContent=state.name;$('#turn-token').textContent=tokens[state.token];
  $('#game-mode-label').textContent={offline:'Đấu máy',online:'Online mẫu',bluetooth:'Bluetooth mẫu'}[state.mode];
  $('#activity-list').replaceChildren();addActivity('Ván mẫu đã sẵn sàng.','Những con phố đang chờ chủ nhân.');
  $('#die-a').textContent='⚂';$('#die-b').textContent='⚂';renderPlayers();movePawn(0);showScreen('game');
}
function renderLobby() {
  $('#lobby-mode-label').textContent=state.mode==='bluetooth'?'Phòng Bluetooth mẫu':'Phòng online mẫu';
  const seats=[{name:state.name,token:tokens[state.token],color:'mint'}, {name:'Minh',token:'🎩',color:'lavender'}, {name:'Linh',token:'🐈',color:'yellow'},{name:'Nam',token:'⛵',color:'mint'}];
  $('#seat-grid').replaceChildren();
  seats.forEach((data,index)=>{
    const seat=document.createElement('div');seat.className='seat';
    if(index===0){const label=document.createElement('span');label.className='seat-host';label.textContent='Chủ phòng';seat.append(label);}
    const avatar=document.createElement('span');avatar.className='player-avatar '+data.color;avatar.textContent=data.token;
    const name=document.createElement('strong');name.textContent=data.name;
    const tag=document.createElement('span');tag.className='tag green';tag.textContent='✓ Sẵn sàng mẫu';seat.append(avatar,name,tag);$('#seat-grid').append(seat);
  });showScreen('lobby');
}
const spaces=[
['Xuất phát','','↗'],['Phố Hàng Đào',60,'#b4957e'],['Khí vận','','✦'],['Phố Hàng Bạc',60,'#b4957e'],['Thuế thu nhập',200,'₫'],['Ga Hà Nội',200,'♜'],['Phố Hàng Buồm',100,'#9cc7c5'],['Cơ hội','','?'],['Phố Hàng Mã',100,'#9cc7c5'],['Phố Hàng Gai',120,'#9cc7c5'],['Nhà tù','','▦'],['Phố Tràng Tiền',140,'#c194b7'],['Điện lực',150,'ϟ'],['Phố Đinh Lễ',140,'#c194b7'],['Phố Ngô Quyền',160,'#c194b7'],['Ga Huế',200,'♜'],['Phố Bạch Đằng',180,'#e6b47c'],['Khí vận','','✦'],['Phố Trần Phú',180,'#e6b47c'],['Phố Chùa Cầu',200,'#e6b47c'],['Đỗ xe miễn phí','','P'],['Phố Lê Lợi',220,'#ce8d80'],['Cơ hội','','?'],['Phố Hai Bà Trưng',220,'#ce8d80'],['Phố Nguyễn Huệ',240,'#ce8d80'],['Ga Đà Nẵng',200,'♜'],['Phố Đồng Khởi',260,'#e5ce79'],['Phố Lê Duẩn',260,'#e5ce79'],['Cấp nước',150,'≈'],['Phố Nam Kỳ',280,'#e5ce79'],['Vào tù','','↙'],['Phố Hồ Tây',300,'#83ad87'],['Phố Thanh Niên',300,'#83ad87'],['Khí vận','','✦'],['Phố Quảng An',320,'#83ad87'],['Ga Sài Gòn',200,'♜'],['Cơ hội','','?'],['Phố Thảo Điền',350,'#8b9bb8'],['Thuế tài sản',100,'₫'],['Phố Phú Mỹ',400,'#8b9bb8']
];
function boardPosition(index,size) {
  const edge=size-1;
  if(index<=edge)return [size,size-index];
  if(index<=edge*2)return [size-(index-edge),1];
  if(index<=edge*3)return [1,1+index-edge*2];
  return [1+index-edge*3,size];
}
function setLocationPhoto(figure,index) {
  const photo=locationPhotos[index];
  figure.hidden=!photo;
  const image=figure.querySelector('img');
  if(!photo){image.removeAttribute('src');image.alt='';return;}
  image.src=photo.src;image.alt=photo.caption;
  figure.querySelector('.photo-caption').textContent=photo.caption;
  const credit=figure.querySelector('.photo-attribution');
  credit.replaceChildren(document.createTextNode('Ảnh: '+photo.author+' · '));
  const source=document.createElement('a');source.href=photo.source;source.textContent='Wikimedia Commons';source.target='_blank';source.rel='noopener noreferrer';
  const license=document.createElement('a');license.href=photo.licenseUrl;license.textContent=photo.license;license.target='_blank';license.rel='noopener noreferrer';
  credit.append(source,document.createTextNode(' · '),license);
}
function showLocation(index) {
  const [name,price]=spaces[index];
  $('#tile-name').textContent=name;
  $('#tile-description').textContent=price?'Giá niêm yết trong ván mẫu: '+price+'.':'Ô đặc biệt trên bàn Cờ tỷ phú.';
  setLocationPhoto($('#tile-figure'),index);
  $('#tile-details').showModal();
}
function drawBoards() {
  spaces.forEach(([name,price,strip],index)=>{
    const cell=document.createElement('button');cell.type='button';cell.className='board-cell';
    cell.setAttribute('aria-label',name+(price?' · '+price:''));
    cell.addEventListener('click',()=>showLocation(index));
    cell.dataset.space=index;
    const [row,col]=boardPosition(index,11);cell.style.gridArea=row+'/'+col;
    const photo=locationPhotos[index];
    const isColor=strip.startsWith('#');
    if(isColor)cell.style.setProperty('--strip',strip);
    else if(!photo){cell.classList.add('special');const symbol=document.createElement('span');symbol.className='cell-symbol';symbol.textContent=strip;symbol.setAttribute('aria-hidden','true');cell.append(symbol);}
    if(photo){
      cell.classList.add('has-photo');
      const image=document.createElement('img');image.className='location-thumbnail';image.src=photo.src;image.alt='';image.draggable=false;cell.append(image);
    }
    const title=document.createElement('span');title.className='cell-name';title.textContent=name;cell.append(title);
    if(price){const value=document.createElement('span');value.className='cell-price';value.textContent=price;cell.append(value);}
    $('#game-board').append(cell);
  });
  const strips=['#d3aa79','#99bfa5','#d6c581','#b3a1bf','#9bbebc'];
  for(let index=0;index<32;index++) {
    const cell=document.createElement('div');cell.className='art-cell';const [row,col]=boardPosition(index,9);cell.style.gridArea=row+'/'+col;cell.style.setProperty('--strip',strips[Math.floor(index/3)%strips.length]);$('#art-board').append(cell);
  }
}
function movePawn(position) {
  $$('.board-cell').forEach(cell=>cell.classList.remove('current'));
  $('.cell-pawn')?.remove();const cell=$('[data-space="'+position+'"]');cell.classList.add('current');
  const pawn=document.createElement('span');pawn.className='cell-pawn';pawn.textContent=tokens[state.token];pawn.setAttribute('aria-label','Quân cờ của bạn');cell.append(pawn);state.position=position;
}
$$('[data-go]').forEach(el=>el.addEventListener('click',()=>showScreen(el.dataset.go)));
$('.brand').addEventListener('click',event=>{event.preventDefault();showScreen('home');});
$$('[data-rules]').forEach(el=>el.addEventListener('click',()=>$('#rules-dialog').showModal()));
$$('[data-close]').forEach(el=>el.addEventListener('click',()=>$('#'+el.dataset.close).close()));
$$('[data-mode]').forEach(el=>el.addEventListener('click',()=>{state.mode=el.dataset.mode;updateSetup();}));
$$('[data-token]').forEach(el=>el.addEventListener('click',()=>{state.token=el.dataset.token;$$('[data-token]').forEach(btn=>{const selected=btn===el;btn.classList.toggle('selected',selected);btn.setAttribute('aria-pressed',String(selected));});}));
$('#platform').addEventListener('change',event=>{state.platform=event.target.value;updateSetup();});
$$('[data-room-action]').forEach(el=>el.addEventListener('click',()=>{state.roomAction=el.dataset.roomAction;$$('[data-room-action]').forEach(btn=>{const selected=btn===el;btn.classList.toggle('selected',selected);btn.setAttribute('aria-pressed',String(selected));});$('#room-code-error').hidden=true;updateSetup();}));
$('#room-code').addEventListener('invalid',()=>{$('#room-code-error').hidden=false;$('#room-code').setAttribute('aria-invalid','true');});
$('#room-code').addEventListener('input',()=>{$('#room-code-error').hidden=true;$('#room-code').removeAttribute('aria-invalid');});
$('#player-name').addEventListener('input',()=>$('#player-name').setCustomValidity(''));
$('#setup-form').addEventListener('submit',event=>{
  event.preventDefault();
  const name=$('#player-name').value.trim();
  if(!name){$('#player-name').setCustomValidity('Nhập tên của bạn để tiếp tục.');$('#player-name').reportValidity();return;}
  state.name=name;
  if(state.mode==='bluetooth'&&state.platform==='web')return;
  if(state.mode==='offline')startGame();else renderLobby();
});
$('#start-lobby').addEventListener('click',startGame);
$('#copy-code').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText('NHA246');toast('Đã sao chép mã minh họa NHA246. Mã này không tạo phòng thật.');}
  catch{toast('Mã phòng minh họa: NHA246. Bạn có thể chọn và sao chép mã này.');}
});
$('#roll-dice').addEventListener('click',()=>{
  state.rolls++;
  if(state.rolls===1){$('#die-a').textContent='⚂';$('#die-b').textContent='⚂';movePawn(6);addActivity(state.name+' gieo được 6.','Đã đến Phố Hàng Buồm.');$('#property-dialog').showModal();}
  else{$('#die-a').textContent='⚁';$('#die-b').textContent='⚀';movePawn((state.position+3)%40);addActivity(state.name+' gieo được 3.','Đang minh họa di chuyển trên bàn cờ.');toast('Đây là lượt minh họa giao diện. Chưa có bot hoặc bộ xử lý luật thật.');}
});
$('#buy-property').addEventListener('click',()=>{
  if(!state.owned){state.balance-=100;state.owned=true;$('#balance').textContent=state.balance.toLocaleString('en-US').replaceAll(',','.');renderPlayers();addActivity(state.name+' mua Phố Hàng Buồm.','Chi 100 · Số dư 1.400.');}
  $('#property-dialog').close();toast('Đã minh họa mua đất. Tài sản này chỉ tồn tại trong bản mẫu.');
});
$('#auction-property').addEventListener('click',()=>{
  $('#property-dialog').close();$('#auction-dialog').showModal();
});
$('#place-bid').addEventListener('click',()=>{const amount=Number($('#bid-amount').value);if(!$('#bid-amount').reportValidity())return;$('#current-bid').textContent=String(amount);toast('Đã xem trạng thái trả giá mẫu. Không có giao dịch hoặc người chơi thật.');});
setLocationPhoto($('#property-figure'),6);setLocationPhoto($('#auction-figure'),6);
drawBoards();updateSetup();renderPlayers();movePawn(0);
function routeFromHash(){const initial=location.hash.slice(1);if(initial==='game')startGame();else if(initial==='lobby')renderLobby();else showScreen(initial||'home');}
window.addEventListener('hashchange',routeFromHash);routeFromHash();
