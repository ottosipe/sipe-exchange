(function(){
'use strict';
const SP_PER_PARTICIPANT=1000;
// Change FIXED_LIQUIDITY and redeploy: live trading, quotes, and the history replay all update.
const FIXED_LIQUIDITY=2600;
function marketLiquidity(){return FIXED_LIQUIDITY}
// Backwards-compatible entrypoint used by existing market clients and server.
// Registrations no longer change prices.
function liquidityFromMembers(_members){return marketLiquidity()}
function softmax(q,b){
 if(!Array.isArray(q)||!q.length||!Number.isFinite(b)||b<=0)throw new Error('Invalid market parameters');
 const m=Math.max(...q),weights=q.map(v=>Math.exp((v-m)/b));
 const sum=weights.reduce((a,v)=>a+v,0);
 return weights.map(v=>v/sum);
}
function cost(q,b){
 if(!Array.isArray(q)||!q.length||!Number.isFinite(b)||b<=0)throw new Error('Invalid market parameters');
 const m=Math.max(...q);
 return m+b*Math.log(q.reduce((a,v)=>a+Math.exp((v-m)/b),0));
}
function delta(q,indices,shares,b){
 const next=q.slice();
 for(const i of indices)next[i]+=shares;
 return cost(next,b)-cost(q,b);
}
function boyProbability(q,b){return softmax(q,b)[0]}
const shared={SP_PER_PARTICIPANT,FIXED_LIQUIDITY,marketLiquidity,liquidityFromMembers,softmax,cost,delta,boyProbability};
if(typeof module!=='undefined'&&module.exports)module.exports=shared;
if(typeof window!=='undefined')window.SipePricing=shared;
})();