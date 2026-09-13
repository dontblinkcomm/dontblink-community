import{d7 as r,d8 as a,ck as k,ch as M}from"./index-P604qLO6.js";import{N,l as O,h as z,bm as I,T as E,aS as T,aT as b,F as q,g as u,bn as F}from"./Buy-gZBWbZoL.js";import{h as P}from"./CopyToClipboard-i_OQSBJr-vE0ywK-i.js";import{d as $}from"./Layouts-BMRfo5hw-Dz9GFen-.js";import{a as V,i as H}from"./JsonTree-BHzNC-ic-CKrS8y3D.js";import{n as J}from"./ScreenLayout-DTsWfKKs-CMlK7-_7.js";import"./index.browser.esm-Dx68vEnv.js";import{c as K}from"./createLucideIcon-BmPiPoLG.js";import"./bytes-CjWw8TJh.js";import"./arrival-DDIkiRXD.js";import"./curve-ClVYcdXS.js";import"./ModalFooter-DKyozrEX-Cz1yCDib.js";import"./Screen-DMmH56yL-CECQqzFf.js";import"./index-CWARkn2w-dUrVcNbM.js";/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Q=[["path",{d:"M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7",key:"1m0v6g"}],["path",{d:"M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z",key:"ohrbg2"}]],U=K("square-pen",Q),W=u.img`
  && {
    height: ${e=>e.size==="sm"?"65px":"140px"};
    width: ${e=>e.size==="sm"?"65px":"140px"};
    border-radius: 16px;
    margin-bottom: 12px;
  }
`;let B=e=>{if(!k(e))return e;try{let s=M(e);return s.includes("�")?e:s}catch{return e}},G=e=>{try{let s=F.decode(e),i=new TextDecoder().decode(s);return i.includes("�")?e:i}catch{return e}},X=e=>{let{types:s,primaryType:i,...l}=e.typedData;return a.jsxs(a.Fragment,{children:[a.jsx(te,{data:l}),a.jsx(P,{text:(o=e.typedData,JSON.stringify(o,null,2)),itemName:"full payload to clipboard"})," "]});var o};const Y=({method:e,messageData:s,copy:i,iconUrl:l,isLoading:o,success:g,walletProxyIsLoading:m,errorMessage:x,isCancellable:d,onSign:c,onCancel:y,onClose:p})=>a.jsx(J,{title:i.title,subtitle:i.description,showClose:!0,onClose:p,icon:U,iconVariant:"subtle",helpText:x?a.jsx(ee,{children:x}):void 0,primaryCta:{label:i.buttonText,onClick:c,disabled:o||g||m,loading:o},secondaryCta:d?{label:"Not now",onClick:y,disabled:o||g||m}:void 0,watermark:!0,children:a.jsxs($,{children:[l?a.jsx(W,{style:{alignSelf:"center"},size:"sm",src:l,alt:"app image"}):null,a.jsxs(Z,{children:[e==="personal_sign"&&a.jsx(w,{children:B(s)}),e==="eth_signTypedData_v4"&&a.jsx(X,{typedData:s}),e==="solana_signMessage"&&a.jsx(w,{children:G(s)})]})]})}),he={component:()=>{let{authenticated:e}=N(),{initializeWalletProxy:s,closePrivyModal:i}=O(),{navigate:l,data:o,onUserCloseViaDialogOrKeybindRef:g}=z(),[m,x]=r.useState(!0),[d,c]=r.useState(""),[y,p]=r.useState(),[f,C]=r.useState(null),[R,S]=r.useState(!1);r.useEffect(()=>{e||l("LandingScreen")},[e]),r.useEffect(()=>{s(I).then(n=>{x(!1),n||(c("An error has occurred, please try again."),p(new E(new T(d,b.E32603_DEFAULT_INTERNAL_ERROR.eipCode))))})},[]);let{method:_,data:v,confirmAndSign:j,onSuccess:D,onFailure:L,uiOptions:t}=o.signMessage,A={title:(t==null?void 0:t.title)||"Sign message",description:(t==null?void 0:t.description)||"Signing this message will not cost you any fees.",buttonText:(t==null?void 0:t.buttonText)||"Sign and continue"},h=n=>{n?D(n):L(y||new E(new T("The user rejected the request.",b.E4001_USER_REJECTED_REQUEST.eipCode))),i({shouldCallAuthOnSuccess:!1}),setTimeout(()=>{C(null),c(""),p(void 0)},200)};return g.current=()=>{h(f)},a.jsx(Y,{method:_,messageData:v,copy:A,iconUrl:t!=null&&t.iconUrl&&typeof t.iconUrl=="string"?t.iconUrl:void 0,isLoading:R,success:f!==null,walletProxyIsLoading:m,errorMessage:d,isCancellable:t==null?void 0:t.isCancellable,onSign:async()=>{S(!0),c("");try{let n=await j();C(n),S(!1),setTimeout(()=>{h(n)},q)}catch(n){console.error(n),c("An error has occurred, please try again."),p(new E(new T(d,b.E32603_DEFAULT_INTERNAL_ERROR.eipCode))),S(!1)}},onCancel:()=>h(null),onClose:()=>h(f)})}};let Z=u.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
`,ee=u.p`
  && {
    margin: 0;
    width: 100%;
    text-align: center;
    color: var(--privy-color-error-dark);
    font-size: 14px;
    line-height: 22px;
  }
`,te=u(V)`
  margin-top: 0;
`,w=u(H)`
  margin-top: 0;
`;export{he as SignRequestScreen,Y as SignRequestView,he as default};
