const {Pool}=require('pg');
const crypto=require('crypto');
const pool=new Pool({connectionString:process.env.POSTGRES_URL||process.env.DATABASE_URL,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:9000});
function cookie(req,name){
 for(const part of (req.headers.cookie||'').split(';')){
  const idx=part.indexOf('=');
  if(idx>=0&&part.slice(0,idx).trim()===name){
   try{return decodeURIComponent(part.slice(idx+1).trim())}catch(e){return ''}
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
  const hash=crypto.createHash('sha256').update(token).digest('hex');
  const session=await client.query('SELECT user_id FROM babymarket_sessions WHERE token_hash=$1',[hash]);
  if(!session.rowCount)return res.status(401).json({error:'Sign in required'});
  const stateRes=await client.query('SELECT data FROM babymarket_state WHERE id=1');
  const state=stateRes.rows[0]?.data;
  if(!state?.users?.[session.rows[0].user_id])return res.status(401).json({error:'Sign in required'});
  const trades=await client.query('SELECT user_id,market,outcome,side,shares,points FROM babymarket_trades ORDER BY id ASC');
  const ledger=Object.create(null);
  for(const t of trades.rows){
   if(!state.users[t.user_id]||!['sex','date'].includes(t.market))continue;
   const index=Number(t.outcome),max=t.market==='sex'?2:30;
   if(!Number.isInteger(index)||index<0||index>=max||!['buy','sell'].includes(t.side))continue;
   const quantity=Number(t.shares),value=Number(t.points);
   if(!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(value)||value<0)continue;
   const key=t.market+':'+index;
   const records=ledger[t.user_id]||(ledger[t.user_id]=Object.create(null));
   const record=records[key]||(records[key]={shares:0,cost:0});
   if(t.side==='buy'){record.shares+=quantity;record.cost+=value}
   else if(record.shares>0){
    const sold=Math.min(quantity,record.shares);
    const fraction=sold/record.shares;
    record.cost*=1-fraction;
    record.shares-=sold;
    if(record.shares<1e-8){record.shares=0;record.cost=0}
   }
  }
  const users=Object.create(null);
  for(const [id,u] of Object.entries(state.users)){
   const rec=ledger[id]||{};
   const average=(market,index,held)=>{
    const position=rec[market+':'+index],n=Number(held)||0;
    if(n<=1e-8||!position||Math.abs(position.shares-n)>1e-5||position.cost<0)return null;
    return position.cost/n;
   };
   users[id]={
    sex:Array.from({length:2},(_,i)=>average('sex',i,u.sex?.[i])),
    date:Array.from({length:30},(_,i)=>average('date',i,u.date?.[i]))
   };
  }
  return res.status(200).json({users});
 }catch(e){
  console.error('Acquisition cost query failed:',e.message);
  return res.status(500).json({error:'Acquisition costs unavailable'});
 }finally{if(client)client.release()}
};
