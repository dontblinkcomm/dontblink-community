import{ak as c}from"./index-KC9_Ilhb.js";const r="https://dontblink-thesis.lawson-e69.workers.dev",h=t=>`dontblink thesis
stock:${t.stock}
ticker:${t.ticker}
name:${t.name}
pitch:${t.pitch}`,w=(t,s)=>`dontblink follow
dev:${t.toLowerCase()}
on:${s}`,f=(t,s)=>`dontblink back
thesis:${t}
on:${s}`,l=(t,s)=>`dontblink say
thesis:${t}
text:${s}`;async function d(){let t;for(let s=0;s<3;s++)try{const o=await fetch(`${r}/board`);if(!o.ok)throw new Error(`thesis board ${o.status}`);return(await o.json()).theses??[]}catch(o){t=o,await new Promise(a=>setTimeout(a,800*(s+1)))}throw t instanceof Error?t:new Error("thesis board unreachable")}async function y(t){const s=await fetch(`${r}/profile?dev=${t}`);if(!s.ok)throw new Error(`profile ${s.status}`);return(await s.json()).followers??[]}async function $(t){const s=await fetch(`${r}/thesis?id=${t}`);if(!s.ok)throw new Error(s.status===404?"no thesis with that id":`thesis ${s.status}`);return s.json()}async function i(t,s){return c().signMessage({account:t,message:s})}async function p(t,s){const o=await i(t,h(s)),a=await fetch(`${r}/thesis`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...s,author:t,sig:o})}),e=await a.json();if(!a.ok||!e.ok)throw new Error(e.error??`thesis ${a.status}`);return e.id}async function u(t,s,o){const a=await i(t,w(s,o)),e=await fetch(`${r}/follow`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({follower:t,dev:s,on:o,sig:a})}),n=await e.json();if(!e.ok||!n.ok)throw new Error(n.error??`follow ${e.status}`)}async function b(t,s,o){const a=await i(t,f(s,o)),e=await fetch(`${r}/back`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:s,backer:t,on:o,sig:a})}),n=await e.json();if(!e.ok||!n.ok)throw new Error(n.error??`back ${e.status}`)}async function j(t,s,o){const a=await i(t,l(s,o)),e=await fetch(`${r}/say`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:s,addr:t,text:o,sig:a})}),n=await e.json();if(!e.ok||!n.ok)throw new Error(n.error??`say ${e.status}`)}export{$ as a,y as b,u as c,j as d,d as f,p,b as s};
