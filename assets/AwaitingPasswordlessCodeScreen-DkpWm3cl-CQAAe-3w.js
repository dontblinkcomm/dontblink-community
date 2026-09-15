import{d7 as s,d8 as r}from"./index-CJXd_dq6.js";import{F as re}from"./EnvelopeIcon-Gz_rvKfV.js";import{F as oe}from"./PhoneIcon-CmxL1ytA.js";import{h as te,j as J,l as ae,N as ne,F as Q,ac as E,k as b,W as ie,J as se,g as S}from"./Buy-DT2m4A3s.js";import{o as le}from"./Layouts-BMRfo5hw-Bq0UuPeL.js";import{n as ce}from"./Link-DTncR-24-B8PiLEgH.js";import{a as de}from"./shouldProceedtoEmbeddedWalletCreationFlow-DDzHjOUJ-CExvo95w.js";import{n as ue}from"./ScreenLayout-DTsWfKKs-BTnELHb-.js";import"./index.browser.esm-CWjEK0-4.js";import"./index-BTJb-n1K.js";import"./bytes-CjWw8TJh.js";import"./arrival-vrSiZ_Lz.js";import"./curve-8lGps5xD.js";import"./ModalFooter-DKyozrEX-DZmiX_kz.js";import"./Screen-DMmH56yL-Dnev6A8f.js";import"./index-CWARkn2w-CKoXMWz6.js";function pe({title:o,titleId:p,...w},m){return s.createElement("svg",Object.assign({xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 20 20",fill:"currentColor","aria-hidden":"true","data-slot":"icon",ref:m,"aria-labelledby":p},w),o?s.createElement("title",{id:p},o):null,s.createElement("path",{fillRule:"evenodd",d:"M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z",clipRule:"evenodd"}))}const me=s.forwardRef(pe),fe=({contactMethod:o,authFlow:p,emailDomain:w,appName:m="Privy",whatsAppEnabled:I=!1,onBack:l,onCodeSubmit:T,onResend:M,errorMessage:f,success:x=!1,resendCountdown:D=0,onInvalidInput:N,onClearError:v})=>{let[d,_]=s.useState(G);s.useEffect(()=>{f||_(G)},[f]);let A=async y=>{var g;y.preventDefault();let n=y.currentTarget.value.replace(" ","");if(n==="")return;if(isNaN(Number(n)))return void(N==null?void 0:N("Code should be numeric"));v==null||v();let h=Number((g=y.currentTarget.name)==null?void 0:g.charAt(5)),c=[...n||[""]].slice(0,Z-h),a=[...d.slice(0,h),...c,...d.slice(h+c.length)];_(a);let C=Math.min(Math.max(h+c.length,0),Z-1);if(!isNaN(Number(y.currentTarget.value))){let t=document.querySelector(`input[name=code-${C}]`);t==null||t.focus()}if(a.every(t=>t&&!isNaN(+t))){let t=document.querySelector(`input[name=code-${C}]`);t==null||t.blur(),await(T==null?void 0:T(a.join("")))}};return r.jsx(ue,{title:"Enter confirmation code",subtitle:r.jsxs("span",p==="email"?{children:["Please check ",r.jsx(ee,{children:o})," for an email from"," ",w??"privy.io"," and enter your code below."]}:{children:["Please check ",r.jsx(ee,{children:o})," for a",I?" WhatsApp":""," message from ",m," and enter your code below."]}),icon:p==="email"?re:oe,onBack:l,showBack:!0,helpText:r.jsxs(Ee,{children:[r.jsxs("span",{children:["Didn't get ",p==="email"?"an email":"a message","?"]}),D?r.jsxs(be,{children:[r.jsx(me,{color:"var(--privy-color-foreground)",strokeWidth:1.33,height:"12px",width:"12px"}),r.jsx("span",{children:"Code sent"})]}):r.jsx(ce,{as:"button",size:"sm",onClick:M,children:"Resend code"})]}),children:r.jsx(ge,{children:r.jsx(le,{children:r.jsxs(xe,{children:[r.jsx("div",{children:d.map((y,n)=>r.jsx("input",{name:`code-${n}`,type:"text",value:d[n],onChange:A,onKeyUp:h=>{h.key==="Backspace"&&(c=>{if(v==null||v(),_([...d.slice(0,c),"",...d.slice(c+1)]),c>0){let a=document.querySelector(`input[name=code-${c-1}]`);a==null||a.focus()}})(n)},inputMode:"numeric",autoFocus:n===0,pattern:"[0-9]",className:`${x?"success":""} ${f?"fail":""}`,autoComplete:se?"one-time-code":"off"},n))}),r.jsx(ye,{$fail:!!f,$success:x,children:r.jsx("span",{children:f==="Invalid or expired verification code"?"Incorrect code":f||(x?"Success!":"")})})]})})})})};let Z=6,G=Array(6).fill("");var k,R,ve=((k=ve||{})[k.RESET_AFTER_DELAY=0]="RESET_AFTER_DELAY",k[k.CLEAR_ON_NEXT_VALID_INPUT=1]="CLEAR_ON_NEXT_VALID_INPUT",k),he=((R=he||{})[R.EMAIL=0]="EMAIL",R[R.SMS=1]="SMS",R);const Fe={component:()=>{var F,U,P;let{navigate:o,lastScreen:p,navigateBack:w,setModalData:m,onUserCloseViaDialogOrKeybindRef:I}=te(),l=J(),{closePrivyModal:T,resendEmailCode:M,resendSmsCode:f,getAuthMeta:x,loginWithCode:D,updateWallets:N,createAnalyticsEvent:v}=ae(),{authenticated:d,logout:_,user:A}=ne(),{whatsAppEnabled:y}=J(),[n,h]=s.useState(!1),[c,a]=s.useState(null),[C,g]=s.useState(null),[t,L]=s.useState(0);I.current=()=>null;let j=(F=x())!=null&&F.email?0:1,$=j===0?((U=x())==null?void 0:U.email)||"":((P=x())==null?void 0:P.phoneNumber)||"",O=Q-500;return s.useEffect(()=>{if(t){let i=setTimeout(()=>{L(t-1)},1e3);return()=>clearTimeout(i)}},[t]),s.useEffect(()=>{if(d&&n&&A){if(l!=null&&l.legal.requireUsersAcceptTerms&&!A.hasAcceptedTerms){let i=setTimeout(()=>{o("AffirmativeConsentScreen")},O);return()=>clearTimeout(i)}if(de(A,l.embeddedWallets)){let i=setTimeout(()=>{m({createWallet:{onSuccess:()=>{},onFailure:u=>{console.error(u),v({eventName:"embedded_wallet_creation_failure_logout",payload:{error:u,screen:"AwaitingPasswordlessCodeScreen"}}),_()},callAuthOnSuccessOnClose:!0}}),o("EmbeddedWalletOnAccountCreateScreen")},O);return()=>clearTimeout(i)}{N();let i=setTimeout(()=>T({shouldCallAuthOnSuccess:!0,isSuccess:!0}),Q);return()=>clearTimeout(i)}}},[d,n,A]),s.useEffect(()=>{if(c&&C===0){let i=setTimeout(()=>{a(null),g(null);let u=document.querySelector("input[name=code-0]");u==null||u.focus()},1400);return()=>clearTimeout(i)}},[c,C]),r.jsx(fe,{contactMethod:$,authFlow:j===0?"email":"sms",emailDomain:l==null?void 0:l.appearance.emailDomain,appName:l==null?void 0:l.name,whatsAppEnabled:y,onBack:()=>w(),onCodeSubmit:async i=>{var u,W,B,q,V,K,z,X,Y,H;try{await D(i),h(!0)}catch(e){if(e instanceof E&&e.privyErrorCode===b.INVALID_CREDENTIALS)a("Invalid or expired verification code"),g(0);else if(e instanceof E&&e.privyErrorCode===b.CANNOT_LINK_MORE_OF_TYPE)a(e.message);else{if(e instanceof E&&e.privyErrorCode===b.USER_LIMIT_REACHED)return console.error(new ie(e).toString()),void o("UserLimitReachedScreen");if(e instanceof E&&e.privyErrorCode===b.USER_DOES_NOT_EXIST)return void o("AccountNotFoundScreen");if(e instanceof E&&e.privyErrorCode===b.LINKED_TO_ANOTHER_USER)return m({errorModalData:{error:e,previousScreen:p??"AwaitingPasswordlessCodeScreen"}}),void o("ErrorScreen",!1);if(e instanceof E&&e.privyErrorCode===b.DISALLOWED_PLUS_EMAIL)return m({inlineError:{error:e}}),void o("ConnectOrCreateScreen",!1);if(e instanceof E&&e.privyErrorCode===b.ACCOUNT_TRANSFER_REQUIRED&&((W=(u=e.data)==null?void 0:u.data)!=null&&W.nonce))return m({accountTransfer:{nonce:(q=(B=e.data)==null?void 0:B.data)==null?void 0:q.nonce,account:$,displayName:(z=(K=(V=e.data)==null?void 0:V.data)==null?void 0:K.account)==null?void 0:z.displayName,linkMethod:j===0?"email":"sms",embeddedWalletAddress:(H=(Y=(X=e.data)==null?void 0:X.data)==null?void 0:Y.otherUser)==null?void 0:H.embeddedWalletAddress}}),void o("LinkConflictScreen");a("Issue verifying code"),g(0)}}},onResend:async()=>{L(30),j===0?await M():await f()},errorMessage:c||void 0,success:n,resendCountdown:t,onInvalidInput:i=>{a(i),g(1)},onClearError:()=>{C===1&&(a(null),g(null))}})}};let ge=S.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: auto;
  gap: 16px;
  flex-grow: 1;
  width: 100%;
`,xe=S.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 12px;

  > div:first-child {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    border-radius: var(--privy-border-radius-sm);

    > input {
      border: 1px solid var(--privy-color-foreground-4);
      background: var(--privy-color-background);
      border-radius: var(--privy-border-radius-sm);
      padding: 8px 10px;
      height: 48px;
      width: 40px;
      text-align: center;
      font-size: 18px;
      font-weight: 600;
      color: var(--privy-color-foreground);
      transition: all 0.2s ease;
    }

    > input:focus {
      border: 1px solid var(--privy-color-foreground);
      box-shadow: 0 0 0 1px var(--privy-color-foreground);
    }

    > input:invalid {
      border: 1px solid var(--privy-color-error);
    }

    > input.success {
      border: 1px solid var(--privy-color-border-success);
      background: var(--privy-color-success-bg);
    }

    > input.fail {
      border: 1px solid var(--privy-color-border-error);
      background: var(--privy-color-error-bg);
      animation: shake 180ms;
      animation-iteration-count: 2;
    }
  }

  @keyframes shake {
    0% {
      transform: translate(1px, 0);
    }
    33% {
      transform: translate(-1px, 0);
    }
    67% {
      transform: translate(-1px, 0);
    }
    100% {
      transform: translate(1px, 0);
    }
  }
`,ye=S.div`
  line-height: 20px;
  min-height: 20px;
  font-size: 14px;
  font-weight: 400;
  color: ${o=>o.$success?"var(--privy-color-success-dark)":o.$fail?"var(--privy-color-error-dark)":"transparent"};
  display: flex;
  justify-content: center;
  width: 100%;
  text-align: center;
`,Ee=S.div`
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  width: 100%;
  color: var(--privy-color-foreground-2);
`,be=S.div`
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--privy-border-radius-sm);
  padding: 2px 8px;
  gap: 4px;
  background: var(--privy-color-background-2);
  color: var(--privy-color-foreground-2);
`,ee=S.span`
  font-weight: 500;
  word-break: break-all;
  color: var(--privy-color-foreground);
`;export{Fe as AwaitingPasswordlessCodeScreen,fe as AwaitingPasswordlessCodeScreenView,Fe as default};
