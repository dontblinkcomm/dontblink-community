import{dk as u,dl as t}from"./index-BizPZrI7.js";import{h as F,j as T,l as I,F as w,J as y,as as B,B as O,g as n}from"./Buy-aETZT2np.js";import{h as _}from"./CopyToClipboard-i_OQSBJr-Ghk9Ql9l.js";import{n as q}from"./OpenLink-CUpJ1mOr-DQH2UH-h.js";import{x as E}from"./QrCode-CpGkVlXb-OPrUpPkE.js";import{n as A}from"./ScreenLayout-DTsWfKKs-CzWVNgmv.js";import{l as h}from"./farcaster-DPlSjvF5-CZ4jfZML.js";import"./index.browser.esm-DATKkg4G.js";import"./index-BTJb-n1K.js";import"./arrival-CCbdOwQL.js";import"./curve-CP6smguy.js";import"./dijkstra-D_NXgYpA.js";import"./ModalFooter-DKyozrEX-R7hG82-Q.js";import"./Screen-DMmH56yL-DaVk1SWq.js";import"./index-CWARkn2w-Dq8832cp.js";let k="#8a63d2";const M=({appName:p,loading:m,success:i,errorMessage:e,connectUri:r,onBack:s,onClose:c,onOpenFarcaster:o})=>t.jsx(A,y||m?B?{title:e?e.message:"Add a signer to Farcaster",subtitle:e?e.detail:`This will allow ${p} to add casts, likes, follows, and more on your behalf.`,icon:h,iconVariant:"loading",iconLoadingStatus:{success:i,fail:!!e},primaryCta:r&&o?{label:"Open Farcaster app",onClick:o}:void 0,onBack:s,onClose:c,watermark:!0}:{title:e?e.message:"Requesting signer from Farcaster",subtitle:e?e.detail:"This should only take a moment",icon:h,iconVariant:"loading",iconLoadingStatus:{success:i,fail:!!e},onBack:s,onClose:c,watermark:!0,children:r&&y&&t.jsx(R,{children:t.jsx(q,{text:"Take me to Farcaster",url:r,color:k})})}:{title:"Add a signer to Farcaster",subtitle:`This will allow ${p} to add casts, likes, follows, and more on your behalf.`,onBack:s,onClose:c,watermark:!0,children:t.jsxs(L,{children:[t.jsx(N,{children:r?t.jsx(E,{url:r,size:275,squareLogoElement:h}):t.jsx(z,{children:t.jsx(O,{})})}),t.jsxs(P,{children:[t.jsx(V,{children:"Or copy this link and paste it into a phone browser to open the Farcaster app."}),r&&t.jsx(_,{text:r,itemName:"link",color:k})]})]})});let R=n.div`
  margin-top: 24px;
`,L=n.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
`,N=n.div`
  padding: 24px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 275px;
`,P=n.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`,V=n.div`
  font-size: 0.875rem;
  text-align: center;
  color: var(--privy-color-foreground-2);
`,z=n.div`
  position: relative;
  width: 82px;
  height: 82px;
`;const re={component:()=>{let{lastScreen:p,navigateBack:m,data:i}=F(),e=T(),{requestFarcasterSignerStatus:r,closePrivyModal:s}=I(),[c,o]=u.useState(void 0),[S,v]=u.useState(!1),[j,x]=u.useState(!1),g=u.useRef([]),a=i==null?void 0:i.farcasterSigner;u.useEffect(()=>{let b=Date.now(),l=setInterval(async()=>{if(!(a!=null&&a.public_key))return clearInterval(l),void o({retryable:!0,message:"Connect failed",detail:"Something went wrong. Please try again."});a.status==="approved"&&(clearInterval(l),v(!1),x(!0),g.current.push(setTimeout(()=>s({shouldCallAuthOnSuccess:!1,isSuccess:!0}),w)));let d=await r(a==null?void 0:a.public_key),C=Date.now()-b;d.status==="approved"?(clearInterval(l),v(!1),x(!0),g.current.push(setTimeout(()=>s({shouldCallAuthOnSuccess:!1,isSuccess:!0}),w))):C>3e5?(clearInterval(l),o({retryable:!0,message:"Connect failed",detail:"The request timed out. Try again."})):d.status==="revoked"&&(clearInterval(l),o({retryable:!0,message:"Request rejected",detail:"The request was rejected. Please try again."}))},2e3);return()=>{clearInterval(l),g.current.forEach(d=>clearTimeout(d))}},[]);let f=(a==null?void 0:a.status)==="pending_approval"?a.signer_approval_url:void 0;return t.jsx(M,{appName:e.name,loading:S,success:j,errorMessage:c,connectUri:f,onBack:p?m:void 0,onClose:s,onOpenFarcaster:()=>{f&&(window.location.href=f)}})}};export{re as FarcasterSignerStatusScreen,M as FarcasterSignerStatusView,re as default};
