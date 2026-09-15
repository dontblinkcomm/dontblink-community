import{d7 as d,d8 as e}from"./index-DU_fI0GV.js";import{g as r}from"./Buy-CodKA6Fa.js";import{f as p}from"./ModalFooter-DKyozrEX-DuH0RjE5.js";import{e as f}from"./ErrorMessage-D8VaAP5m-DRQKlKkU.js";import{r as x}from"./LabelXs-oqZNqbm_-DRJZg7ht.js";import{d as h}from"./Address-9aHCoAYt-CblRCUfK.js";import{d as g}from"./shared-FM0rljBt-BN2NkoL3.js";import{C as j}from"./check-CzBLU7Ow.js";import{C as u}from"./copy-BZEHnGbW.js";let v=r(g)`
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
