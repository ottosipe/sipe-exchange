const {Pool}=require('pg');
const crypto=require('crypto');
const Pricing=require('../pricing');
const pool=new Pool({connectionString:process.env.POSTGRES_URL||process.env.DATABASE_URL,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:9000});
const SIZE=31;
function fail(message,status=400){const e=new Error(message);e.status=status;throw e}
function parseCookies(req){return (req.headers.cookie||'').split(';').map(x=>{const i=x.indexOf('=');if(i<0)return '';try{return decodeURIComponent(x.slice(i+1).trim())}catch{return ''}}).filter(x=>x.length>=16&&x.length<=500)}
async function authenticate(client,req){
 for(const token of parseCookies(req)){
  const hash=crypto.createHash('sha256').update(token).digest('hex');
  const r=await client.query('SELECT user_id FROM babymarket_sessions WHERE token_hash=$1 LIMIT 1',[hash]);
  if(r.rows.length)return r.rows[0].user_id;
 }
 return null;
}
function positions(u){return {dateAfter:Array.from({length:SIZE},(_,i)=>Number(u.dateAfter?.[i]||0)),dateExact:Array.from({length:SIZE},(_,i)=>Number(u.dateExact?.[i]||0)),dateAfterBasis:Array.from({length:SIZE},(_,i)=>u.dateAfterBasis?.[i]??null),dateExactBasis:Array.from({length:SIZE},(_,i)=>u.dateExactBasis?.[i]??null)}}
function indices(type,day){if(type==='exact')return [day];if(type==='after')return Array.from({length:SIZE-day},(_,i)=>i+day);fail('Unsupported birthday contract')}
function quote(q,ix,mode,amount,held){
 const b=Pricing.marketLiquidity();
 if(mode==='sell'){
  if(amount>held+1e-7)fail('You cannot sell more shares than you hold');
  const shares=Math.min(amount,held),points=-Pricing.delta(q,ix,-shares,b);
  if(!Number.isFinite(points)||points<0)fail('Invalid sale quote');
  return {shares,points};
 }
 let lo=0,hi=1;
 while(Pricing.delta(q,ix,hi,b)<amount&&hi<1e7)hi*=2;
 if(hi>=1e7)fail('Trade is too large');
 for(let k=0;k<50;k++){const mid=(lo+hi)/2;if(Pricing.delta(q,ix,mid,b)>amount)hi=mid;else lo=mid}
 const shares=lo,points=Pricing.delta(q,ix,shares,b);
 if(!Number.isFinite(shares)||!Number.isFinite(points)||shares<=0||points<=0)fail('Trade cannot be quoted');
 return {shares,points};
}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store, private');
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed'})}
 const origin=req.headers.origin,expected='https://'+req.headers.host;
 if(req.method==='POST'&&origin&&origin!==expected&&origin!=='https://sipe.exchange'&&origin!=='https://www.sipe.exchange')return res.status(403).json({error:'Cross-site request rejected'});
 let client;
 try{
  client=await pool.connect();
  const userId=await authenticate(client,req);
  if(!userId)fail('Please sign in',401);
  if(req.method==='GET'){
   const result=await client.query('SELECT data FROM babymarket_state WHERE id=1');
   const s=result.rows[0]?.data;
   if(!s?.users?.[userId])fail('Account not found',401);
   const publicPositions=Object.fromEntries(Object.entries(s.users).map(([id,u])=>[id,positions(u)]));
   return res.status(200).json({positions:publicPositions,trades:(s.dateNewTrades||[]),current:userId});
  }
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  const type=body.contractType,mode=body.mode,day=Number(body.outcome),amount=Number(body.amount);
  if(!['after','exact'].includes(type))fail('Choose On or after or Exact day');
  if(!['buy','sell'].includes(mode))fail('Choose Buy or Sell');
  // Bucket zero combines Jan 13 and all earlier days. Exact-day and inclusive-after contracts need a single-date bucket.
  if(!Number.isInteger(day)||day<1||day>29)fail('Choose a date between January 14 and February 11');
  if(!Number.isFinite(amount)||amount<0.01||amount>1000000)fail('Invalid amount');
  await client.query('BEGIN');
  const result=await client.query('SELECT data FROM babymarket_state WHERE id=1 FOR UPDATE');
  const s=result.rows[0]?.data;
  if(!s||!Array.isArray(s.dateQ)||s.dateQ.length!==SIZE||!s.users?.[userId])fail('Market unavailable',409);
  const u=s.users[userId],ix=indices(type,day),key=type==='after'?'dateAfter':'dateExact',basisKey=key+'Basis';
  if(!Array.isArray(u[key]))u[key]=Array(SIZE).fill(0);
  if(!Array.isArray(u[basisKey]))u[basisKey]=Array(SIZE).fill(null);
  const held=Number(u[key][day]||0),cash=Number(u.cash||0);
  if(mode==='buy'&&amount>cash+1e-7)fail('Not enough available balance');
  if(mode==='sell'&&held<amount-1e-7)fail('Not enough shares to sell');
  const trade=quote(s.dateQ,ix,mode,amount,held);
  if(mode==='buy'){
    const oldBasis=Number(u[basisKey][day]||0);
    u[basisKey][day]=(oldBasis*held+trade.points)/(held+trade.shares);
    u[key][day]=held+trade.shares;
    u.cash=cash-trade.points;
  }else{
    u[key][day]=Math.max(0,held-trade.shares);
    if(u[key][day]<1e-8){u[key][day]=0;u[basisKey][day]=null}
    u.cash=cash+trade.points;
  }
  for(const i of ix)s.dateQ[i]+=(mode==='buy'?1:-1)*trade.shares;
  if(!Array.isArray(s.dateNewTrades))s.dateNewTrades=[];
  const record={id:crypto.randomUUID(),userId,market:'date',contractType:type,outcome:day,side:mode,shares:trade.shares,points:trade.points,createdAt:new Date().toISOString()};
  s.dateNewTrades.push(record);
  if(!Array.isArray(s.history))s.history=[];
  const dp=Pricing.softmax(s.dateQ,Pricing.marketLiquidity());
  s.history.push({sex:Pricing.boyProbability(s.sexQ,Pricing.marketLiquidity()),date:dp.slice(0,15).reduce((a,x)=>a+x,0),event:'trade',liquidity:Pricing.marketLiquidity()});
  await client.query('UPDATE babymarket_state SET data=$1::jsonb WHERE id=1',[JSON.stringify(s)]);
  await client.query('COMMIT');
  return res.status(200).json({ok:true,trade:record,cash:u.cash});
 }catch(e){
  if(client)try{await client.query('ROLLBACK')}catch{}
  console.error('Birthday contract error',e.message);
  return res.status(e.status||500).json({error:e.status?e.message:'Could not process birthday trade'});
 }finally{if(client)client.release()}
};
