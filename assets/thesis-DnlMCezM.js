import{ao as l}from"./index-cqblDm53.js";const a="https://dontblink-thesis.lawson-e69.workers.dev",d=t=>`dontblink thesis
stock:${t.stock}
ticker:${t.ticker}
name:${t.name}
pitch:${t.pitch}`,$=(t,o)=>`dontblink follow
dev:${t.toLowerCase()}
on:${o}`,y=(t,o)=>`dontblink bind
thesis:${t}
token:${o.toLowerCase()}`,k=(t,o)=>`dontblink back
thesis:${t}
on:${o}`,p=(t,o)=>`dontblink say
thesis:${t}
text:${o}`,g=(t,o,s="")=>`dontblink devprofile
name:${t}
x:${o}
fomo:${s}`,u=(t,o)=>`dontblink verifyx
dev:${t.toLowerCase()}
tweet:${o}`;async function S(t){const o=[...new Set(t.map(n=>n.toLowerCase()))].slice(0,20);if(!o.length)return{};const s=await fetch(`${a}/profiles?devs=${o.join(",")}`);if(!s.ok)throw new Error(`profiles ${s.status}`);return(await s.json()).profiles??{}}async function E(t,o,s,n=""){const e=o.trim().slice(0,24),r=s.trim().replace(/^@/,""),c=n.trim(),f=await i(t,g(e,r,c)),w=await fetch(`${a}/setprofile`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({dev:t,name:e,x:r,fomo:c,sig:f})}),h=await w.json();if(!w.ok||!h.ok)throw new Error(h.error??`setprofile ${w.status}`)}async function O(t,o){const s=await i(t,u(t,o.trim())),n=await fetch(`${a}/verifyx`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({dev:t,tweet:o.trim(),sig:s})}),e=await n.json();if(!n.ok||!e.ok)throw new Error(e.error??`verifyx ${n.status}`);return e.x}async function v(){let t;for(let o=0;o<3;o++)try{const s=await fetch(`${a}/board`);if(!s.ok)throw new Error(`thesis board ${s.status}`);return(await s.json()).theses??[]}catch(s){t=s,await new Promise(n=>setTimeout(n,800*(o+1)))}throw t instanceof Error?t:new Error("thesis board unreachable")}async function j(t){const o=await fetch(`${a}/profile?dev=${t}`);if(!o.ok)throw new Error(`profile ${o.status}`);const s=await o.json();return{followers:s.followers??[],following:s.following??[],name:s.name??"",x:s.x??"",xVerified:!!s.xVerified,fomo:s.fomo??""}}async function P(t){return(await j(t)).followers}async function x(t){const o=await fetch(`${a}/thesis?id=${t}`);if(!o.ok)throw new Error(o.status===404?"no thesis with that id":`thesis ${o.status}`);return o.json()}async function i(t,o){return l().signMessage({account:t,message:o})}async function T(t,o){const s=await i(t,d(o)),n=await fetch(`${a}/thesis`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...o,author:t,sig:s})}),e=await n.json();if(!n.ok||!e.ok)throw new Error(e.error??`thesis ${n.status}`);return e.id}async function M(t,o,s){const n=await i(t,$(o,s)),e=await fetch(`${a}/follow`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({follower:t,dev:o,on:s,sig:n})}),r=await e.json();if(!e.ok||!r.ok)throw new Error(r.error??`follow ${e.status}`)}async function J(t,o,s){const n=await i(t,y(o,s)),e=await fetch(`${a}/bind`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:o,token:s,author:t,sig:n})}),r=await e.json();if(!e.ok||!r.ok)throw new Error(r.error??`bind ${e.status}`)}async function N(t,o,s){const n=await i(t,k(o,s)),e=await fetch(`${a}/back`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:o,backer:t,on:s,sig:n})}),r=await e.json();if(!e.ok||!r.ok)throw new Error(r.error??`back ${e.status}`)}async function C(t,o,s){const n=await i(t,p(o,s)),e=await fetch(`${a}/say`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:o,addr:t,text:s,sig:n})}),r=await e.json();if(!e.ok||!r.ok)throw new Error(r.error??`say ${e.status}`)}const b=(t,o,s,n)=>`dontblink grant
thesis:${t}
amount:${o}
purpose:${s}
payto:${n.toLowerCase()}`;async function L(t){const o=await fetch(`${a}/grants?thesis=${t}`);if(!o.ok)throw new Error(`grants ${o.status}`);return(await o.json()).grants??[]}async function q(t,o,s,n,e){const r=await i(t,b(o,s,n,e)),c=await fetch(`${a}/grant`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:o,requester:t,amount:s,purpose:n,payto:e,sig:r})}),f=await c.json();if(!c.ok||!f.ok)throw new Error(f.error??`grant ${c.status}`)}export{v as a,J as b,j as c,S as d,N as e,x as f,L as g,P as h,C as i,E as j,T as p,q as r,M as s,O as v};
