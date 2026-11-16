
function drawHistoricalOdds(){
 const canvas=$('sexChart');
 if(!historicalOdds?.points?.length){canvas.innerHTML='<path d="M0 70H500" stroke="#2a3c59" stroke-dasharray="4 6"/>';return}
 const pts=historicalOdds.points.filter(p=>Number.isFinite(+p.at)&&Number.isFinite(+p.boy));
 if(pts.length<2)return;
 const [start,end]=hourlyBounds(),span=end-start+3600000;
 const x=ms=>10+480*(ms-start)/span,y=p=>140-130*Math.min(1,Math.max(0,p));
 const line=arr=>arr.map(pt=>x(pt.at).toFixed(2)+','+y(pt.boy).toFixed(2)).join(' ');
 let parts='<path d="M0 70H500 M0 5H500 M0 135H500" stroke="#2a3c59" stroke-dasharray="4 6" fill="none"/>';
 parts+='<polyline points="'+line(pts)+'" fill="none" stroke="#64a1ff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" pointer-events="none"/>';
 parts+='<polyline points="'+line(pts.map(pt=>({...pt,boy:1-pt.boy})))+'" fill="none" stroke="#e58ac4" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" pointer-events="none"/>';
 // Transparent interaction layer: inspect any hour without adding price dots.
 parts+='<rect x="0" y="0" width="500" height="150" fill="transparent" aria-hidden="true"/>';
 if(selectedHour!==null)parts+='<path d="M'+x(selectedHour+1800000).toFixed(2)+' 4V140" stroke="#f5f8ff" stroke-dasharray="4 3" stroke-width="2" pointer-events="none"/>';
 canvas.innerHTML=parts;
 canvas.onclick=event=>chartHourAtEvent(event,canvas);
 selectedHourSummary();
 $('historyFirst').textContent=historicalTime(start);
 $('historyLast').textContent='Now · '+historicalTime(end);
}
async function fetchHistoricalOdds(){
 if(!state.current||historyBusy)return;
 historyBusy=true;
 try{
  const res=await fetch('/api/odds-history',{cache:'no-store'});
  if(!res.ok)throw Error('Failed');
  const d=await res.json();
  if(!Array.isArray(d.points))throw Error('Invalid history');
  historicalOdds=d;drawHistoricalOdds();drawSexVolume();
 }catch(e){console.warn('Price history temporarily unavailable',e)}
 finally{historyBusy=false}
}
function settlementPortfolio(u,sim){
 const sexShares=Number(u.sex?.[sim.sex]||0);
 const datePayout=(u.date||[]).reduce((total,n,i)=>total+(sim.birth<=dates[i]?Number(n||0):0),0);
 const afterPayout=(u.dateAfter||[]).reduce((total,n,i)=>total+(sim.birth>=dates[i]?Number(n||0):0),0);const exactPayout=(u.dateExact||[]).reduce((total,n,i)=>total+(sim.birth===dates[i]?Number(n||0):0),0);return Number(u.cash||0)+sexShares+datePayout+afterPayout+exactPayout;
}
function populateSettlementDates(){
 const select=$('simBirthday');
 const choices=[];
 const start=Date.UTC(2026,11,1),end=Date.UTC(2027,2,31);
 for(let ms=start;ms<=end;ms+=86400000){
  const date=new Date(ms),value=date.toISOString().slice(0,10);
  const display=date.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
  choices.push('<option value="'+value+'">'+display+'</option>');
 }
 select.innerHTML=choices.join('');
 select.value='2027-01-27';
}
function simulateSettlement(){
 const sex=Number($('simSex').value),birth=$('simBirthday').value;
 if(![0,1].includes(sex)||!/^\d{4}-\d{2}-\d{2}$/.test(birth)||Number.isNaN(Date.parse(birth+'T12:00:00Z'))){
  $('simStatus').textContent='Choose a valid sex and birth date to simulate.';
  return;
 }
 settlementPreview={sex,birth};
 render();
}
function resetSettlement(){
 settlementPreview=null;
 render();
}
let leaderboardSort='sp',leaderboardLimit=5;
function setLeaderboardSort(sort){if(!['sp','joined'].includes(sort))return;leaderboardSort=sort;leaderboardLimit=5;render()}
function showMoreLeaders(){leaderboardLimit+=5;render()}
function render(){if(!user())return;const sim=settlementPreview,value=u=>sim?settlementPortfolio(u,sim):portfolio(u);let sp=softmax(state.sexQ),p=datePrice(cutoff,dateContractType);$('account').textContent=user().name+' · '+spExact(value(user()));$('account').setAttribute('aria-label','View your trade history · '+user().name+' · '+(sim?'Simulated ':'')+spExact(value(user())));$('greeting').textContent=user().name;$('portfolioRelationship').textContent=user().relationship;$('cash').textContent=spExact(user().cash);$('netWorth').textContent=spExact(value(user()));$('portfolioMode').textContent=sim?'PORTFOLIO · SIMULATED':'PORTFOLIO';$('boyOdds').textContent=priceTag(sp[0]);$('girlOdds').textContent=priceTag(sp[1]);$('boyProbability').textContent=payoutRatio(sp[0]);$('girlProbability').textContent=payoutRatio(sp[1]);$('boy').classList.toggle('active',selectedSex==='Boy');$('girl').classList.toggle('active',selectedSex==='Girl');{const k=cutoff;$("dateExactDay").textContent=label(dates[k]);for(const [type,suffix] of [['before','Before'],['exact','Exact'],['after','After']]){const price=datePrice(k,type);$('datePrice'+suffix).textContent=priceTag(price);$('datePayout'+suffix).textContent=payoutRatio(price)}}for(const [type,id] of [['before','dateTypeBefore'],['exact','dateTypeExact'],['after','dateTypeAfter']]){$(id).classList.toggle('active',dateContractType===type);$(id).setAttribute('aria-pressed',String(dateContractType===type))}renderWagerTotals();$('cutoff').value=cutoff;
drawHistoricalOdds();drawDateDots();drawDateVolume();drawSexVolume();
$('leaderboardMode').textContent=sim?'SIMULATED FINAL VALUE':'TOTAL VALUE';
$('simRun').textContent=sim?'Update preview':'Simulate';
$('simReset').classList.toggle('hidden',!sim);
$('simStatus').textContent=sim?('Simulated '+(sim.sex===0?'boy':'girl')+' born '+label(sim.birth)+'. Winning shares pay §1; live balances stay unchanged.'):'Preview only. No trades, holdings, or balances will change.';
let entries=Object.entries(state.users).map(([id,u])=>({...u,id})).sort((a,b)=>leaderboardSort==='joined'?(Date.parse(b.joinedAt||0)||0)-(Date.parse(a.joinedAt||0)||0)||String(a.name).localeCompare(String(b.name)):value(b)-value(a)||String(a.name).localeCompare(String(b.name)));
$('leaderSortSP').classList.toggle('active',leaderboardSort==='sp');$('leaderSortJoined').classList.toggle('active',leaderboardSort==='joined');
$('leaderMore').classList.toggle('hidden',entries.length<=leaderboardLimit);
$('leaderboard').innerHTML=entries.length?entries.slice(0,leaderboardLimit).map((u,i)=>{
 const title=(i+1)+'. '+participantName(u.name,u.relationship);
 return '<button type="button" class="leader-button leader-card market-entry" title="View trade history" onclick="openUserTrades(\''+u.id+'\')">'
 +'<div class="market-entry-heading"><span class="market-entry-name">'+title+'</span><span class="market-entry-value">'+spExact(value(u))+'</span></div>'
 +'<div class="leader-compact-detail"><div class="position-list">'+renderHoldingRows(u,acquisitionCosts[u.id],sim)+'</div>'
 +'<div class="holding-compact unspent-bottom"><span class="holding-compact-label">Unspent</span><strong class="holding-compact-value">'+spExact(u.cash)+'</strong></div></div></button>';
}).join(''):'<div class="sub">No players yet. Be the first to join.</div>';
$('positions').innerHTML='<div class="position-list">'+renderHoldingRows(user(),acquisitionCosts[state.current],sim,true)+'</div>';
}
function delta(q,indices,shares){return SipePricing.delta(q,indices,shares,marketLiquidity())}function indicesFor(){if(tradeMarket==='sex')return [Number($('tradeOutcome').value)];const k=Number($('tradeOutcome').value);if(tradeContractType==='exact')return [k];if(tradeContractType==='after')return Array.from({length:state.dateQ.length-k},(_,i)=>i+k);return Array.from({length:k+1},(_,i)=>i)}function quoteShares(amount){let q=tradeMarket==='sex'?state.sexQ:state.dateQ,ix=indicesFor(),sign=tradeMode==='buy'?1:-1;let available=selectedTradeHoldings();if(tradeMode==='sell')return {shares:Math.min(amount,available),value:-delta(q,ix,-Math.min(amount,available))};let lo=0,hi=1;while(delta(q,ix,hi)<amount&&hi<1e7)hi*=2;for(let j=0;j<45;j++){let mid=(lo+hi)/2;if(delta(q,ix,mid)>amount)hi=mid;else lo=mid}return {shares:lo,value:delta(q,ix,lo)}}

function sellPositions(){if(!user())return [];const u=user(),result=[];for(let i=0;i<2;i++)if(Number(u.sex?.[i])>1e-7)result.push({market:'sex',type:'sex',index:i,label:i===0?'Boy':'Girl'});for(const [type,key] of [['before','date'],['exact','dateExact'],['after','dateAfter']])for(let i=0;i<(u[key]?.length||0);i++)if(Number(u[key][i])>1e-7)result.push({market:'date',type,index:i,label:dateTypeLabel(type)+' '+label(dates[i])});return result}
function availableSellTypes(){return new Set(sellPositions().filter(p=>p.market==='date').map(p=>p.type))}
function openTrade(m,mode){
 tradeMarket=m;tradeMode=mode;tradeContractType=dateContractType;sellMaxFullShares=null;$('tradeOverlay').classList.remove('hidden');$('tradeSexChoices').classList.toggle('hidden',m!=='sex');$('tradeDateChoices').classList.toggle('hidden',m!=='date');$('tradeOutcome').classList.toggle('hidden',m==='sex');
 $('tradeTitle').textContent=m==='sex'?'Baby boy or girl?':'When will Baby Sipe arrive?';$('tradeOutcome').closest('.field').querySelector('label').textContent=m==='date'?'Date':'Outcome';
 if(m==='sex'){$('tradeOutcome').innerHTML='<option value="">Choose Boy or Girl</option><option value="0">Boy</option><option value="1">Girl</option>';$('tradeOutcome').value=selectedSex==='Boy'?'0':selectedSex==='Girl'?'1':''}else rebuildDateOutcomeOptions(cutoff);
 if(mode==='sell')selectFirstSellPosition();
 $('tradeAmount').value=mode==='buy'?'':(selectedTradeHoldings()?Math.min(10,selectedTradeHoldings()).toFixed(2):'');renderTrade();
}

function selectedPositionShares(p){const u=user();return Number((p.type==='sex'?u.sex:p.type==='before'?u.date:p.type==='exact'?u.dateExact:u.dateAfter)?.[p.index]||0)}
function selectFirstSellPosition(){if(tradeMode!=='sell')return;const positions=sellPositions().filter(p=>p.market===tradeMarket);if(!positions.length){$('tradeOutcome').value='';return}let chosen=positions.find(p=>p.type===tradeContractType&&String(p.index)===$('tradeOutcome').value)||positions[0];tradeContractType=chosen.type;if(tradeMarket==='date')rebuildDateOutcomeOptions(chosen.index);else $('tradeOutcome').value=String(chosen.index)}
function chooseTradeSex(index){
 if(tradeMarket!=='sex')return;
 sellMaxFullShares=null;
 $('tradeOutcome').value=String(index);
 selectedSex=index===0?'Boy':'Girl';
 renderTrade();
}
function selectedTradeHoldings(){
 if(!user()||$('tradeOutcome').value==='')return 0;
 const idx=Number($('tradeOutcome').value);
 const list=tradeMarket==='sex'?user().sex:tradeContractType==='after'?(user().dateAfter||[]):tradeContractType==='exact'?(user().dateExact||[]):user().date;
 return Math.max(0,Number(list[idx]||0));
}
function switchTradeMode(next){
 if(tradeMode===next)return;
 sellMaxFullShares=null;
 const previousOutcome=$('tradeOutcome').value;
 tradeMode=next;
 if(tradeMarket==='date')rebuildDateOutcomeOptions(previousOutcome);
 if(next==='sell')selectFirstSellPosition();
 $('tradeAmount').value=tradeMode==='buy'?'':(selectedTradeHoldings()>0?Math.min(10,selectedTradeHoldings()).toFixed(2):'');
 renderTrade();
}
function normalizeTradeAmount(){
 if(tradeMode==='sell'&&sellMaxFullShares!==null)return;
 const input=$('tradeAmount'),raw=input.value;
 if(raw.trim()==='')return;
 const amount=Number(raw);
 if(!Number.isFinite(amount))return;
 input.value=amount.toFixed(2);
 renderTrade();
}
function fillMaxTrade(){
 const max=tradeMode==='buy'?Math.max(0,Number(user()?.cash||0)):selectedTradeHoldings();
 sellMaxFullShares=tradeMode==='sell'&&max>0?max:null;
 const affordableMax=Math.floor((max+1e-9)*100)/100;
 $('tradeAmount').value=max>0?(tradeMode==='sell'?max.toFixed(2):(affordableMax>0?affordableMax.toFixed(2):'')):'';
 renderTrade();
}
function renderTrade(){
 if($('tradeOverlay').classList.contains('hidden')||!user())return;
 $('buyTab').classList.toggle('active',tradeMode==='buy');
 $('sellTab').classList.toggle('active',tradeMode==='sell');
 $('amountLabel').textContent=tradeMode==='buy'?'Spend (§)':'Sell shares';
 $('tradeBalance').textContent='Available: §'+Number(user().cash).toLocaleString('en-US',{maximumFractionDigits:3});
 const selected=$('tradeOutcome').value!=='';
 const index=selected?Number($('tradeOutcome').value):null;
 const held=selectedTradeHoldings(),available=Number(user().cash)||0;
 $('sellHoldingsRow').classList.remove('hidden');
 if(tradeMode==='sell'){
  const positions=sellPositions().filter(p=>p.market===tradeMarket);
  if(tradeMarket==='date'){
   const types=availableSellTypes();
   for(const [type,id] of [['before','tradeTypeBefore'],['exact','tradeTypeExact'],['after','tradeTypeAfter']])$(id).classList.toggle('hidden',!types.has(type));
  }else{
   $('tradeSexBoy').classList.toggle('hidden',!positions.some(p=>p.index===0));$('tradeSexGirl').classList.toggle('hidden',!positions.some(p=>p.index===1));
  }
  if(!positions.length)$('tradeOutcome').value='';
 }else{
  $('tradeSexBoy').classList.remove('hidden');$('tradeSexGirl').classList.remove('hidden');for(const id of ['tradeTypeBefore','tradeTypeExact','tradeTypeAfter'])$(id).classList.remove('hidden');
 }
 $('tradeHoldings').textContent=tradeMode==='buy'?'Max: '+'§'+available.toLocaleString('en-US',{maximumFractionDigits:3})+' available':selected?'Max: '+asShares(held)+' shares held':'Select an outcome to see shares held';
 $('sellMaxButton').textContent='Max';
 $('sellMaxButton').disabled=tradeMode==='buy'?available<=0:!selected||held<=0;
 if(tradeMarket==='date'){const k=index===null?cutoff:index;$("tradeExactDay").textContent=label(dates[k]);for(const [type,suffix] of [['before','Before'],['exact','Exact'],['after','After']]){const price=datePrice(k,type);$('tradePrice'+suffix).textContent=priceTag(price);$('tradePayout'+suffix).textContent=payoutRatio(price)}}if(tradeMarket==='date'){for(const [type,id] of [['before','tradeTypeBefore'],['after','tradeTypeAfter'],['exact','tradeTypeExact']]){$(id).classList.toggle('active',tradeContractType===type);$(id).setAttribute('aria-pressed',String(tradeContractType===type))}}
 if(tradeMarket==='sex'){
  const ps=softmax(state.sexQ),hold=user().sex||[0,0];
  for(let i=0;i<2;i++){
   const key=i===0?'tradeSexBoy':'tradeSexGirl',active=selected&&index===i;
   $(key).classList.toggle('active',active);
   $(key).setAttribute('aria-pressed',String(active));
   $(key+'Info').textContent=tradeMode==='buy'?priceTag(ps[i])+' per share':priceTag(ps[i])+' · '+asShares(hold[i])+' held';
  }
 }
 $('tradeAmount').max=tradeMode==='buy'?String(Math.max(0,available)):String(held);
 const raw=$('tradeAmount').value,amount=tradeMode==='sell'&&sellMaxFullShares!==null?sellMaxFullShares:Number(raw),valid=raw.trim()!==''&&Number.isFinite(amount)&&amount>0;
 const err=!selected?(tradeMode==='sell'?'No holdings available to sell.':'Choose an outcome first.'):tradeMode==='sell'&&held<=0?'You have no shares to sell for this outcome.':!valid?'Enter a positive amount.':tradeMode==='buy'&&amount>available+1e-8?'Not enough available balance.':tradeMode==='sell'&&amount>held+1e-7?'You cannot sell more shares than you hold.':'';
 const quote=!err?quoteShares(amount):null;
 $('tradeError').textContent=err;
 const avg=quote&&quote.shares>0?priceTag(Math.abs(quote.value)/quote.shares):'';
 $('quote').textContent=quote?(tradeMode==='buy'?'Estimated '+asShares(quote.shares)+' shares · '+'§'+Number(quote.value).toLocaleString('en-US',{maximumFractionDigits:3})+' cost · '+avg+' average':'Estimated '+asShares(quote.shares)+' shares sold · '+'§'+Number(quote.value).toLocaleString('en-US',{maximumFractionDigits:3})+' proceeds · '+avg+' average'):'';
 $('confirmTrade').disabled=!!err;
 $('confirmTrade').textContent=tradeMode==='buy'?'Buy':'Sell';
}
async function executeTrade(){
normalizeTradeAmount();renderTrade();if($('confirmTrade').disabled)return;
const btn=$('confirmTrade');btn.disabled=true;
try{
const special=tradeMarket==='date'&&tradeContractType!=='before';const res=await fetch(special?'/api/date-contract':'/api/market',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'trade',market:tradeMarket,contractType:tradeContractType,mode:tradeMode,outcome:Number($('tradeOutcome').value),amount:tradeMode==='sell'&&sellMaxFullShares!==null?sellMaxFullShares:Number($('tradeAmount').value)})});
const data=await res.json();if(!res.ok)throw Error(data.error||'Trade failed');
if(special){closeTrade();await refresh();await loadDateExtras();loadRecentTrades()}else{state=data;mergeExtraPositions();closeTrade();render();loadRecentTrades();fetchHistoricalOdds()}
}catch(e){$('tradeError').textContent=e.message}finally{btn.disabled=false}
}

let acquisitionCosts={};
let shownTradeUser=null;
let historyOffset=0,historyRecords=[];
const sharesFormat=n=>asShares(n);
function tradeWhen(date){
 const parsed=new Date(date);
 return Number.isNaN(parsed.getTime())?'':parsed.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
}
function tradeOutcomeLabel(t){if(t.market==='sex')return Number(t.outcome)===0?'Boy':'Girl';const d=label(dates[Number(t.outcome)]||'2027-02-11');return t.contractType==='after'?d+' or after':t.contractType==='exact'?d+' exactly':d+' or before'}