'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Pricing=require('../pricing');
const Liquidity=require('../api/liquidity');
function state(count){return {users:Object.fromEntries(Array.from({length:count},(_,i)=>['u'+i,{}])),sexQ:[1000,300],dateQ:Array.from({length:31},(_,i)=>i*6)}}
test('one player starts at 1000 and 28 players imply 5291.50',()=>{
 assert.equal(Pricing.marketLiquidity(1000),1000);
 assert.ok(Math.abs(Liquidity.liquidity(state(28))-5291.502622)<1e-5);
});
test('trades do not mint SP; extra issuance and burns change depth',()=>{
 const s=state(28),base=Liquidity.economy(s).issuedSP;
 s.sexQ[0]+=1234;
 assert.equal(Liquidity.economy(s).issuedSP,base);
 s.additionalIssuedSP=2800;
 assert.equal(Liquidity.economy(s).issuedSP,30800);
 s.burnedSP=800;
 assert.equal(Liquidity.economy(s).issuedSP,30000);
});
test('liquidity transitions retain sex/date probabilities and holdings',async()=>{
 const s=state(28),beforeSex=Pricing.softmax(s.sexQ,Pricing.LEGACY_LIQUIDITY),beforeDate=Pricing.softmax(s.dateQ,Pricing.LEGACY_LIQUIDITY);
 s.users.u0={cash:800,sex:[10,0],date:[5]};
 const user=JSON.stringify(s.users.u0);
 const client={query:async()=>({rows:[{id:'33'}]})};
 assert.equal(await Liquidity.synchronizeLiquidity(s,client),true);
 assert.equal(JSON.stringify(s.users.u0),user);
 for(let i=0;i<2;i++)assert.ok(Math.abs(Pricing.softmax(s.sexQ,Liquidity.liquidity(s))[i]-beforeSex[i])<1e-12);
 for(let i=0;i<31;i++)assert.ok(Math.abs(Pricing.softmax(s.dateQ,Liquidity.liquidity(s))[i]-beforeDate[i])<1e-12);
 assert.equal(s.liquidityRebases[0].afterTradeId,'33');
 assert.equal(await Liquidity.synchronizeLiquidity(s,client),false);
 s.users.u28={cash:1000};
 const p=Pricing.softmax(s.sexQ,Liquidity.liquidity(s)/Math.sqrt(29/28));
 await Liquidity.synchronizeLiquidity(s,client);
 assert.ok(Math.abs(Pricing.softmax(s.sexQ,Liquidity.liquidity(s))[0]-p[0])<1e-12);
});
