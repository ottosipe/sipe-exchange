'use strict';
const {Pool}=require('pg');
const Liquidity=require('./liquidity');
const pool=new Pool({connectionString:process.env.POSTGRES_URL||process.env.DATABASE_URL,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:9000});
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store, max-age=0');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 let client;
 try{
  client=await pool.connect();
  const rows=await client.query('SELECT data FROM babymarket_state WHERE id=1');
  if(!rows.rowCount)return res.status(503).json({error:'Market unavailable'});
  const state=rows.rows[0].data;
  const economy=Liquidity.economy(state);
  const trades=await client.query('SELECT COUNT(*)::int AS total FROM babymarket_trades');
  res.status(200).json({
   issuedSP:economy.issuedSP,
   liquidity:Liquidity.liquidity(state),
   players:economy.participants,
   trades:Number(trades.rows[0].total)+((state.dateNewTrades||[]).length)
  });
 }catch(e){
  console.error('Analytics error:',e.message);
  res.status(500).json({error:'Analytics unavailable'});
 }finally{if(client)client.release()}
};
