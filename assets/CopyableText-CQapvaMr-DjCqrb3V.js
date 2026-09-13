import{d7 as h,d8 as e}from"./index-BwHq9ck8.js";import{g as l}from"./Buy-CrCb5tyW.js";import{C as p}from"./check-DBnY9PXC.js";import{C as g}from"./copy-BS4tXAKf.js";let a=l.button`
  display: flex;
  align-items: center;
  justify-content: end;
  gap: 0.5rem;

  && {
    color: var(--privy-color-foreground);
    font-weight: 500;
  }

  svg {
    width: 0.875rem;
    height: 0.875rem;
  }
`,m=l.span`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: var(--privy-color-foreground-2);
`,u=l(p)`
  color: var(--privy-color-icon-success);
  flex-shrink: 0;
`,x=l(g)`
  color: var(--privy-color-icon-muted);
  flex-shrink: 0;
`;function k({children:r,iconOnly:c,value:t,hideCopyIcon:n,onCopy:o,iconSize:i=14,...s}){let[f,d]=h.useState(!1);return e.jsxs(a,{...s,onClick:()=>{navigator.clipboard.writeText(t||(typeof r=="string"?r:"")).then(()=>o==null?void 0:o()).catch(console.error),d(!0),setTimeout(()=>d(!1),1500)},children:[r," ",f?e.jsxs(m,{children:[e.jsx(u,{size:i})," ",!c&&"Copied"]}):!n&&e.jsx(x,{size:i})]})}const w=({value:r,includeChildren:c,children:t,...n})=>{let[o,i]=h.useState(!1),s=()=>{navigator.clipboard.writeText(r).catch(console.error),i(!0),setTimeout(()=>i(!1),1500)};return e.jsxs(e.Fragment,{children:[c?e.jsx(a,{...n,onClick:s,children:t}):e.jsx(e.Fragment,{children:t}),e.jsx(a,{...n,onClick:s,children:o?e.jsx(m,{children:e.jsx(u,{})}):e.jsx(x,{})})]})};export{w as h,k as p};
