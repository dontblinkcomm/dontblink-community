import{dj as s,dk as e}from"./index-juzIJLS9.js";import{b1 as x,h as y,j as C,b2 as g,g as l}from"./Buy-eRYBMc7p.js";import{n as j}from"./styles-DVyDvTdj-vNSBm3Qg.js";import{i as a,l as c,s as d,Q as b}from"./styles-tjTwTW2h-tRy4vqHh.js";import"./index.browser.esm-BOSYCs5b.js";import{c as k}from"./createLucideIcon-DuVRVF2O.js";import{C as w}from"./credit-card-B7JIwiKh.js";import"./index-BTJb-n1K.js";import"./bytes-CjWw8TJh.js";import"./arrival-OE6pWzpL.js";import"./curve-CiAubWOy.js";import"./ScreenLayout-DTsWfKKs-Cz0dEudl.js";import"./ModalFooter-DKyozrEX-Bwnz9N4D.js";import"./Screen-DMmH56yL-Cud8KdUf.js";import"./index-CWARkn2w-BjdzAj-C.js";/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v=[["rect",{width:"20",height:"12",x:"2",y:"6",rx:"2",key:"9lu3g6"}],["circle",{cx:"12",cy:"12",r:"2",key:"1c9p78"}],["path",{d:"M6 12h.01M18 12h.01",key:"113zkx"}]],u=k("banknote",v),D={component:()=>{let r=x(),{onUserCloseViaDialogOrKeybindRef:n}=y(),f=C(),t=s.useRef(!1);s.useEffect(()=>{r&&(t.current=!1)},[r]);let o=s.useCallback(async()=>{!t.current&&r&&(t.current=!0,g(),await r.onCancel())},[r]);return s.useEffect(()=>(n.current=o,()=>{n.current===o&&(n.current=null)}),[o,n]),r?r.error?e.jsx(a,{icon:u,iconVariant:"warning",title:"Unable to add funds",subtitle:r.error,showClose:!0,onClose:o,primaryCta:{label:"Close",onClick:o}}):e.jsx(a,{icon:u,iconVariant:"subtle",title:"Select method",subtitle:"Choose how to fund your wallet",showClose:!0,onClose:o,children:e.jsxs(j,{style:{marginTop:"1rem"},$colorScheme:f.appearance.palette.colorScheme,children:[r.startFiat&&e.jsxs(c,{onClick:async()=>{var i;t.current||(t.current=!0,await((i=r.startFiat)==null?void 0:i.call(r)))},children:[e.jsx(m,{children:e.jsx(w,{})}),e.jsxs(p,{children:[e.jsx(d,{children:"Pay with fiat"}),e.jsx(h,{children:"Apple Pay, Google Pay, or debit card"})]})]}),r.startCrypto&&e.jsxs(c,{onClick:async()=>{var i;t.current||(t.current=!0,await((i=r.startCrypto)==null?void 0:i.call(r)))},children:[e.jsx(m,{children:e.jsx(b,{})}),e.jsxs(p,{children:[e.jsx(d,{children:"Transfer from wallet"}),e.jsx(h,{children:"Send crypto from any wallet"})]})]})]})}):null}};let m=l.span`
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
`;export{D as AddFundsSelectionScreen,D as default};
