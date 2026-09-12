import{d7 as a,d8 as e}from"./index-ClzS_OBz.js";import{F as _}from"./ShieldCheckIcon-CvhfAr3_.js";import{N as I,l as T,h as E,aH as F,aI as N,an as U,g as p,r as W}from"./Buy-BmaK0uVJ.js";import{b as H}from"./ModalFooter-DKyozrEX-CgllgAIa.js";import{l as V}from"./Layouts-BMRfo5hw-BACtZnjZ.js";import{g as M,h as O,y as q,w as z,k as B}from"./shared-DEkT-Gv3-BQawRJNp.js";import{w as s}from"./Screen-DMmH56yL-DqCGRp27.js";import"./index.browser.esm-BRFeusIO.js";import"./bytes-CjWw8TJh.js";import"./arrival-Cchh5VmF.js";import"./curve-CXB3S5r9.js";import"./index-CWARkn2w-CMSx7whB.js";const ie={component:()=>{let[o,m]=a.useState(!0),{authenticated:y,user:b}=I(),{walletProxy:i,closePrivyModal:v,createAnalyticsEvent:x,client:j}=T(),{navigate:k,data:A,onUserCloseViaDialogOrKeybindRef:$}=E(),[l,C]=a.useState(void 0),[f,d]=a.useState(""),[c,w]=a.useState(!1),{entropyId:h,entropyIdVerifier:S,onCompleteNavigateTo:g,onSuccess:u,onFailure:P}=A.recoverWallet,n=(r="User exited before their wallet could be recovered")=>{v({shouldCallAuthOnSuccess:!1}),P(typeof r=="string"?new U(r):r)};return $.current=n,a.useEffect(()=>{if(!y)return n("User must be authenticated and have a Privy wallet before it can be recovered")},[y]),e.jsxs(s,{children:[e.jsx(s.Header,{icon:_,title:"Enter your password",subtitle:"Please provision your account on this new device. To continue, enter your recovery password.",showClose:!0,onClose:n}),e.jsx(s.Body,{children:e.jsx(D,{children:e.jsxs("div",{children:[e.jsxs(M,{children:[e.jsx(O,{type:o?"password":"text",onChange:r=>(t=>{t&&C(t)})(r.target.value),disabled:c,style:{paddingRight:"2.3rem"}}),e.jsx(q,{style:{right:"0.75rem"},children:o?e.jsx(z,{onClick:()=>m(!1)}):e.jsx(B,{onClick:()=>m(!0)})})]}),!!f&&e.jsx(K,{children:f})]})})}),e.jsxs(s.Footer,{children:[e.jsx(s.HelpText,{children:e.jsxs(V,{children:[e.jsx("h4",{children:"Why is this necessary?"}),e.jsx("p",{children:"You previously set a password for this wallet. This helps ensure only you can access it"})]})}),e.jsx(s.Actions,{children:e.jsx(L,{loading:c||!i,disabled:!l,onClick:async()=>{w(!0);let r=await j.getAccessToken(),t=F(b,h);if(!r||!t||l===null)return n("User must be authenticated and have a Privy wallet before it can be recovered");try{x({eventName:"embedded_wallet_recovery_started",payload:{walletAddress:t.address}}),await(i==null?void 0:i.recover({accessToken:r,entropyId:h,entropyIdVerifier:S,recoveryPassword:l})),d(""),g?k(g):v({shouldCallAuthOnSuccess:!1}),u==null||u(t),x({eventName:"embedded_wallet_recovery_completed",payload:{walletAddress:t.address}})}catch(R){N(R)?d("Invalid recovery password, please try again."):d("An error has occurred, please try again.")}finally{w(!1)}},$hideAnimations:!h&&c,children:"Recover your account"})}),e.jsx(s.Watermark,{})]})]})}};let D=p.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`,K=p.div`
  line-height: 20px;
  height: 20px;
  font-size: 13px;
  color: var(--privy-color-error);
  text-align: left;
  margin-top: 0.5rem;
`,L=p(H)`
  ${({$hideAnimations:o})=>o&&W`
      && {
        /* Remove animations because the recoverWallet task on the iframe partially
           blocks the renderer, so the animation stutters and doesn't look good */
        transition: none;
      }
    `}
`;export{ie as PasswordRecoveryScreen,ie as default};
