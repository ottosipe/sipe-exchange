'use strict';
const Pricing=require('../pricing');
function economy(state){
 const participants=Object.keys(state.users||{}).length;
 // Grants are 1,000 SP per player. Other issuance (including future dividends)
 // and burns are tracked separately so purchases/sales do not change supply.
 const additionalIssuedSP=Number(state.additionalIssuedSP||0);
 const burnedSP=Number(state.burnedSP||0);
 if(!Number.isFinite(additionalIssuedSP)||additionalIssuedSP<0||!Number.isFinite(burnedSP)||burnedSP<0)
  throw new Error('Invalid supply adjustments');
 const issuedSP=participants*Pricing.SP_PER_PARTICIPANT+additionalIssuedSP-burnedSP;
 if(issuedSP<0)throw new Error('Supply cannot be negative');
 return {participants,issuedSP};
}
function liquidity(state){return Pricing.marketLiquidity(economy(state).issuedSP)}
// Keep LMSR logits (q_i / b) unchanged at every supply transition. q is
// effective market-maker inventory; player holdings and trade rows stay intact.
// Persist a rebase marker so the historical share replay can reproduce prices.
async function synchronizeLiquidity(state,client){
 const previous=state.pricingLiquidity==null?Pricing.LEGACY_LIQUIDITY:Number(state.pricingLiquidity);
 if(!Number.isFinite(previous)||previous<=0)throw new Error('Invalid previous liquidity');
 const next=liquidity(state);
 if(Math.abs(next-previous)<=1e-9)return false;
 const factor=next/previous;
 for(const field of ['sexQ','dateQ']){
  if(!Array.isArray(state[field])||!state[field].every(Number.isFinite))throw new Error('Invalid inventory '+field);
  state[field]=state[field].map(x=>x*factor);
 }
 const last=await client.query('SELECT COALESCE(MAX(id),0)::text AS id FROM babymarket_trades');
 if(!Array.isArray(state.liquidityRebases))state.liquidityRebases=[];
 state.liquidityRebases.push({afterTradeId:String(last.rows[0].id),factor,liquidity:next});
 state.pricingLiquidity=next;
 return true;
}
module.exports={economy,liquidity,synchronizeLiquidity};
