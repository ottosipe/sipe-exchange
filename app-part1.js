
const START=1000,dates=Array.from({length:30},(_,i)=>new Date(Date.UTC(2027,0,13+i)).toISOString().slice(0,10));const $=id=>document.getElementById(id);let state={users:{},current:null,sexQ:[0,0],dateQ:Array(30).fill(0),history:[],liquidity:1000,economy:{participants:0,issuedSP:0}};let selectedSex=null,cutoff=14,dateContractType='exact',tradeContractType='exact',tradeMarket='sex',tradeMode='buy',sellMaxFullShares=null;let dateExtraTrades=[],dateExtraPositions={};let settlementPreview=null;const f=n=>'§'+Math.round(n).toLocaleString();const label=s=>new Date(s+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const user=()=>state.users[state.current];
function marketLiquidity(){return Number(state.liquidity)||SipePricing.marketLiquidity(Number(state.economy?.issuedSP||1000))}function softmax(q){return SipePricing.softmax(q,marketLiquidity())}function cost(q){return SipePricing.cost(q,marketLiquidity())}function datePrice(k,type='before'){const dp=softmax(state.dateQ);return dp.reduce((sum,v,i)=>sum+((type==='exact'?i===k:type==='after'?i>=k:i<=k)?v:0),0)}
function extraDateVolume(k){const result=emptyVolume();for(const trade of dateExtraTrades){if(Number(trade.outcome)!==k)continue;result.spTraded+=Number(trade.points)||0;result.sharesTraded+=Number(trade.shares)||0;if(trade.side==='buy'){result.buySP+=Number(trade.points)||0;result.buyShares+=Number(trade.shares)||0}else{result.sellSP+=Number(trade.points)||0;result.sellShares+=Number(trade.shares)||0}}return result}
function selectDateType(type){if(!['before','after','exact'].includes(type))return;dateContractType=type;render()}
function dateTypeLabel(type){return type==='after'?'On or after':type==='exact'?'Exact day':'On or before'}
function extraSharesHeld(type,k){return Object.values(state.users||{}).reduce((sum,u)=>sum+Number((type==='after'?u.dateAfter:u.dateExact)?.[k]||0),0)}
function mergeExtraPositions(){for(const [id,positions] of Object.entries(dateExtraPositions)){if(state.users?.[id])Object.assign(state.users[id],positions)}}
async function loadDateExtras(){if(!state.current)return;try{const r=await fetch('/api/date-contract',{cache:'no-store'});if(!r.ok)throw Error('Birthday positions unavailable');const data=await r.json();dateExtraPositions=data.positions||{};dateExtraTrades=data.trades||[];mergeExtraPositions();render();renderTrade()}catch(e){console.warn('Could not load new birthday contracts',e)}}
function rebuildDateOutcomeOptions(previous){if(tradeMarket!=='date')return;const start=tradeContractType==='before'?0:1;const last=tradeContractType==='before'&&tradeMode==='sell'&&Number(user()?.date?.[29]||0)>0?29:28;const html=dates.slice(start,last+1).map((d,i)=>'<option value="'+(i+start)+'">'+label(d)+'</option>').join('');$('tradeOutcome').innerHTML=html;const wanted=Number(previous);$('tradeOutcome').value=Number.isInteger(wanted)&&wanted>=start&&wanted<=last?String(wanted):String(Math.max(start,Math.min(last,cutoff)))}
function chooseTradeDateType(type){if(!['before','after','exact'].includes(type))return;tradeContractType=type;dateContractType=type;if(type!=='before'&&cutoff<1)cutoff=1;rebuildDateOutcomeOptions($('tradeOutcome').value);sellMaxFullShares=null;$('tradeAmount').value='';render();renderTrade()}
function portfolio(u){let sp=softmax(state.sexQ),dp=softmax(state.dateQ);const before=u.date.reduce((a,n,i)=>a+n*dp.slice(0,i+1).reduce((x,y)=>x+y,0),0);const after=(u.dateAfter||[]).reduce((a,n,i)=>a+n*dp.slice(i).reduce((x,y)=>x+y,0),0);const exact=(u.dateExact||[]).reduce((a,n,i)=>a+n*(dp[i]||0),0);return u.cash+u.sex.reduce((a,n,i)=>a+n*sp[i],0)+before+after+exact}
function holdingsValue(u){return Math.max(0,portfolio(u)-Number(u.cash||0))}
function spExact(n){return "§"+Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
function signedSP(n){return (n<0?"-":n>0?"+":"")+"§"+Math.abs(Number(n)||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
function participantName(name,relationship){return safe(name||"Player")+(relationship?" ("+safe(relationship)+")":"")}
function positionSummary(emoji,market,shares,average){
 const paid=average!==null&&average!==undefined&&Number.isFinite(Number(average))?priceTag(Number(average)):'—';
 return emoji+' '+safe(market)+' · '+asShares(shares)+' shares · '+paid;
}
function renderHoldingRows(u,basis,sim=null,showPerformance=false){
 const rows=[];
 const add=(emoji,market,shares,average,currentPrice)=>{
  if(!(Number(shares)>0.0001))return;
  const main='<div class="holding-compact"><span class="holding-compact-label">'+positionSummary(emoji,market,shares,average)+'</span><strong class="holding-compact-value">'+spExact(shares*currentPrice)+'</strong></div>';
  if(!showPerformance){rows.push(main);return;}
  const paid=average===null||average===undefined?NaN:Number(average);
  const hasBasis=Number.isFinite(paid)&&paid>=0;
  const change=hasBasis?(currentPrice-paid)*shares:NaN;
  const nearZero=hasBasis&&Math.abs(change)<0.005;
  const changeText=!hasBasis?'—':nearZero?'§0.00':signedSP(change);
  const changeStyle=!hasBasis||nearZero?'neutral':change>0?'up':'down';
  rows.push('<div class="position-with-pnl">'+main
   +'<div class="position-pnl-row"><span>Current '+priceTag(currentPrice)+'</span>'
   +'<strong class="position-pnl-value '+changeStyle+'" title="Unrealized gain or loss versus average cost paid">'+changeText+'</strong></div></div>');
 };
 const prices=softmax(state.sexQ);
 for(let j=0;j<2;j++)add(j===0?'💙':'🩷',j===0?'Boy':'Girl',Number(u.sex?.[j]||0),basis?.sex?.[j],sim?(sim.sex===j?1:0):prices[j]);
 for(let j=0;j<(u.date?.length||0);j++)add('📅','On or before '+label(dates[j]),Number(u.date[j]||0),basis?.date?.[j],sim?(sim.birth<=dates[j]?1:0):datePrice(j));
 for(let j=0;j<(u.dateAfter?.length||0);j++)add('📅','On or after '+label(dates[j]),Number(u.dateAfter[j]||0),u.dateAfterBasis?.[j],sim?(sim.birth>=dates[j]?1:0):datePrice(j,'after'));
 for(let j=0;j<(u.dateExact?.length||0);j++)add('📅','Exactly '+label(dates[j]),Number(u.dateExact[j]||0),u.dateExactBasis?.[j],sim?(sim.birth===dates[j]?1:0):datePrice(j,'exact'));
 return rows.join('')||'<div class="position-list-empty">No shares held</div>';
}function initial(){return {cash:START,sex:[0,0],date:Array(29).fill(0)}}
async function register(){
const email=$('email').value.trim().toLowerCase(),name=$('name').value.trim();
let relationship=$('relationship').value;if(relationship==='Other')relationship=$('otherRel').value.trim();
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){$('gateError').textContent='Enter a valid email.';return}
const btn=$('registerButton');btn.disabled=true;$('gateError').textContent='';
try{
const res=await fetch('/api/market',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'login',email,name,relationship})});
const data=await res.json();if(!res.ok)throw Error(data.error||'Could not sign in');
state=data;$('gate').classList.add('hidden');mergeExtraPositions();render();loadDateExtras();loadRecentTrades();fetchHistoricalOdds();
}catch(e){$('gateError').textContent=e.message}finally{btn.disabled=false}
}
function chooseSex(s){selectedSex=s;render()}function setCutoff(k){cutoff=k;render()}function asShares(n){return Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}function priceTag(v){return "§"+Number(v).toFixed(3)}function payoutRatio(v){return Number.isFinite(v)&&v>0?'1:'+(1/v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' payout':'1:∞ payout'}let volumeMetric={sex:'sp',date:'sp'},sexDailyVolume=[];
function setVolumeMetric(market,metric){
 if(!['sex','date'].includes(market)||!['sp','shares'].includes(metric))return;
 volumeMetric[market]=metric;
 drawSexVolume();drawDateVolume();
}
function updateVolumeToggles(){
 for(const market of ['sex','date']){
  $(market+'MetricSP').classList.toggle('active',volumeMetric[market]==='sp');
  $(market+'MetricShares').classList.toggle('active',volumeMetric[market]==='shares');
  $(market+'MetricSP').setAttribute('aria-pressed',String(volumeMetric[market]==='sp'));
  $(market+'MetricShares').setAttribute('aria-pressed',String(volumeMetric[market]==='shares'));
 }
}
function drawDateDots(){
 if(!state.current)return;
 const vals=softmax(state.dateQ).slice(0,29);
 const peak=Math.min(1,Math.max(.08,...vals)*1.16);
 const x=i=>10+480*i/28,y=p=>140-130*Math.min(1,Math.max(0,p/peak));
 let svg='<path d="M0 10H500 M0 75H500 M0 140H500" stroke="#2a3c59" stroke-dasharray="4 6" fill="none"/>';
 svg+='<text x="490" y="9" font-size="10" text-anchor="end" fill="#91a8c9">'+(peak*100).toFixed(1)+'% scale</text>';
 svg+='<path d="M'+x(cutoff).toFixed(2)+' 11V143" stroke="#7099d0" stroke-dasharray="3 5" opacity=".5"/>';
 for(let i=0;i<vals.length;i++){
  const p=vals[i],cx=x(i),cy=y(p),current=i===cutoff;
  const day=i===0?'On '+label(dates[i])+' or earlier':'Born on '+label(dates[i]);
  const title=day+' · '+(p*100).toFixed(2)+'% daily chance · '+(i===0&&dateContractType!=='before'?'Jan 14 is the earliest selectable day for this contract':priceTag(datePrice(i,dateContractType))+' '+dateTypeLabel(dateContractType).toLowerCase()+' price');
  svg+='<circle cx="'+cx.toFixed(2)+'" cy="'+cy.toFixed(2)+'" r="'+(current?5.5:3.8)+'" fill="'+(current?'#b3d5ff':'#64a1ff')+'" stroke="'+(current?'#f6fbff':'#182947')+'" stroke-width="'+(current?'2':'1')+'" pointer-events="none"/>';
  svg+='<circle class="chart-dot-select" cx="'+cx.toFixed(2)+'" cy="'+cy.toFixed(2)+'" r="9" fill="transparent" tabindex="0" role="button" aria-label="'+safe(title)+'" onclick="setCutoff('+i+')" onkeydown="if(event.key===&#39;Enter&#39;||event.key===&#39; &#39;){event.preventDefault();setCutoff('+i+')}"><title>'+safe(title)+'</title></circle>';
 }
 $('dateChart').innerHTML=svg;
}
function drawDateVolume(){
 if(!state.current)return;
 const metric=volumeMetric.date,arr=Array.from({length:29},(_,i)=>{const x=wagers.date[i]||emptyVolume(),extra=extraDateVolume(i);return {spTraded:x.spTraded+extra.spTraded,sharesTraded:x.sharesTraded+extra.sharesTraded}});
 const val=v=>Math.max(0,Number(metric==='sp'?v.spTraded:v.sharesTraded)||0);
 const max=Math.max(1,...arr.map(val)),x=i=>10+480*i/28;
 const y0=100,height=88;
 let svg='<path d="M0 100H500 M0 56H500 M0 12H500" stroke="#293b57" stroke-dasharray="4 6" fill="none"/>';
 svg+='<text x="492" y="10" font-size="10" text-anchor="end" fill="#8da5c6">'+(metric==='sp'?formatSP(max):asShares(max)+' shares')+' max</text>';
 for(let i=0;i<arr.length;i++){
  const v=arr[i],value=val(v),barH=value/max*height,cx=x(i);
  const color=i===cutoff?'#a6d0ff':'#407cb8';
  const tooltip='Birthday contracts for '+label(dates[i])+' · '+formatSP(v.spTraded)+' traded · '+asShares(v.sharesTraded)+' shares traded';
  if(value>0)svg+='<rect x="'+(cx-6).toFixed(2)+'" y="'+(y0-barH).toFixed(2)+'" width="12" height="'+Math.max(.75,barH).toFixed(2)+'" rx="2" fill="'+color+'"/>';
  if(i===cutoff)svg+='<path d="M'+cx.toFixed(2)+' 12V102" stroke="#8fb8e9" stroke-dasharray="2 4" opacity=".45"/>';
  svg+='<rect class="chart-dot-select" x="'+(cx-8).toFixed(2)+'" y="10" width="16" height="92" fill="transparent" tabindex="0" role="button" aria-label="'+safe(tooltip)+'" onclick="setCutoff('+i+')" onkeydown="if(event.key===&#39;Enter&#39;||event.key===&#39; &#39;){event.preventDefault();setCutoff('+i+')}"><title>'+safe(tooltip)+'</title></rect>';
 }
 $('dateVolumeChart').innerHTML=svg;
 updateVolumeToggles();
}
function drawSexVolume(){
 if(!state.current)return;
 const metric=volumeMetric.sex,vals=Array.isArray(sexDailyVolume)?sexDailyVolume:[];
 const svgEl=$('sexVolumeChart');
 if(!vals.length){
  svgEl.innerHTML='<text x="250" y="57" font-size="12" fill="#8da5c6" text-anchor="middle">No trading volume yet</text>';
  updateVolumeToggles();return;
 }
 const val=(v,i)=>Math.max(0,Number(metric==='sp'?v.sp?.[i]:v.shares?.[i])||0);
 const max=Math.max(1,...vals.map(v=>val(v,0)+val(v,1)));
 const parseDay=day=>Date.parse(day+'T12:00:00Z'),first=parseDay(vals[0].day),last=parseDay(vals[vals.length-1].day);
 const x=day=>first===last?250:10+480*(parseDay(day)-first)/(last-first);
 const w=Math.max(4,Math.min(26,400/Math.max(vals.length,1))),baseline=100,scale=88/max;
 let svg='<path d="M0 100H500 M0 56H500 M0 12H500" stroke="#293b57" stroke-dasharray="4 6" fill="none"/>';
 svg+='<text x="492" y="10" font-size="10" text-anchor="end" fill="#8da5c6">'+(metric==='sp'?formatSP(max):asShares(max)+' shares')+' max</text>';
 for(const v of vals){
  const cx=x(v.day),boy=val(v,0),girl=val(v,1),boyH=boy*scale,girlH=girl*scale;
  if(boyH>0)svg+='<rect x="'+(cx-w/2).toFixed(2)+'" y="'+(baseline-boyH).toFixed(2)+'" width="'+w+'" height="'+Math.max(0.75,boyH).toFixed(2)+'" rx="1.5" fill="#64a1ff"/>';
  if(girlH>0)svg+='<rect x="'+(cx-w/2).toFixed(2)+'" y="'+(baseline-boyH-girlH).toFixed(2)+'" width="'+w+'" height="'+Math.max(.75,girlH).toFixed(2)+'" rx="1.5" fill="#e58ac4"/>';
  const title=v.day+' · Boy '+formatSP(v.sp?.[0])+' / '+asShares(v.shares?.[0])+' shares · Girl '+formatSP(v.sp?.[1])+' / '+asShares(v.shares?.[1])+' shares';
  svg+='<rect x="'+(cx-Math.max(w,16)/2).toFixed(2)+'" y="12" width="'+Math.max(w,16)+'" height="90" fill="transparent"><title>'+safe(title)+'</title></rect>';
 }
 svgEl.innerHTML=svg;
 $('sexVolumeFirst').textContent=label(vals[0].day);
 $('sexVolumeLast').textContent=vals.length===1?'Same day':label(vals[vals.length-1].day);
 updateVolumeToggles();
}
async function loadSexVolumeHistory(){
 if(!state.current)return;
 try{
  const response=await fetch('/api/sex-volume-history',{cache:'no-store'});
  if(!response.ok)throw Error('Unavailable');
  const data=await response.json();
  if(!Array.isArray(data.days))throw Error('Invalid daily volume');
  sexDailyVolume=data.days;drawSexVolume();
 }catch(e){console.warn('Could not load sex trading volume',e)}
}

let historicalOdds=null,historyBusy=false;
const historicalTime=ms=>new Date(ms).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});