import{ak as c}from"./index-YVneVa2R.js";const n="https://dontblink-thesis.lawson-e69.workers.dev",w=t=>`dontblink thesis
stock:${t.stock}
ticker:${t.ticker}
name:${t.name}
pitch:${t.pitch}`,l=(t,o)=>`dontblink follow
dev:${t.toLowerCase()}
on:${o}`;async function f(){let t;for(let o=0;o<3;o++)try{const s=await fetch(`${n}/board`);if(!s.ok)throw new Error(`thesis board ${s.status}`);return(await s.json()).theses??[]}catch(s){t=s,await new Promise(e=>setTimeout(e,800*(o+1)))}throw t instanceof Error?t:new Error("thesis board unreachable")}async function d(t){const o=await fetch(`${n}/profile?dev=${t}`);if(!o.ok)throw new Error(`profile ${o.status}`);return(await o.json()).followers??[]}async function i(t,o){return c().signMessage({account:t,message:o})}async function k(t,o){const s=await i(t,w(o)),e=await fetch(`${n}/thesis`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...o,author:t,sig:s})}),r=await e.json();if(!e.ok||!r.ok)throw new Error(r.error??`thesis ${e.status}`);return r.id}async function p(t,o,s){const e=await i(t,l(o,s)),r=await fetch(`${n}/follow`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({follower:t,dev:o,on:s,sig:e})}),a=await r.json();if(!r.ok||!a.ok)throw new Error(a.error??`follow ${r.status}`)}export{d as a,f,k as p,p as s};
