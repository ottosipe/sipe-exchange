
const {Pool}=require('pg');
const crypto=require('crypto');
const Pricing=require('../pricing');
const pool=new Pool({connectionString:process.env.POSTGRES_URL||process.env.DATABASE_URL,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:9000});
function authToken(req){
 const match=(req.headers.cookie||'').match(/(?:^|;\s*)bm_session=([^;]*)/);
 if(!match)return '';
 try{return decodeURIComponent(match[1])}catch(e){return ''}
}
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store, max-age=0');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 let client;
 try{
  const token=authToken(req);
  if(!/^[a-f0-9]{64}$/i.test(token))return res.status(401).json({error:'Sign in required'});
  client=await pool.connect();
  const hash=crypto.createHash('sha256').update(token).digest('hex');
  const session=await client.query('SELECT user_id FROM babymarket_sessions WHERE token_hash=$1',[hash]);
  if(!session.rowCount)return res.status(401).json({error:'Sign in required'});
  const stateRow=await client.query('SELECT data FROM babymarket_state WHERE id=1');
  const state=stateRow.rows[0]?.data;
  if(!state?.users?.[session.rows[0].user_id])return res.status(401).json({error:'Sign in required'});
  // Reproduce each inventory rescaling at the exact trade-ledger boundary.
  // A liquidity change must not change price or alter any actual trade.
  const ledger=await client.query('SELECT id,market,outcome,side,shares,created_at FROM babymarket_trades ORDER BY id ASC');
  const events=Array.isArray(state.liquidityRebases)?state.liquidityRebases:[];
  const q=[0,0],points=[];
  let b=Pricing.LEGACY_LIQUIDITY,eventIndex=0;
  const sexTrades=ledger.rows.filter(t=>t.market==='sex');
  const first=sexTrades.length?new Date(sexTrades[0].created_at).getTime():Date.now();
  points.push({at:first-60000,boy:Pricing.boyProbability(q,b),kind:'opening',liquidity:b});
  function applyEvents(afterId,at){
   while(eventIndex<events.length&&String(events[eventIndex].afterTradeId)===String(afterId)){
    const event=events[eventIndex++];
    const factor=Number(event.factor);
    if(!Number.isFinite(factor)||factor<=0)throw new Error('Invalid liquidity history');
    q[0]*=factor;q[1]*=factor;b*=factor;
    points.push({at,boy:Pricing.boyProbability(q,b),kind:'liquidity',liquidity:b});
   }
  }
  applyEvents('0',first-60000);
  for(const t of ledger.rows){
   const at=new Date(t.created_at).getTime();
   if(t.market==='sex'){
    const index=Number(t.outcome);
    if(index===0||index===1){
     q[index]+=(t.side==='buy'?1:-1)*Number(t.shares);
     if(Number.isFinite(at))points.push({at,boy:Pricing.boyProbability(q,b),kind:'trade',liquidity:b});
    }
   }
   applyEvents(String(t.id),Number.isFinite(at)?at:Date.now());
  }
  if(eventIndex!==events.length)throw new Error('Unmatched liquidity events');
  if(q.some((x,i)=>Math.abs(x-Number(state.sexQ?.[i]))>1e-4))
   return res.status(409).json({error:'History and market positions differ'});
  const liveB=Number(state.pricingLiquidity||Pricing.LEGACY_LIQUIDITY);
  points.push({at:Date.now(),boy:Pricing.boyProbability(state.sexQ,liveB),kind:'current',liquidity:liveB});
  res.status(200).json({points,trades:points.filter(p=>p.kind==='trade').length,liquidity:liveB,method:'replayed-with-liquidity-rebases'});
 }catch(e){
  console.error('Odds history error:',e.message);
  res.status(500).json({error:'Historical odds unavailable'});
 }finally{if(client)client.release()}
};
