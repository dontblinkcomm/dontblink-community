import{ak as c}from"./index-BX0pQO0A.js";const r="https://dontblink-thesis.lawson-e69.workers.dev",w=t=>`dontblink thesis
stock:${t.stock}
ticker:${t.ticker}
name:${t.name}
pitch:${t.pitch}`,h=(t,s)=>`dontblink follow
dev:${t.toLowerCase()}
on:${s}`,f=(t,s)=>`dontblink bind
thesis:${t}
token:${s.toLowerCase()}`,l=(t,s)=>`dontblink back
thesis:${t}
on:${s}`,d=(t,s)=>`dontblink say
thesis:${t}
text:${s}`;async function $(){let t;for(let s=0;s<3;s++)try{const o=await fetch(`${r}/board`);if(!o.ok)throw new Error(`thesis board ${o.status}`);return(await o.json()).theses??[]}catch(o){t=o,await new Promise(e=>setTimeout(e,800*(s+1)))}throw t instanceof Error?t:new Error("thesis board unreachable")}async function k(t){const s=await fetch(`${r}/profile?dev=${t}`);if(!s.ok)throw new Error(`profile ${s.status}`);const o=await s.json();return{followers:o.followers??[],following:o.following??[]}}async function b(t){return(await k(t)).followers}async function p(t){const s=await fetch(`${r}/thesis?id=${t}`);if(!s.ok)throw new Error(s.status===404?"no thesis with that id":`thesis ${s.status}`);return s.json()}async function i(t,s){return c().signMessage({account:t,message:s})}async function u(t,s){const o=await i(t,w(s)),e=await fetch(`${r}/thesis`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...s,author:t,sig:o})}),n=await e.json();if(!e.ok||!n.ok)throw new Error(n.error??`thesis ${e.status}`);return n.id}async function g(t,s,o){const e=await i(t,h(s,o)),n=await fetch(`${r}/follow`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({follower:t,dev:s,on:o,sig:e})}),a=await n.json();if(!n.ok||!a.ok)throw new Error(a.error??`follow ${n.status}`)}async function j(t,s,o){const e=await i(t,f(s,o)),n=await fetch(`${r}/bind`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:s,token:o,author:t,sig:e})}),a=await n.json();if(!n.ok||!a.ok)throw new Error(a.error??`bind ${n.status}`)}async function m(t,s,o){const e=await i(t,l(s,o)),n=await fetch(`${r}/back`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:s,backer:t,on:o,sig:e})}),a=await n.json();if(!n.ok||!a.ok)throw new Error(a.error??`back ${n.status}`)}async function E(t,s,o){const e=await i(t,d(s,o)),n=await fetch(`${r}/say`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:s,addr:t,text:o,sig:e})}),a=await n.json();if(!n.ok||!a.ok)throw new Error(a.error??`say ${n.status}`)}export{$ as a,j as b,b as c,g as d,E as e,p as f,k as g,u as p,m as s};
