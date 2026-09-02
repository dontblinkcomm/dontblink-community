import{al as f}from"./index-BCSzrjsl.js";const a="https://dontblink-thesis.lawson-e69.workers.dev",h=t=>`dontblink thesis
stock:${t.stock}
ticker:${t.ticker}
name:${t.name}
pitch:${t.pitch}`,l=(t,s)=>`dontblink follow
dev:${t.toLowerCase()}
on:${s}`,$=(t,s)=>`dontblink bind
thesis:${t}
token:${s.toLowerCase()}`,d=(t,s)=>`dontblink back
thesis:${t}
on:${s}`,y=(t,s)=>`dontblink say
thesis:${t}
text:${s}`,k=(t,s)=>`dontblink devprofile
name:${t}
x:${s}`;async function j(t){const s=[...new Set(t.map(e=>e.toLowerCase()))].slice(0,20);if(!s.length)return{};const o=await fetch(`${a}/profiles?devs=${s.join(",")}`);if(!o.ok)throw new Error(`profiles ${o.status}`);return(await o.json()).profiles??{}}async function b(t,s,o){const e=s.trim().slice(0,24),n=o.trim().replace(/^@/,""),r=await c(t,k(e,n)),i=await fetch(`${a}/setprofile`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({dev:t,name:e,x:n,sig:r})}),w=await i.json();if(!i.ok||!w.ok)throw new Error(w.error??`setprofile ${i.status}`)}async function m(){let t;for(let s=0;s<3;s++)try{const o=await fetch(`${a}/board`);if(!o.ok)throw new Error(`thesis board ${o.status}`);return(await o.json()).theses??[]}catch(o){t=o,await new Promise(e=>setTimeout(e,800*(s+1)))}throw t instanceof Error?t:new Error("thesis board unreachable")}async function p(t){const s=await fetch(`${a}/profile?dev=${t}`);if(!s.ok)throw new Error(`profile ${s.status}`);const o=await s.json();return{followers:o.followers??[],following:o.following??[],name:o.name??"",x:o.x??""}}async function E(t){return(await p(t)).followers}async function S(t){const s=await fetch(`${a}/thesis?id=${t}`);if(!s.ok)throw new Error(s.status===404?"no thesis with that id":`thesis ${s.status}`);return s.json()}async function c(t,s){return f().signMessage({account:t,message:s})}async function O(t,s){const o=await c(t,h(s)),e=await fetch(`${a}/thesis`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...s,author:t,sig:o})}),n=await e.json();if(!e.ok||!n.ok)throw new Error(n.error??`thesis ${e.status}`);return n.id}async function P(t,s,o){const e=await c(t,l(s,o)),n=await fetch(`${a}/follow`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({follower:t,dev:s,on:o,sig:e})}),r=await n.json();if(!n.ok||!r.ok)throw new Error(r.error??`follow ${n.status}`)}async function T(t,s,o){const e=await c(t,$(s,o)),n=await fetch(`${a}/bind`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:s,token:o,author:t,sig:e})}),r=await n.json();if(!n.ok||!r.ok)throw new Error(r.error??`bind ${n.status}`)}async function M(t,s,o){const e=await c(t,d(s,o)),n=await fetch(`${a}/back`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:s,backer:t,on:o,sig:e})}),r=await n.json();if(!n.ok||!r.ok)throw new Error(r.error??`back ${n.status}`)}async function J(t,s,o){const e=await c(t,y(s,o)),n=await fetch(`${a}/say`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:s,addr:t,text:o,sig:e})}),r=await n.json();if(!n.ok||!r.ok)throw new Error(r.error??`say ${n.status}`)}const g=(t,s,o,e)=>`dontblink grant
thesis:${t}
amount:${s}
purpose:${o}
payto:${e.toLowerCase()}`;async function N(t){const s=await fetch(`${a}/grants?thesis=${t}`);if(!s.ok)throw new Error(`grants ${s.status}`);return(await s.json()).grants??[]}async function x(t,s,o,e,n){const r=await c(t,g(s,o,e,n)),i=await fetch(`${a}/grant`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:s,requester:t,amount:o,purpose:e,payto:n,sig:r})}),w=await i.json();if(!i.ok||!w.ok)throw new Error(w.error??`grant ${i.status}`)}export{m as a,T as b,j as c,M as d,N as e,S as f,E as g,J as h,p as i,b as j,O as p,x as r,P as s};
