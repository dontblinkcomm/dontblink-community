import{d7 as p,d8 as e}from"./index-ClzS_OBz.js";import{o as d,g as t}from"./Buy-BmaK0uVJ.js";import{f as m}from"./ModalFooter-DKyozrEX-CgllgAIa.js";import{C as x}from"./check-DWNHFOfB.js";import{C as f}from"./copy-D62opboH.js";const k=({address:r,showCopyIcon:i,url:n,className:a})=>{let[o,c]=p.useState(!1);function l(s){s.stopPropagation(),navigator.clipboard.writeText(r).then(()=>c(!0)).catch(console.error)}return p.useEffect(()=>{if(o){let s=setTimeout(()=>c(!1),3e3);return()=>clearTimeout(s)}},[o]),e.jsxs(h,n?{children:[e.jsx(g,{title:r,className:a,href:`${n}/address/${r}`,target:"_blank",children:d(r)}),i&&e.jsx(m,{onClick:l,size:"sm",style:{gap:"0.375rem"},children:e.jsxs(e.Fragment,o?{children:["Copied",e.jsx(x,{size:16})]}:{children:["Copy",e.jsx(f,{size:16})]})})]}:{children:[e.jsx(u,{title:r,className:a,children:d(r)}),i&&e.jsx(m,{onClick:l,size:"sm",style:{gap:"0.375rem",fontSize:"14px"},children:e.jsxs(e.Fragment,o?{children:["Copied",e.jsx(x,{size:14})]}:{children:["Copy",e.jsx(f,{size:14})]})})]})};let h=t.span`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
`,u=t.span`
  font-size: 14px;
  font-weight: 500;
  color: var(--privy-color-foreground);
`,g=t.a`
  font-size: 14px;
  color: var(--privy-color-foreground);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;export{k as d};
