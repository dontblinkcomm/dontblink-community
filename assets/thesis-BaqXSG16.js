import{am as l}from"./index-BMUqBz7x.js";const a="https://dontblink-thesis.lawson-e69.workers.dev",d=t=>`dontblink thesis
stock:${t.stock}
ticker:${t.ticker}
name:${t.name}
pitch:${t.pitch}`,$=(t,s)=>`dontblink follow
dev:${t.toLowerCase()}
on:${s}`,y=(t,s)=>`dontblink bind
thesis:${t}
token:${s.toLowerCase()}`,k=(t,s)=>`dontblink back
thesis:${t}
on:${s}`,p=(t,s)=>`dontblink say
thesis:${t}
text:${s}`,g=(t,s,o="")=>`dontblink devprofile
name:${t}
x:${s}
fomo:${o}`,u=(t,s)=>`dontblink verifyx
dev:${t.toLowerCase()}
tweet:${s}`;async function S(t){const s=[...new Set(t.map(n=>n.toLowerCase()))].slice(0,20);if(!s.length)return{};const o=await fetch(`${a}/profiles?devs=${s.join(",")}`);if(!o.ok)throw new Error(`profiles ${o.status}`);return(await o.json()).profiles??{}}async function E(t,s,o,n=""){const e=s.trim().slice(0,24),r=o.trim().replace(/^@/,""),c=n.trim(),f=await i(t,g(e,r,c)),w=await fetch(`${a}/setprofile`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({dev:t,name:e,x:r,fomo:c,sig:f})}),h=await w.json();if(!w.ok||!h.ok)throw new Error(h.error??`setprofile ${w.status}`)}async function O(t,s){const o=await i(t,u(t,s.trim())),n=await fetch(`${a}/verifyx`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({dev:t,tweet:s.trim(),sig:o})}),e=await n.json();if(!n.ok||!e.ok)throw new Error(e.error??`verifyx ${n.status}`);return e.x}async function v(){let t;for(let s=0;s<3;s++)try{const o=await fetch(`${a}/board`);if(!o.ok)throw new Error(`thesis board ${o.status}`);return(await o.json()).theses??[]}catch(o){t=o,await new Promise(n=>setTimeout(n,800*(s+1)))}throw t instanceof Error?t:new Error("thesis board unreachable")}async function j(t){const s=await fetch(`${a}/profile?dev=${t}`);if(!s.ok)throw new Error(`profile ${s.status}`);const o=await s.json();return{followers:o.followers??[],following:o.following??[],name:o.name??"",x:o.x??"",xVerified:!!o.xVerified,fomo:o.fomo??""}}async function P(t){return(await j(t)).followers}async function x(t){const s=await fetch(`${a}/thesis?id=${t}`);if(!s.ok)throw new Error(s.status===404?"no thesis with that id":`thesis ${s.status}`);return s.json()}async function i(t,s){return l().signMessage({account:t,message:s})}async function T(t,s){const o=await i(t,d(s)),n=await fetch(`${a}/thesis`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...s,author:t,sig:o})}),e=await n.json();if(!n.ok||!e.ok)throw new Error(e.error??`thesis ${n.status}`);return e.id}async function M(t,s,o){const n=await i(t,$(s,o)),e=await fetch(`${a}/follow`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({follower:t,dev:s,on:o,sig:n})}),r=await e.json();if(!e.ok||!r.ok)throw new Error(r.error??`follow ${e.status}`)}async function J(t,s,o){const n=await i(t,y(s,o)),e=await fetch(`${a}/bind`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:s,token:o,author:t,sig:n})}),r=await e.json();if(!e.ok||!r.ok)throw new Error(r.error??`bind ${e.status}`)}async function N(t,s,o){const n=await i(t,k(s,o)),e=await fetch(`${a}/back`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:s,backer:t,on:o,sig:n})}),r=await e.json();if(!e.ok||!r.ok)throw new Error(r.error??`back ${e.status}`)}async function C(t,s,o){const n=await i(t,p(s,o)),e=await fetch(`${a}/say`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:s,addr:t,text:o,sig:n})}),r=await e.json();if(!e.ok||!r.ok)throw new Error(r.error??`say ${e.status}`)}const b=(t,s,o,n)=>`dontblink grant
thesis:${t}
amount:${s}
purpose:${o}
payto:${n.toLowerCase()}`;async function L(t){const s=await fetch(`${a}/grants?thesis=${t}`);if(!s.ok)throw new Error(`grants ${s.status}`);return(await s.json()).grants??[]}async function q(t,s,o,n,e){const r=await i(t,b(s,o,n,e)),c=await fetch(`${a}/grant`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:s,requester:t,amount:o,purpose:n,payto:e,sig:r})}),f=await c.json();if(!c.ok||!f.ok)throw new Error(f.error??`grant ${c.status}`)}export{v as a,J as b,j as c,S as d,N as e,x as f,L as g,P as h,C as i,E as j,T as p,q as r,M as s,O as v};
