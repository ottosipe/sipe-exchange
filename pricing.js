(function(){
'use strict';
const SP_PER_PARTICIPANT=1000;
// The 2,600 coefficient is retained only to migrate historical market inventory.
const LEGACY_LIQUIDITY=2600;
function marketLiquidity(issuedSP){
 if(!Number.isFinite(issuedSP)||issuedSP<0)throw new Error('Invalid outstanding SP supply');
 return Math.sqrt(1000*Math.max(1000,issuedSP));
}
function liquidityFromMembers(members){
 if(!Number.isInteger(members)||members<0)throw new Error('Invalid participant count');
 return marketLiquidity(members*SP_PER_PARTICIPANT);
}
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
const shared={SP_PER_PARTICIPANT,LEGACY_LIQUIDITY,marketLiquidity,liquidityFromMembers,softmax,cost,delta,boyProbability};
if(typeof module!=='undefined'&&module.exports)module.exports=shared;
if(typeof window!=='undefined')window.SipePricing=shared;
})();