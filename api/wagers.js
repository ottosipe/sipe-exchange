
const {Pool}=require('pg');
const crypto=require('crypto');
const pool=new Pool({connectionString:process.env.POSTGRES_URL||process.env.DATABASE_URL,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:9000});
function sessionToken(req){
 for(const part of (req.headers.cookie||'').split(';')){
  const i=part.indexOf('=');
  if(i>0&&part.slice(0,i).trim()==='bm_session'){
   try{return decodeURIComponent(part.slice(i+1).trim())}catch(e){return null}
  }
 }
 return null;
}
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store, max-age=0');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 let client;
 try{
  const token=sessionToken(req);
  if(!token||!/^[a-f0-9]{64}$/i.test(token))return res.status(401).json({error:'Sign in to see market volume'});
  client=await pool.connect();
  const hash=crypto.createHash('sha256').update(token).digest('hex');
  const auth=await client.query('SELECT user_id FROM babymarket_sessions WHERE token_hash=$1',[hash]);
  if(!auth.rowCount)return res.status(401).json({error:'Session expired'});
  const rows=await client.query(
   "SELECT market,outcome,SUM(points)::double precision AS sp FROM babymarket_trades WHERE side='buy' AND market IN ('sex','date') GROUP BY market,outcome"
  );
  const sex=[0,0],date=Array(30).fill(0);
  for(const row of rows.rows){
   const target=row.market==='sex'?sex:date;
   const i=Number(row.outcome),amount=Number(row.sp);
   if(Number.isInteger(i)&&i>=0&&i<target.length&&Number.isFinite(amount))
    target[i]=Math.max(0,amount);
  }
  res.status(200).json({
   sex,date,
   totals:{sex:sex.reduce((a,b)=>a+b,0),date:date.reduce((a,b)=>a+b,0)}
  });
 }catch(err){
  console.error('Wager total error:',err.message);
  res.status(500).json({error:'Wager totals unavailable'});
 }finally{if(client)client.release()}
};
