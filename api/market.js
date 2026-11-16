
const {Pool}=require('pg');
const crypto=require('crypto');
const Pricing=require('../pricing');
const Liquidity=require('./liquidity');
const LEGACY_B=180;
const pool=new Pool({connectionString:process.env.POSTGRES_URL||process.env.DATABASE_URL,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:9000});
function initial(){return {users:{},sexQ:[0,0],dateQ:Array(31).fill(0),dateWindowVersion:2,history:[]}}
const economy=Liquidity.economy;
const liquidity=Liquidity.liquidity;
function visible(s,id){
 const env=economy(s),b=liquidity(s);
 if(!id)return {users:{},current:null,sexQ:[0,0],dateQ:Array(31).fill(0),history:[],liquidity:b,economy:env};
 const users={};
 for(const [key,u] of Object.entries(s.users))users[key]={name:u.name,relationship:u.relationship,joinedAt:u.joinedAt||null,cash:u.cash,sex:u.sex,date:u.date};
 return {users,current:id,sexQ:s.sexQ,dateQ:s.dateQ,history:s.history,liquidity:b,economy:env};
}
function cookies(req){const out={};for(const item of (req.headers.cookie||'').split(';')){const k=item.indexOf('=');if(k>0){try{out[item.slice(0,k).trim()]=decodeURIComponent(item.slice(k+1).trim())}catch(e){}}}return out}
function fail(message,status=400){const e=new Error(message);e.status=status;throw e}
function recordMarketState(state,event){
 const b=liquidity(state);
 state.history.push({sex:Pricing.boyProbability(state.sexQ,b),date:Pricing.softmax(state.dateQ,b).slice(0,15).reduce((a,b)=>a+b,0),liquidity:b,event});
 if(state.history.length>500)state.history=state.history.slice(-500);
}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store, max-age=0');
 let client,inTransaction=false;
 try{
  if(req.method!=='GET'&&req.method!=='POST')fail('Method not allowed',405);
  client=await pool.connect();await client.query('BEGIN');inTransaction=true;
  await client.query('CREATE TABLE IF NOT EXISTS babymarket_state (id integer PRIMARY KEY, data jsonb NOT NULL)');
  await client.query('CREATE TABLE IF NOT EXISTS babymarket_sessions (token_hash text PRIMARY KEY, user_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())');
  await client.query('CREATE TABLE IF NOT EXISTS babymarket_trades (id bigserial PRIMARY KEY, user_id text NOT NULL, market text NOT NULL, outcome integer NOT NULL, side text NOT NULL, shares double precision NOT NULL, points double precision NOT NULL, created_at timestamptz NOT NULL DEFAULT now())');
  await client.query('INSERT INTO babymarket_state(id,data) VALUES(1,$1) ON CONFLICT DO NOTHING',[JSON.stringify(initial())]);
  const result=await client.query('SELECT data FROM babymarket_state WHERE id=1 FOR UPDATE');
  const state=result.rows[0].data;
  let changed=false;
  if(state.dateWindowVersion!==2){
   if(!Array.isArray(state.dateQ)||state.dateQ.length!==30)fail('Date market version mismatch',500);
   const oldQ=state.dateQ;
   const first=oldQ[0]+LEGACY_B*Math.log(0.5);
   state.dateQ=[first,first,...oldQ.slice(1)];
   for(const u of Object.values(state.users)){
    const oldHold=Array.isArray(u.date)?u.date:Array(29).fill(0);
    if(oldHold.length!==29)fail('Date position length mismatch',500);
    u.date=[0,...oldHold];
   }
   await client.query("UPDATE babymarket_trades SET outcome=outcome+1 WHERE market='date'");
   state.dateWindowVersion=2;changed=true;
  }
  if(await Liquidity.synchronizeLiquidity(state,client))changed=true;
  const cookieToken=cookies(req).bm_session,tokenHash=cookieToken?crypto.createHash('sha256').update(cookieToken).digest('hex'):null;
  const sessions=tokenHash?await client.query('SELECT user_id FROM babymarket_sessions WHERE token_hash=$1',[tokenHash]):{rows:[]};
  let id=sessions.rows[0]?.user_id||null;
  if(req.method==='POST'){
   const b=req.body&&typeof req.body==='object'?req.body:{};
   if(b.action==='login'){
    const email=String(b.email||'').trim().toLowerCase();
    if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('Enter a valid email');
    id=Object.keys(state.users).find(key=>state.users[key].email===email);
    if(!id){
     const name=String(b.name||'').trim().slice(0,45),relationship=String(b.relationship||'').trim().slice(0,35);
     if(!name||!relationship)fail('New accounts require a name and relationship');
     const normalizedRole=relationship.toLowerCase();
     if(normalizedRole==='mom'||normalizedRole==='dad'){
      if(Object.values(state.users).some(user=>(user.relationship||'').trim().toLowerCase()===normalizedRole))
       fail((normalizedRole==='mom'?'Mom':'Dad')+' is already taken. Choose another relationship.',409);
     }
     id=crypto.randomUUID();
     state.users[id]={email,name,relationship:normalizedRole==='mom'?'Mom':normalizedRole==='dad'?'Dad':relationship,joinedAt:new Date().toISOString(),cash:1000,sex:[0,0],date:Array(30).fill(0)};
     changed=true;await Liquidity.synchronizeLiquidity(state,client);recordMarketState(state,'signup');
    }
    const token=crypto.randomBytes(32).toString('hex'),hash=crypto.createHash('sha256').update(token).digest('hex');
    await client.query('INSERT INTO babymarket_sessions(token_hash,user_id) VALUES($1,$2)',[hash,id]);
    res.setHeader('Set-Cookie','bm_session='+token+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000');
   }else if(b.action==='logout'){
    if(tokenHash)await client.query('DELETE FROM babymarket_sessions WHERE token_hash=$1',[tokenHash]);
    res.setHeader('Set-Cookie','bm_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');id=null;
   }else if(b.action==='trade'){
    if(!id||!state.users[id])fail('Sign in first',401);
    const market=b.market,mode=b.mode,index=Number(b.outcome),amount=Number(b.amount);
    if(!['sex','date'].includes(market)||!['buy','sell'].includes(mode)||!Number.isInteger(index)||index<0||index>=(market==='sex'?2:30)||!Number.isFinite(amount)||amount<=0||amount>1000000)
     fail('Invalid trade');
    if(market==='date'&&mode==='buy'&&index===29)fail('This legacy date contract is sell-only',400);
    const user=state.users[id],q=market==='sex'?state.sexQ:state.dateQ,hold=market==='sex'?user.sex:user.date,indices=market==='sex'?[index]:Array.from({length:index+1},(_,i)=>i);
    const depth=liquidity(state);
    let shares;
    if(mode==='buy'){
     if(amount>user.cash+1e-8)fail('Insufficient Sipe Points');
     let lo=0,hi=1;while(Pricing.delta(q,indices,hi,depth)<amount&&hi<10000000)hi*=2;
     for(let i=0;i<48;i++){const mid=(lo+hi)/2;if(Pricing.delta(q,indices,mid,depth)>amount)hi=mid;else lo=mid}
     shares=lo;
    }else{
     if(amount>hold[index]+1e-7)fail('Not enough shares');
     shares=-amount;
    }
    const points=Pricing.delta(q,indices,shares,depth);
    if(!Number.isFinite(points)||!Number.isFinite(shares)||user.cash-points< -1e-6)fail('Trade could not be completed');
    indices.forEach(i=>q[i]+=shares);
    hold[index]=Math.max(0,hold[index]+shares);
    user.cash=Math.max(0,user.cash-points);
    recordMarketState(state,'trade');
    await client.query('INSERT INTO babymarket_trades(user_id,market,outcome,side,shares,points) VALUES($1,$2,$3,$4,$5,$6)',[id,market,index,mode,Math.abs(shares),Math.abs(points)]);
    changed=true;
   }else fail('Unknown action');
  }
  if(changed)await client.query('UPDATE babymarket_state SET data=$1 WHERE id=1',[JSON.stringify(state)]);
  await client.query('COMMIT');inTransaction=false;
  res.status(200).json(visible(state,id&&state.users[id]?id:null));
 }catch(e){
  if(inTransaction&&client)await client.query('ROLLBACK').catch(()=>{});
  console.error('Sipe Exchange API error:',e.message);
  res.status(e.status||500).json({error:e.status?e.message:'Database service unavailable'});
 }finally{if(client)client.release()}
};
