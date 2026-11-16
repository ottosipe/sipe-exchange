
function tradeLine(t,singleUser=false){
 const buy=t.side==='buy',points=Number(t.points)||0,shares=Number(t.shares)||0;
 const person=state.users?.[t.userId],name=participantName(person?.name||t.name||'Player',person?.relationship);
 const top=(singleUser?'':'<span class="trade-name">'+name+'</span>')
   +'<span class="trade-side '+(buy?'buy':'sell')+'">'+(buy?'Buy':'Sell')+'</span>'
   +'<span class="trade-when">'+safe(tradeWhen(t.createdAt))+'</span>';
 const emoji=t.market==='sex'?(Number(t.outcome)===0?'💙':'🩷'):'📅';
 const avg=shares>0?points/shares:null;
 return '<div class="trade-line market-entry">'
  +'<div class="trade-top">'+top+'</div>'
  +'<div class="holding-compact trade-holding"><span class="holding-compact-label">'+positionSummary(emoji,tradeOutcomeLabel(t),shares,avg)+'</span>'
  +'<strong class="holding-compact-value">'+signedSP(buy?-points:points)+'</strong></div>'
  +'</div>';
}
const emptyVolume=()=>({buySP:0,sellSP:0,spTraded:0,buyShares:0,sellShares:0,sharesTraded:0,trades:0});
let wagers={sex:[emptyVolume(),emptyVolume()],date:Array.from({length:30},emptyVolume),totals:{sex:emptyVolume(),date:emptyVolume()}};
function formatSP(n){return '§'+Number(n||0).toLocaleString('en-US',{maximumFractionDigits:2})}
function volumeText(v){return formatSP(v?.spTraded)+' traded · '+asShares(v?.sharesTraded)+' shares traded'}
function sharesHeld(market,index){
 if(market==='sex')return Math.max(0,Number(state.sexQ?.[index])||0);
 return Object.values(state.users||{}).reduce((sum,u)=>sum+Math.max(0,Number(u.date?.[index])||0),0);
}
function holdingsTotal(kind){
 return Object.values(state.users||{}).reduce((sum,u)=>{
  const arr=kind==='sex'?u.sex:u.date;
  return sum+(Array.isArray(arr)?arr.reduce((total,n)=>total+Math.max(0,Number(n)||0),0):0);
 },0);
}
function paidTotal(kind){return Math.max(0,Number(wagers.totals?.[kind]?.buySP)||0)}
function summarySpentShares(sp,shares){return formatSP(sp)+' spent ('+asShares(shares)+' shares held)'}
function renderWagerTotals(){
 $('boySummary').textContent='🔵 Boy '+summarySpentShares(wagers.sex[0]?.buySP,sharesHeld('sex',0));
 $('girlSummary').textContent='🩷 Girl '+summarySpentShares(wagers.sex[1]?.buySP,sharesHeld('sex',1));
 const e=extraDateVolume(cutoff);const dateShares=dateContractType==='before'?sharesHeld('date',cutoff):extraSharesHeld(dateContractType,cutoff);const dateSpent=dateContractType==='before'?(wagers.date[cutoff]?.buySP||0):dateExtraTrades.filter(x=>x.contractType===dateContractType&&Number(x.outcome)===cutoff&&x.side==='buy').reduce((sum,x)=>sum+Number(x.points||0),0);$('dateSummary').textContent='📅 '+dateTypeLabel(dateContractType)+' '+label(dates[cutoff])+' · '+summarySpentShares(dateSpent,dateShares);
 $('sexMarketTotal').textContent='Market total: '+summarySpentShares(paidTotal('sex'),holdingsTotal('sex'));
 const extraBuy=dateExtraTrades.filter(t=>t.side==='buy').reduce((sum,t)=>sum+Number(t.points||0),0);const extraHeld=Object.values(state.users||{}).reduce((sum,u)=>sum+(u.dateAfter||[]).reduce((a,x)=>a+Number(x||0),0)+(u.dateExact||[]).reduce((a,x)=>a+Number(x||0),0),0);$('dateMarketTotal').textContent='Market total: '+summarySpentShares(paidTotal('date')+extraBuy,holdingsTotal('date')+extraHeld);
 $('marketEconomy').textContent='All markets: '+summarySpentShares(paidTotal('sex')+paidTotal('date')+extraBuy,holdingsTotal('sex')+holdingsTotal('date')+extraHeld);
 drawDateVolume();
}
async function loadWagerTotals(){
 if(!state.current)return;
 try{
  const res=await fetch('/api/volume',{cache:'no-store'});
  if(!res.ok)throw Error('Trade volume unavailable');
  const info=await res.json();
  if(!Array.isArray(info.sex)||info.sex.length!==2||!Array.isArray(info.date)||info.date.length!==30)throw Error('Invalid volume statistics');
  wagers=info;renderWagerTotals();loadSexVolumeHistory();loadAcquisitionCosts();
 }catch(e){console.warn('Could not refresh volume statistics',e)}
}
async function loadAcquisitionCosts(){
 if(!state.current)return;
 try{
  const r=await fetch('/api/acquisition-costs',{cache:'no-store'});
  if(!r.ok)throw Error('Cost basis unavailable');
  const result=await r.json();
  if(!result.users||typeof result.users!=='object')throw Error('Invalid basis response');
  acquisitionCosts=result.users;
  render();
 }catch(e){console.warn('Could not retrieve acquisition costs',e)}
}
function toggleRecentTrades(market){
 const panel=$(market+'Recent');
 if(!panel)return;
 const wrapper=panel.closest('.recent-dropdown');
 const button=wrapper?.querySelector('.recent-dropdown-trigger');
 if(!button)return;
 const opening=panel.hidden;
 panel.hidden=!opening;
 button.setAttribute('aria-expanded',String(opening));
 wrapper.classList.toggle('is-open',opening);
}
async function loadRecentTrades(){
 if(!state.current)return;
 try{
  const res=await fetch('/api/trades',{cache:'no-store'});
  if(!res.ok)throw Error('Trades unavailable');
  const data=await res.json();
  loadWagerTotals();
  for(const key of ['sex','date']){
   const entries=[...(data.trades||[]),...(key==='date'?dateExtraTrades:[])].filter(t=>t.market===key).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,12);
   $(key+'Recent').innerHTML=entries.length?entries.map(t=>tradeLine(t,false)).join(''):'<div class="sub" style="padding:10px 0">No trades yet. Be the first!</div>';
  }
 }catch(e){
  for(const key of ['sex','date'])$(key+'Recent').innerHTML='<div class="sub">Recent trades unavailable.</div>';
 }
}
function openUserTrades(id){
 if(!state.users[id])return;
 shownTradeUser=id;historyOffset=0;historyRecords=[];
 $('historyName').textContent=state.users[id].name;
 $('historyRelationship').textContent=state.users[id].relationship;
 $('historyTrades').innerHTML='<div class="sub">Loading trades…</div>';
 $('historyMore').classList.add('hidden');
 $('historyOverlay').classList.remove('hidden');
 loadUserTrades(false);
}
function closeUserTrades(){
 shownTradeUser=null;$('historyOverlay').classList.add('hidden');
}
async function loadUserTrades(more=false){
 if(!shownTradeUser)return;
 const id=shownTradeUser;
 if(!more){historyOffset=0;historyRecords=[];}
 const btn=$('historyMore');btn.disabled=true;
 try{
  const res=await fetch('/api/trades?user='+encodeURIComponent(id)+'&offset='+historyOffset,{cache:'no-store'});
  const data=await res.json();
  if(!res.ok)throw Error(data.error||'Unable to load trade history');
  if(shownTradeUser!==id)return;
  historyRecords.push(...(data.trades||[]));
  historyOffset=historyRecords.length;
  const allHistory=[...historyRecords,...dateExtraTrades.filter(t=>t.userId===id)].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  $('historyTrades').innerHTML=allHistory.length?allHistory.map(t=>tradeLine(t,true)).join(''):'<div class="sub" style="padding:14px 0">No trades yet.</div>';
  btn.classList.toggle('hidden',!data.hasMore);
 }catch(e){
  $('historyTrades').innerHTML='<div class="sub">Could not load trades.</div>';
 }finally{btn.disabled=false}
}
function closeTrade(){$('tradeOverlay').classList.add('hidden')}
async function refresh(){
try{
const res=await fetch('/api/market',{cache:'no-store'}),data=await res.json();
if(!res.ok)throw Error(data.error||'Could not load the market');
state=data;if(state.current){$('gate').classList.add('hidden');mergeExtraPositions();render();await loadDateExtras();loadRecentTrades();fetchHistoricalOdds()}else $('gate').classList.remove('hidden');
}catch(err){$('gateError').textContent='Market unavailable: '+err.message}
}
async function signOut(){
try{await fetch('/api/market',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})})}catch(e){}
state.current=null;$('gate').classList.remove('hidden');$('email').value='';$('name').value='';$('relationship').value='';$('gateError').textContent='';
}
populateSettlementDates();
refresh();
setInterval(async()=>{
if(!state.current)return;
try{
const res=await fetch('/api/market',{cache:'no-store'});
if(res.ok){state=await res.json();if(state.current){mergeExtraPositions();render();renderTrade();loadDateExtras();loadRecentTrades();fetchHistoricalOdds()}else $('gate').classList.remove('hidden')}
}catch(e){}
},10000);
