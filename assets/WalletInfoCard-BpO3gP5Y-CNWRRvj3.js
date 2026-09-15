import{d7 as d,d8 as e}from"./index-gHhA69TR.js";import{g as r}from"./Buy-0FbEgy5U.js";import{f as p}from"./ModalFooter-DKyozrEX-D4TWvQmS.js";import{e as f}from"./ErrorMessage-D8VaAP5m-CIr7Ul5u.js";import{r as x}from"./LabelXs-oqZNqbm_-Dtkxreo3.js";import{d as h}from"./Address-9aHCoAYt-CRPTwVr6.js";import{d as g}from"./shared-FM0rljBt-C7SKyhrF.js";import{C as j}from"./check-B5jDIwxh.js";import{C as u}from"./copy-BUbpv0Ql.js";let v=r(g)`
  && {
    padding: 0.75rem;
    height: 56px;
  }
`,y=r.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`,C=r.div`
  display: flex;
  flex-direction: column;
  gap: 0;
`,w=r.div`
  font-size: 12px;
  line-height: 1rem;
  color: var(--privy-color-foreground-3);
`,b=r(x)`
  text-align: left;
  margin-bottom: 0.5rem;
`,z=r(f)`
  margin-top: 0.25rem;
`,E=r(p)`
  && {
    gap: 0.375rem;
    font-size: 14px;
  }
`;const R=({errMsg:t,balance:i,address:a,className:m,title:n,showCopyButton:c=!1})=>{let[o,l]=d.useState(!1);return d.useEffect(()=>{if(o){let s=setTimeout(()=>l(!1),3e3);return()=>clearTimeout(s)}},[o]),e.jsxs("div",{children:[n&&e.jsx(b,{children:n}),e.jsx(v,{className:m,$state:t?"error":void 0,children:e.jsxs(y,{children:[e.jsxs(C,{children:[e.jsx(h,{address:a,showCopyIcon:!1}),i!==void 0&&e.jsx(w,{children:i})]}),c&&e.jsx(E,{onClick:function(s){s.stopPropagation(),navigator.clipboard.writeText(a).then(()=>l(!0)).catch(console.error)},size:"sm",children:e.jsxs(e.Fragment,o?{children:["Copied",e.jsx(j,{size:14})]}:{children:["Copy",e.jsx(u,{size:14})]})})]})}),t&&e.jsx(z,{children:t})]})};export{R as j};
