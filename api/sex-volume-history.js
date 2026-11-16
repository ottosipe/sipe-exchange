const {Pool}=require('pg');
const crypto=require('crypto');
const pool=new Pool({connectionString:process.env.POSTGRES_URL||process.env.DATABASE_URL,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:9000});
function cookie(req,name){
 for(const part of (req.headers.cookie||'').split(';')){
  const split=part.indexOf('=');
  if(split>=0&&part.slice(0,split).trim()===name){
   try{return decodeURIComponent(part.slice(split+1).trim())}catch(e){return ''}
  }
 }
 return '';
}
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store, max-age=0');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 let client;
 try{
  const token=cookie(req,'bm_session');
  if(!/^[a-f0-9]{64}$/i.test(token))return res.status(401).json({error:'Sign in required'});
  client=await pool.connect();
  const digest=crypto.createHash('sha256').update(token).digest('hex');
  const session=await client.query('SELECT user_id FROM babymarket_sessions WHERE token_hash=$1',[digest]);
  if(!session.rowCount)return res.status(401).json({error:'Sign in required'});
  const trades=await client.query(
    `SELECT to_char(date_trunc('hour',created_at AT TIME ZONE 'UTC'),'YYYY-MM-DD"T"HH24:00:00"Z"') AS hour,
      outcome,SUM(ABS(points))::float8 AS sp,SUM(ABS(shares))::float8 AS shares
      FROM babymarket_trades WHERE market='sex' GROUP BY 1,2 ORDER BY 1,2`
  );
  const hours=new Map();
  for(const r of trades.rows){
   const i=Number(r.outcome);
   if(i!==0&&i!==1)continue;
   if(!/^\d{4}-\d{2}-\d{2}T\d{2}:00:00Z$/.test(r.hour))continue;
   let hour=hours.get(r.hour);
   if(!hour){hour={hour:r.hour,sp:[0,0],shares:[0,0]};hours.set(r.hour,hour)}
   hour.sp[i]=Math.max(0,Number(r.sp)||0);
   hour.shares[i]=Math.max(0,Number(r.shares)||0);
  }
  return res.status(200).json({hours:Array.from(hours.values())});
 }catch(e){
  console.error('Hourly volume error:',e.message);
  return res.status(500).json({error:'Hourly volume unavailable'});
 }finally{if(client)client.release()}
};
