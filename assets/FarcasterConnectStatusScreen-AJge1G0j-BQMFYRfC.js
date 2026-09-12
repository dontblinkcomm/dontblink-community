import{d7 as l,d8 as t}from"./index-njo-AI5Z.js";import{N as Y,h as G,j as Z,l as ee,k as u,W as re,F,J as H,as as te,B as ae,g as s}from"./Buy-DdHwybbb.js";import{n as ie}from"./OpenLink-CUpJ1mOr-DpM75pH7.js";import{x as oe}from"./QrCode-CpGkVlXb-Bq-D41hr.js";import{f as se}from"./ModalFooter-DKyozrEX-CbiCwoUD.js";import{r as ne}from"./LabelXs-oqZNqbm_-v6U8vEot.js";import{a as le}from"./shouldProceedtoEmbeddedWalletCreationFlow-DDzHjOUJ-B_OLkfPb.js";import{n as ce}from"./ScreenLayout-DTsWfKKs-CP7ot9po.js";import{l as _}from"./farcaster-DPlSjvF5-C1znXoPm.js";import"./index.browser.esm-BmBig5sw.js";import{C as de}from"./check-CXeerCFb.js";import{C as ue}from"./copy-DrD_z61c.js";import"./bytes-CjWw8TJh.js";import"./arrival-uzuqjESp.js";import"./curve-C_B3vte2.js";import"./dijkstra-D_NXgYpA.js";import"./Screen-DMmH56yL-ETPtU2au.js";import"./index-CWARkn2w-D74tKtz7.js";import"./createLucideIcon-l6mHs4BT.js";let pe=s.div`
  width: 100%;
`,me=s.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem;
  height: 56px;
  background: ${r=>r.$disabled?"var(--privy-color-background-2)":"var(--privy-color-background)"};
  border: 1px solid var(--privy-color-foreground-4);
  border-radius: var(--privy-border-radius-md);

  &:hover {
    border-color: ${r=>r.$disabled?"var(--privy-color-foreground-4)":"var(--privy-color-foreground-3)"};
  }
`,he=s.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
`,J=s.span`
  display: block;
  font-size: 16px;
  line-height: 24px;
  color: ${r=>r.$disabled?"var(--privy-color-foreground-2)":"var(--privy-color-foreground)"};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  /* Single-line truncation: as a flex item this would otherwise be floored at its
     min-content width, so min-width: 0 lets it shrink and the ellipsis land at the
     container edge. */
  min-width: 0;

  @media (min-width: 441px) {
    font-size: 14px;
    line-height: 20px;
  }
`,fe=s(J)`
  color: var(--privy-color-foreground-3);
  font-style: italic;
`,ge=s(ne)`
  margin-bottom: 0.5rem;
`,ve=s(se)`
  && {
    gap: 0.375rem;
    font-size: 14px;
    flex-shrink: 0;
  }
`;const xe=({value:r,title:p,placeholder:c,className:a,showCopyButton:d=!0,truncate:o,maxLength:m=40,disabled:h=!1})=>{let[n,x]=l.useState(!1),b=o&&r?((i,E,f)=>{if((i=i.startsWith("https://")?i.slice(8):i).length<=f)return i;if(E==="middle"){let y=Math.ceil(f/2)-2,C=Math.floor(f/2)-1;return`${i.slice(0,y)}...${i.slice(-C)}`}return`${i.slice(0,f-3)}...`})(r,o,m):r;return l.useEffect(()=>{if(n){let i=setTimeout(()=>x(!1),3e3);return()=>clearTimeout(i)}},[n]),t.jsxs(pe,{className:a,children:[p&&t.jsx(ge,{children:p}),t.jsxs(me,{$disabled:h,children:[t.jsx(he,{children:r?t.jsx(J,{$disabled:h,title:r,children:b}):t.jsx(fe,{$disabled:h,children:c||"No value"})}),d&&r&&t.jsx(ve,{onClick:function(i){i.stopPropagation(),navigator.clipboard.writeText(r).then(()=>x(!0)).catch(console.error)},size:"sm",children:t.jsxs(t.Fragment,n?{children:["Copied",t.jsx(de,{size:14})]}:{children:["Copy",t.jsx(ue,{size:14})]})})]})]})},ye=({connectUri:r,loading:p,success:c,errorMessage:a,onBack:d,onClose:o,onOpenFarcaster:m})=>t.jsx(ce,H||p?te?{title:a?a.message:"Sign in with Farcaster",subtitle:a?a.detail:"To sign in with Farcaster, please open the Farcaster app.",icon:_,iconVariant:"loading",iconLoadingStatus:{success:c,fail:!!a},primaryCta:r&&m?{label:"Open Farcaster app",onClick:m}:void 0,onBack:d,onClose:o,watermark:!0}:{title:a?a.message:"Signing in with Farcaster",subtitle:a?a.detail:"This should only take a moment",icon:_,iconVariant:"loading",iconLoadingStatus:{success:c,fail:!!a},onBack:d,onClose:o,watermark:!0,children:r&&H&&t.jsx(we,{children:t.jsx(ie,{text:"Take me to Farcaster",url:r,color:"#8a63d2"})})}:{title:"Sign in with Farcaster",subtitle:"Scan with your phone's camera to continue.",onBack:d,onClose:o,watermark:!0,children:t.jsxs(Se,{children:[t.jsx(be,{children:r?t.jsx(oe,{url:r,size:275,squareLogoElement:_}):t.jsx(Te,{children:t.jsx(ae,{})})}),t.jsxs(Ee,{children:[t.jsx(Ce,{children:"Or copy this link and paste it into a phone browser to open the Farcaster app."}),r&&t.jsx(xe,{value:r,truncate:"end",maxLength:30,showCopyButton:!0,disabled:!0})]})]})}),Pe={component:()=>{let{authenticated:r,logout:p,ready:c,user:a}=Y(),{lastScreen:d,navigate:o,navigateBack:m,setModalData:h}=G(),n=Z(),{getAuthFlow:x,loginWithFarcaster:b,closePrivyModal:i,createAnalyticsEvent:E}=ee(),[f,y]=l.useState(void 0),[C,Q]=l.useState(!1),[w,K]=l.useState(!1),T=l.useRef([]),S=x(),j=S==null?void 0:S.meta.connectUri;return l.useEffect(()=>{let g=Date.now(),k=setInterval(async()=>{var $,O,R,N,I,L,U,D,M,W,z,B,q,V,P;let A=await S.pollForReady.execute(),X=Date.now()-g;if(A){clearInterval(k),Q(!0);try{await b(),K(!0)}catch(e){let v={retryable:!1,message:"Authentication failed"};if((e==null?void 0:e.privyErrorCode)===u.ALLOWLIST_REJECTED)return void o("AllowlistRejectionScreen");if((e==null?void 0:e.privyErrorCode)===u.USER_LIMIT_REACHED)return console.error(new re(e).toString()),void o("UserLimitReachedScreen");if((e==null?void 0:e.privyErrorCode)===u.USER_DOES_NOT_EXIST)return void o("AccountNotFoundScreen");if((e==null?void 0:e.privyErrorCode)===u.LINKED_TO_ANOTHER_USER)v.detail=e.message??"This account has already been linked to another user.";else{if((e==null?void 0:e.privyErrorCode)===u.ACCOUNT_TRANSFER_REQUIRED&&((O=($=e.data)==null?void 0:$.data)!=null&&O.nonce))return h({accountTransfer:{nonce:(N=(R=e.data)==null?void 0:R.data)==null?void 0:N.nonce,account:(L=(I=e.data)==null?void 0:I.data)==null?void 0:L.subject,displayName:(M=(D=(U=e.data)==null?void 0:U.data)==null?void 0:D.account)==null?void 0:M.displayName,linkMethod:"farcaster",embeddedWalletAddress:(B=(z=(W=e.data)==null?void 0:W.data)==null?void 0:z.otherUser)==null?void 0:B.embeddedWalletAddress,farcasterEmbeddedAddress:(P=(V=(q=e.data)==null?void 0:q.data)==null?void 0:V.otherUser)==null?void 0:P.farcasterEmbeddedAddress}}),void o("LinkConflictScreen");(e==null?void 0:e.privyErrorCode)===u.INVALID_CREDENTIALS?(v.retryable=!0,v.detail="Something went wrong. Try again."):(e==null?void 0:e.privyErrorCode)===u.TOO_MANY_REQUESTS&&(v.detail="Too many requests. Please wait before trying again.")}y(v)}}else X>12e4&&(clearInterval(k),y({retryable:!0,message:"Authentication failed",detail:"The request timed out. Try again."}))},2e3);return()=>{clearInterval(k),T.current.forEach(A=>clearTimeout(A))}},[]),l.useEffect(()=>{if(c&&r&&w&&a){if(n!=null&&n.legal.requireUsersAcceptTerms&&!a.hasAcceptedTerms){let g=setTimeout(()=>{o("AffirmativeConsentScreen")},F);return()=>clearTimeout(g)}w&&(le(a,n.embeddedWallets)?T.current.push(setTimeout(()=>{h({createWallet:{onSuccess:()=>{},onFailure:g=>{console.error(g),E({eventName:"embedded_wallet_creation_failure_logout",payload:{error:g,screen:"FarcasterConnectStatusScreen"}}),p()},callAuthOnSuccessOnClose:!0}}),o("EmbeddedWalletOnAccountCreateScreen")},F)):T.current.push(setTimeout(()=>i({shouldCallAuthOnSuccess:!0,isSuccess:!0}),F)))}},[w,c,r,a]),t.jsx(ye,{connectUri:j,loading:C,success:w,errorMessage:f,onBack:d?m:void 0,onClose:i,onOpenFarcaster:()=>{j&&(window.location.href=j)}})}};let we=s.div`
  margin-top: 24px;
`,Se=s.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
`,be=s.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 275px;
`,Ee=s.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`,Ce=s.div`
  font-size: 0.875rem;
  text-align: center;
  color: var(--privy-color-foreground-2);
`,Te=s.div`
  position: relative;
  width: 82px;
  height: 82px;
`;export{Pe as FarcasterConnectStatusScreen,ye as FarcasterConnectStatusView,Pe as default};
