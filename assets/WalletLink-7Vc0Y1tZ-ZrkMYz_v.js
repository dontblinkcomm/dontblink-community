import{b$ as g,d8 as n}from"./index-7nprfxPV.js";import{o as j,g as s}from"./Buy-CfL8b3_A.js";import{l as $,i as a,n as d,c as p}from"./ethers-DKNnmkib-CfVxDICf.js";import{r as k}from"./getFormattedUsdFromLamports-De3U9GlO-C446pzMl.js";import{t as y}from"./transaction-BNTP-bFm-CrebgH-D.js";const P=({weiQuantities:e,tokenPrice:r,tokenSymbol:o})=>{let i=a(e),t=r?d(i,r):void 0,l=p(i,o);return n.jsx(c,{children:t||l})},D=({weiQuantities:e,tokenPrice:r,tokenSymbol:o})=>{let i=a(e),t=r?d(i,r):void 0,l=p(i,o);return n.jsx(c,{children:t?n.jsxs(n.Fragment,{children:[n.jsx(S,{children:"USD"}),t==="<$0.01"?n.jsxs(x,{children:[n.jsx(h,{children:"<"}),"$0.01"]}):t]}):l})},F=({quantities:e,tokenPrice:r,tokenSymbol:o="SOL",tokenDecimals:i=9})=>{let t=e.reduce((f,u)=>f+u,0n),l=r&&o==="SOL"&&i===9?k(t,r):void 0,m=o==="SOL"&&i===9?y(t):`${g(t,i)} ${o}`;return n.jsx(c,{children:l?n.jsx(n.Fragment,{children:l==="<$0.01"?n.jsxs(x,{children:[n.jsx(h,{children:"<"}),"$0.01"]}):l}):m})};let c=s.span`
  font-size: 14px;
  line-height: 140%;
  display: flex;
  gap: 4px;
  align-items: center;
`,S=s.span`
  font-size: 12px;
  line-height: 12px;
  color: var(--privy-color-foreground-3);
`,h=s.span`
  font-size: 10px;
`,x=s.span`
  display: flex;
  align-items: center;
`;function v(e,r){return`https://explorer.solana.com/account/${e}?chain=${r}`}const I=e=>n.jsx(b,{href:e.chainType==="ethereum"?$(e.chainId,e.walletAddress):v(e.walletAddress,e.chainId),target:"_blank",children:j(e.walletAddress)});let b=s.a`
  &:hover {
    text-decoration: underline;
  }
`;export{I as S,F as f,D as h,P as p};
