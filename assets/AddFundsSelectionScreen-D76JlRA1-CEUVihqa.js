import{d8 as s,d9 as e}from"./index-Bfv-Yj_R.js";import{b1 as x,h as y,j as C,b2 as g,g as l}from"./Buy-xP7TDSUo.js";import{n as j}from"./styles-DVyDvTdj-Dk2V39ik.js";import{i as a,l as c,s as d,Q as b}from"./styles-tjTwTW2h-BEB2FEnF.js";import"./index.browser.esm-BkRfXAwI.js";import{c as w}from"./createLucideIcon-Bp7EHv7a.js";import{C as k}from"./credit-card-DRtdnQuy.js";import"./index-BTJb-n1K.js";import"./arrival-afB0qqpG.js";import"./curve-ugRkuPeR.js";import"./ScreenLayout-DTsWfKKs-C8C1WATW.js";import"./ModalFooter-DKyozrEX-Cicxl33o.js";import"./Screen-DMmH56yL-cWaVplWy.js";import"./index-CWARkn2w-CqQZiCrT.js";/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v=[["rect",{width:"20",height:"12",x:"2",y:"6",rx:"2",key:"9lu3g6"}],["circle",{cx:"12",cy:"12",r:"2",key:"1c9p78"}],["path",{d:"M6 12h.01M18 12h.01",key:"113zkx"}]],u=w("banknote",v),B={component:()=>{let r=x(),{onUserCloseViaDialogOrKeybindRef:i}=y(),f=C(),t=s.useRef(!1);s.useEffect(()=>{r&&(t.current=!1)},[r]);let o=s.useCallback(async()=>{!t.current&&r&&(t.current=!0,g(),await r.onCancel())},[r]);return s.useEffect(()=>(i.current=o,()=>{i.current===o&&(i.current=null)}),[o,i]),r?r.error?e.jsx(a,{icon:u,iconVariant:"warning",title:"Unable to add funds",subtitle:r.error,showClose:!0,onClose:o,primaryCta:{label:"Close",onClick:o}}):e.jsx(a,{icon:u,iconVariant:"subtle",title:"Select method",subtitle:"Choose how to fund your wallet",showClose:!0,onClose:o,children:e.jsxs(j,{style:{marginTop:"1rem"},$colorScheme:f.appearance.palette.colorScheme,children:[r.startFiat&&e.jsxs(c,{onClick:async()=>{var n;t.current||(t.current=!0,await((n=r.startFiat)==null?void 0:n.call(r)))},children:[e.jsx(m,{children:e.jsx(k,{})}),e.jsxs(p,{children:[e.jsx(d,{children:"Pay with fiat"}),e.jsx(h,{children:"Apple Pay, Google Pay, or debit card"})]})]}),r.startCrypto&&e.jsxs(c,{onClick:async()=>{var n;t.current||(t.current=!0,await((n=r.startCrypto)==null?void 0:n.call(r)))},children:[e.jsx(m,{children:e.jsx(b,{})}),e.jsxs(p,{children:[e.jsx(d,{children:"Transfer from wallet"}),e.jsx(h,{children:"Send crypto from any wallet"})]})]})]})}):null}};let m=l.span`
  width: 2rem;
  height: 2rem;
  border-radius: var(--privy-border-radius-full);
  background-color: var(--privy-color-background-2);
  color: var(--privy-color-icon-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  svg {
    width: 1.125rem;
    height: 1.125rem;
  }
`,p=l.span`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`,h=l.span`
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: var(--privy-color-foreground-3);
`;export{B as AddFundsSelectionScreen,B as default};
