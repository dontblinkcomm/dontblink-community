import{dk as d,dl as e}from"./index-BizPZrI7.js";import{g as r}from"./Buy-aETZT2np.js";import{f as p}from"./ModalFooter-DKyozrEX-R7hG82-Q.js";import{e as f}from"./ErrorMessage-D8VaAP5m-Dk16A3rP.js";import{r as x}from"./LabelXs-oqZNqbm_-CvOHgtV3.js";import{d as h}from"./Address-9aHCoAYt-CVuOK1JY.js";import{d as g}from"./shared-FM0rljBt-D6zwBLcl.js";import{C as j}from"./check-K9iSams8.js";import{C as u}from"./copy-BAjzn7d0.js";let v=r(g)`
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
`,k=r(p)`
  && {
    gap: 0.375rem;
    font-size: 14px;
  }
`;const R=({errMsg:t,balance:i,address:a,className:m,title:n,showCopyButton:c=!1})=>{let[o,l]=d.useState(!1);return d.useEffect(()=>{if(o){let s=setTimeout(()=>l(!1),3e3);return()=>clearTimeout(s)}},[o]),e.jsxs("div",{children:[n&&e.jsx(b,{children:n}),e.jsx(v,{className:m,$state:t?"error":void 0,children:e.jsxs(y,{children:[e.jsxs(C,{children:[e.jsx(h,{address:a,showCopyIcon:!1}),i!==void 0&&e.jsx(w,{children:i})]}),c&&e.jsx(k,{onClick:function(s){s.stopPropagation(),navigator.clipboard.writeText(a).then(()=>l(!0)).catch(console.error)},size:"sm",children:e.jsxs(e.Fragment,o?{children:["Copied",e.jsx(j,{size:14})]}:{children:["Copy",e.jsx(u,{size:14})]})})]})}),t&&e.jsx(z,{children:t})]})};export{R as j};
