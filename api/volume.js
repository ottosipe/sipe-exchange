const {Pool}=require('pg');
const crypto=require('crypto');
const pool=new Pool({connectionString:process.env.POSTGRES_URL||process.env.DATABASE_URL,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:9000});
const blank=()=>({buySP:0,sellSP:0,spTraded:0,buyShares:0,sellShares:0,sharesTraded:0,trades:0});
function getCookie(req,name){
 for(const piece of (req.headers.cookie||'').split(';')){
  const idx=piece.indexOf('=');
  if(idx>=0&&piece.slice(0,idx).trim()===name){
   try{return decodeURIComponent(piece.slice(idx+1).trim())}catch(e){return ''}
  }
 }
 return '';
}
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store, max-age=0');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 let client;
 try{
  const token=getCookie(req,'bm_session');
  if(!/^[a-f0-9]{64}$/i.test(token))return res.status(401).json({error:'Sign in required'});
  client=await pool.connect();
  const hash=crypto.createHash('sha256').update(token).digest('hex');
  const session=await client.query('SELECT user_id FROM babymarket_sessions WHERE token_hash=$1',[hash]);
  if(!session.rowCount)return res.status(401).json({error:'Sign in required'});
  const result={sex:[blank(),blank()],date:Array.from({length:30},blank),totals:{sex:blank(),date:blank()}};
  const rows=await client.query('SELECT market,outcome,side,COALESCE(SUM(shares),0)::float8 AS shares,COALESCE(SUM(points),0)::float8 AS points,COUNT(*)::int AS trades FROM babymarket_trades GROUP BY market,outcome,side');
  for(const r of rows.rows){
   if(r.market!=='sex'&&r.market!=='date')continue;
   const outcome=Number(r.outcome);
   if(!Number.isInteger(outcome)||outcome<0||outcome>=result[r.market].length)continue;
   if(r.side!=='buy'&&r.side!=='sell')continue;
   const points=Number(r.points),shares=Number(r.shares),trades=Number(r.trades);
   if(!Number.isFinite(points)||!Number.isFinite(shares)||!Number.isFinite(trades))continue;
   for(const item of [result[r.market][outcome],result.totals[r.market]]){
    item[r.side==='buy'?'buySP':'sellSP']+=points;
    item[r.side==='buy'?'buyShares':'sellShares']+=shares;
    item.spTraded+=points;
    item.sharesTraded+=shares;
    item.trades+=trades;
   }
  }
  res.status(200).json(result);
 }catch(e){console.error('Sipe market volume error:',e.message);res.status(500).json({error:'Trade volume unavailable'})}
 finally{if(client)client.release()}
};
