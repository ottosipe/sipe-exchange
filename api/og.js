const sharp=require('sharp');
const {Pool}=require('pg');
const zlib=require('zlib');
const outlinedText=zlib.gunzipSync(Buffer.from("H4sIAH9w+WoC/5VZTY8cNw69768ozF6Sw7QlihIpwM6lLn1oX/swt0EyEwdwNoHtBfbn73uUejzTVR3APoxYVfogH8lHqv3+t6fnr7+8//vx26flj98+3P36qbW7BcLHnPOSjqay5uQQlyxNl2x5CCppDaEVWXIWXaylpassZnY262vOqS0uXJj60ksdAl7bOqRS2pKTQNKeFksewhEnP3zULIuonFvpR0u6eu04CvvUtNSWY9RiK8eSy+LVOH9pvXMcG7jlM1TzY/O6DlXUl54KtLA6hFT7SqGrhrZYs2A6x4e7d2+gsTKg0dxfND2nIx6vZ7q8BhETzlUytOhrg6WQoWeeo3A89dowM4u3U3dbagBYAS/eZ6kwMOkQckp5HVJJ8EbScgHQ3gDY4RKH/UVxsgNBuq4ooKPHsCoE7kaBAHMK1sD+WLuxSqf9dKW0o3aD+Z7qOR6hUzuHAlo30G0AaeJHgC/YIZfax8J44V1ixost12qkDbhZjq1XRGoBunA8/IyAJDoUJmKUBmIAIRBjsFwhZomIYTs4wJU7Ib47IQ7EdOJPIRCLgMdOFmuvVW39tao5ezojZ6b9ihdSzu55mBsYcsotw5uP3VqxBdmXujIti5VFEDIhmLY1BGQYVUWUDUtnkIyQHbYKUZeCuBRde2RHITptZMWQYkMKShxEuGppCFyMG/1s6GdIoXvsCfMSBajm2D10EcS2FKoBFkhArTAjEXfMTENSYlyZGHymIap5GZbpGoYl7dgifCyxgkKEcLwJtoKz+Ce3pbd65Knr0EG6L6FWrhkRQjaDsJY2hIW2Cz63cSAGwZzSJOyYhm2Ce3rZWp12tzbsViSTIDxC4IYhZCGBcNLQAsumFvpKi9zfaCELP4cW45iHOC/gKvU7XOJXcEH3WuqEq13g6vMNSMbHpJBCRwrch5PCLeOcjdm+yeme18iiWhfNvrjLQh5GxvmqHeUgqA164ISWKxIwncKhJAHTCwk0VJBaGHfGKdTPwfqI8YTFWlmTwPkVodixuOFlJ5DiJ6WpN/LH7K3C5YyaA4VJrrYo6k83VDYSbS6yKqxA+Cw1oRokEAvKFRacrEcyJ80nxFPhO0SXcBI52QzbkFeEoUYzFE7rzlfEhHhQwDJyn70wHQIFYCBBrDPn0iiJvdJQFLwMFaWsoIt49qLx3VFlseBUW7ppeKvDcOJcoLYCNCgMG1I7YX6iPVpRhWTW4FpQQvEH3sJxDiOlIg5xLMxrZqNuG/lCELnmOt54STHFrXEJNmzcYuOJeh06mtOpIV9R4wECCQ4R0eXkmSQLLYnrDA/4oGlERVorsqhDR0UddegZ4dfrTQ4FPYyjywv3J4Uf8Hg9tc9wIWfdZ6QZXIgR1RGtB8xj96LoTjTRj0n8bJmOY+Ygs5w5lQyBG2lovooPgcyEKWiXEAUix2J1LUgVxo+i5rOw1BbjytjmswESVNoYTZAf6L8oN/Beaz0IXgE6uRx1eGmIYmzBmMUA2lu5IXokYEwjplFwMjsxN6RB4gg+bgvrAMeS2hojclDhSRVSL+KQpCTMRCgGpZSEg+YMTjgXbytlMlZjy8GUH2dsAJ68Wd2DNx12BG2m4GWChbgq3Y7WbTUAh/ZoMYCHmFsqPM7YgzLxXJCuBdnPEUquHIESlC1Rpjkf42owNMq2k0oZLUCv5SMPI+WwLwTWZOcET1M5CisLwXwDjygHHoNBkKpkeeo+bdmGXb7Y2oatKtNWZYMXdYv6y9ERROYszyAAOqUDQNI1MFAdzwXfWMoKWjFEDHTv7VwLKZMsC8vJtENbaxf9y3f9WUNf6Q+Xz5I19Xv4WBTBBbgKixBpEUc6AqsyUCtUBH3zmUHL787MQON9bbhMw9F6LffgvSOIZ1WmEkmwgkvvC8KlQY/73MqJPRH7jwYg7MSWvxZEW9aINs5nqlQUBEZnZXTyOaIRYQ1QMP9UJI9Nspx4Dt7wSCtR6u/ZWRcQKDIApa0NAYSzaeCQqdNvPYrv2nMdfsvkPoAdAoEMwaEDpwygu16g11eh46+g5w78GtCPIx7iLMlAiW1RrjOy81VkExBGdI6FGIMP+BylAd85cj5Hrrfisd/cf2vrhfCMNgpS3DhinZLwSD9oWoLsOmp1+Cilsza0ykiBQnrC9uyYK+qisIYiLfhMti1IK46oPmMxmbdE286rjUfE87x5/la/ef/g/GDsM3qJlVuyEKmzuKKnANlgXFuNESoxOHPwtWd016kBquhKwNAtOBkx3nR0vGvNaZkdLwWEd+mse+1Y3F8U33DZLCuWemDXPWyYbV50nRCq9NEdOtits1FlOSCjRYGoESd4E11ioouBa8/D2DfVChWuoXKgU9BKWJHnA7ypwANuCXABypY6vY10Ib+APzhSD47GpsIZPWx5yZOoKiAMPpONUWli5HyOEUX4zv3m/lsvzR8QhlWV10QoW1SP4MmJn58d7QefhekBI90jPthlsUvB4jOvJhWFq+IwViRlO4rE5VikxRa2U+HzbC4qiP9e2soWAiOUoUbheAhFyJYQ1JiyJQA0aNJAGZVjHc1sI9WwZ2UkRO+KDGRVZm0hZi0oiiM6JB+4scawMcNphps/omFlU9iRnaw3oy8IndgX1EsgsHNoHHjt4hRQGwsodUQ3hPP8VI29KrITITp8yNonMUonMWvA1UDgpLcKnTCuSl71wSbCOFCNelPRvhETEuEAagJ3DaxOx0aaIrBYfEYrwSoTQ0ZrzlFIy0o3SWQ1xjWjWPDZc3xm8GM2u1noWUdXMrfetIv5crGUecGqPi9Y4BbySwgtydk6KmhCMax+JCPzEjpuRMzIuM14mpfM9v3WVK5vTZWkfrk1sYSOS6ZeLpnsRnP8LABX9555yRReMuNHBr5nzzOud3a53tWbl0z2OTXNS6bsdxD1mv1euOhjRFB2JLV6CNEH8weZIaCJW8evVqXFjTtX6BirIKwsh/GGZMgpHLmGIzeJCTmaknFQaPcufjz81/vfl+c/Pn/+cPdvK4+Pz893y7cvj//5+vzXlz8/3IX4+fHb009IuAMva+Xn5euvj5+ffkoHXOLY395fpJ/vfnn/369Py6cvT8/YbvwY+b8Pd/ieeOCbb/w1Dt9yT/WAynD9mT/B4XNJkg7St581PmsvdtCy3Xysbg6lq21Xp/jceyoHb7fORkF12VOdPwvxe2m97+nOH3r4vYJ395S/mI57dtrTnj/E8Dua2Lqr/jBeEjqGA5Lrxv4iTXbts6G/IFX6rmuG/lLRie7ZZ0M/cdzed/Wvw3cAaF//6VvcZfOu/nM9LrC+p//EH+pn39N/4oO6rz71f/f760B/1me7Gehi7UCOcHkV6Wh6ZER6SJtInxG1G+lxZ6U/QVcH9c33Pt1tqR361to+vWVd98COqwmtdcfyLZjRweM76kg7+NYZ0SIzV3D9PJS6832oZw2Z6Dvn54G2m9VD2Vrfh/HdHbnQbqrP/27wg+nO/m2il00PIjsT6pzgrgfbaqBzgxJUYzvhEP9u8V4BBxRW+1fhgKPYp12kHyK+C+C5yP736TAU00t2/oC6BhT5K/oPqWv5n6J3wluT7ZtzYaP8j9EvuGV+N+f/FcaEb7kaAAA=",'base64')).toString('utf8');
const pool=new Pool({
 connectionString:process.env.POSTGRES_URL||process.env.DATABASE_URL,
 max:2,idleTimeoutMillis:10000,connectionTimeoutMillis:8000
});
let lastImage=null,lastSignature='';
function probability(q){
 if(!Array.isArray(q)||q.length!==2)return null;
 const boy=Number(q[0]),girl=Number(q[1]),b=2600;
 if(!Number.isFinite(boy)||!Number.isFinite(girl))return null;
 return 1/(1+Math.exp((girl-boy)/b));
}
function sanitizeHistory(history,sexQ){
 let prices=Array.isArray(history)?history.map(x=>Number(x&&x.sex)).filter(v=>Number.isFinite(v)&&v>=0&&v<=1):[];
 const now=probability(sexQ);
 if(prices.length===0)prices=[.5];
 if(now!==null&&Math.abs(prices[prices.length-1]-now)>1e-8)prices.push(now);
 else if(now!==null)prices[prices.length-1]=now;
 if(prices.length===1)prices=[prices[0],prices[0]];
 return prices;
}
function svgFromPrices(prices){
 const values=prices.flatMap(v=>[v,1-v]);
 const low=Math.max(0,Math.min(...values)-.025),high=Math.min(1,Math.max(...values)+.025);
 const diff=Math.max(.07,high-low),mid=(low+high)/2,bottom=Math.max(0,mid-diff/2),top=Math.min(1,mid+diff/2);
 const spread=Math.max(.001,top-bottom);
 const x=i=>157+(886*i)/(prices.length-1),y=v=>250+(top-v)/spread*155;
 const line=fn=>prices.map((v,i)=>(i===0?'M ':'L ')+x(i).toFixed(2)+' '+y(fn(v)).toFixed(2)).join(' ');
 const boy=line(v=>v),girl=line(v=>1-v),last=prices[prices.length-1],endX=x(prices.length-1).toFixed(2);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#07172e"/><stop offset=".54" stop-color="#09172d"/><stop offset="1" stop-color="#081326"/></linearGradient>
<radialGradient id="soft" cx=".51" cy=".45" r=".69"><stop stop-color="#1b3965" stop-opacity=".26"/><stop offset="1" stop-color="#0b1e3d" stop-opacity="0"/></radialGradient>
<linearGradient id="boy" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#3496ff"/><stop offset="1" stop-color="#2b78ed"/></linearGradient>
<linearGradient id="girl" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fa7ebf"/><stop offset="1" stop-color="#ee64ab"/></linearGradient></defs>
<rect width="1200" height="630" fill="url(#bg)"/><rect width="1200" height="630" fill="url(#soft)"/>
<path d="M 157 328 H 1043" stroke="#527093" stroke-width="2" stroke-dasharray="5 11" opacity=".15"/>
<path d="${boy}" stroke="#489cff" fill="none" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
<path d="${girl}" stroke="#fb7dbc" fill="none" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="${endX}" cy="${y(last).toFixed(2)}" r="5" fill="#489cff"/>
<circle cx="${endX}" cy="${y(1-last).toFixed(2)}" r="5" fill="#fb7dbc"/>
<rect x="187" y="451" width="395" height="112" rx="32" fill="url(#boy)"/>
<rect x="618" y="451" width="395" height="112" rx="32" fill="url(#girl)"/>
${outlinedText}
</svg>`;
}
module.exports=async function handler(req,res){
 if(req.method!=='GET'&&req.method!=='HEAD'){
  res.setHeader('Allow','GET, HEAD');return res.status(405).end();
 }
 try{
  const r=await pool.query("SELECT data->'history' AS history, data->'sexQ' AS sex_q FROM public.babymarket_state WHERE id=1");
  if(!r.rows[0])throw new Error('Missing market state');
  const prices=sanitizeHistory(r.rows[0].history,r.rows[0].sex_q);
  const signature=prices.length+':'+prices[prices.length-1]+':'+prices.reduce((a,b)=>a+b,0);
  if(!lastImage||signature!==lastSignature){
   lastImage=await sharp(Buffer.from(svgFromPrices(prices))).png({compressionLevel:9}).toBuffer();
   lastSignature=signature;
  }
  res.setHeader('Content-Type','image/png');
  res.setHeader('Cache-Control','public, max-age=60, s-maxage=60, stale-while-revalidate=120');
  res.setHeader('Content-Length',String(lastImage.length));
  if(req.method==='HEAD')return res.status(200).end();
  return res.status(200).send(lastImage);
 }catch(err){
  console.error('Social image generation failed',err);
  if(lastImage){res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','no-store');return res.status(200).send(lastImage)}
  return res.status(503).end('Share preview unavailable');
 }
};
