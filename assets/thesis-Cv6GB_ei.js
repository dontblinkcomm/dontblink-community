import{ak as c}from"./index-NJHFmhMj.js";const r="https://dontblink-thesis.lawson-e69.workers.dev",w=t=>`dontblink thesis
stock:${t.stock}
ticker:${t.ticker}
name:${t.name}
pitch:${t.pitch}`,f=(t,o)=>`dontblink follow
dev:${t.toLowerCase()}
on:${o}`;async function h(){const t=await fetch(`${r}/board`);if(!t.ok)throw new Error(`thesis board ${t.status}`);return(await t.json()).theses??[]}async function d(t){const o=await fetch(`${r}/profile?dev=${t}`);if(!o.ok)throw new Error(`profile ${o.status}`);return(await o.json()).followers??[]}async function i(t,o){return c().signMessage({account:t,message:o})}async function k(t,o){const n=await i(t,w(o)),e=await fetch(`${r}/thesis`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...o,author:t,sig:n})}),s=await e.json();if(!e.ok||!s.ok)throw new Error(s.error??`thesis ${e.status}`);return s.id}async function p(t,o,n){const e=await i(t,f(o,n)),s=await fetch(`${r}/follow`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({follower:t,dev:o,on:n,sig:e})}),a=await s.json();if(!s.ok||!a.ok)throw new Error(a.error??`follow ${s.status}`)}export{d as a,h as f,k as p,p as s};
