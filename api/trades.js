
const {Pool}=require('pg');
const crypto=require('crypto');
const pool=new Pool({connectionString:process.env.POSTGRES_URL||process.env.DATABASE_URL,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:9000});
function getCookie(req,key){
  for(const part of (req.headers.cookie||'').split(';')){
    const i=part.indexOf('=');
    if(i>0&&part.slice(0,i).trim()===key){
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
   const token=getCookie(req,'bm_session');
   if(!token||!(/^[a-f0-9]{64}$/i.test(token)))return res.status(401).json({error:'Sign in to see trades'});
   client=await pool.connect();
   const hash=crypto.createHash('sha256').update(token).digest('hex');
   const session=await client.query('SELECT user_id FROM babymarket_sessions WHERE token_hash=$1',[hash]);
   if(!session.rowCount)return res.status(401).json({error:'Sign in to see trades'});
   const result=await client.query('SELECT data FROM babymarket_state WHERE id=1');
   if(!result.rowCount)return res.status(503).json({error:'Market unavailable'});
   const users=result.rows[0].data.users||{};
   if(!users[session.rows[0].user_id])return res.status(401).json({error:'Sign in to see trades'});
   let trades,hasMore=false;
   const queryUser=typeof req.query.user==='string'?req.query.user:null;
   if(queryUser!==null){
     if(!users[queryUser])return res.status(404).json({error:'User not found'});
     const offset=Number(req.query.offset||0);
     if(!Number.isInteger(offset)||offset<0||offset>100000)return res.status(400).json({error:'Invalid offset'});
     const rows=await client.query(
       'SELECT id,user_id,market,outcome,side,shares,points,created_at FROM babymarket_trades WHERE user_id=$1 ORDER BY id DESC LIMIT 51 OFFSET $2',
       [queryUser,offset]
     );
     hasMore=rows.rows.length>50;trades=rows.rows.slice(0,50);
   }else{
     const rows=await client.query(
       'SELECT id,user_id,market,outcome,side,shares,points,created_at FROM (SELECT id,user_id,market,outcome,side,shares,points,created_at,ROW_NUMBER() OVER (PARTITION BY market ORDER BY id DESC) AS position FROM babymarket_trades) ranked WHERE position<=6 ORDER BY id DESC'
     );
     trades=rows.rows;
   }
   res.status(200).json({
     trades:trades.map(t=>({
       id:String(t.id),
       userId:t.user_id,
       name:String(users[t.user_id]?.name||'Player'),
       market:t.market,outcome:t.outcome,side:t.side,
       shares:t.shares,points:t.points,createdAt:t.created_at
     })),
     hasMore
   });
 }catch(e){
   console.error('Sipe Exchange trade activity error',e.message);
   res.status(500).json({error:'Could not load trade history'});
 }finally{if(client)client.release();}
};
