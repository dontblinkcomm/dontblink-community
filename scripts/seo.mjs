// SEO 落地页 + sitemap —— 让每一枚币在搜索引擎和社交卡片里都有自己的入口。
//
// 为什么要有：站点是纯前端 SPA，此前还是 hash 路由（#/t/0x…），1006 个 token 页对 Google
// 全部不存在，分享到 X/TG 永远是同一张站点默认卡片。老站 dontblink.family 不在我们手里，
// 承接不了 301 —— 那就把自己的每一页做成可被索引、可被分享的东西。
//
// 做法（GitHub Pages 没有服务端）：
//   1. 以当前 index.html 为模板，给每个币生成 /t/<pool>/index.html（v1 与 v2 Instant）、
//      /curve/<token>/index.html（内盘）、/drop/<token>/index.html（Fair Drop），
//      只替换 <title> / description / og:* / twitter:* / canonical，其余照抄 —— 所以它就是 App 本身，
//      浏览器打开直接进 App，爬虫读到的是这枚币的元信息。
//   2. sitemap.xml + robots.txt。
//   3. 404.html = index.html 副本（BrowserRouter 深链接的兜底；老的 404.html 引用着 08-15 的旧 bundle）。
//   4. v2 币的 logo 是链上 data:URI，og:image 必须是 URL —— 落成 /img/<token>.jpg。
//
// 每次 cron（跟着 ours.mjs）与每次发版都要跑：模板 index.html 一变（bundle hash 变），全部入口页跟着变。
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const SITE = 'https://dontblink.community'
const tpl = await readFile('index.html', 'utf8')
const ours = JSON.parse(await readFile('data/ours.json', 'utf8'))

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

/** 把模板里的站点级元信息换成这枚币的。只动 head 里那几行，别的一个字不碰。 */
function renderStub({ title, description, image, url }) {
  let h = tpl
  h = h.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
  h = h.replace(/(<meta\s+name="description"\s+content=")[^"]*(")/s, `$1${esc(description)}$2`)
  h = h.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
  h = h.replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/s, `$1${esc(description)}$2`)
  h = h.replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${esc(image)}$2`)
  h = h.replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
  h = h.replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/s, `$1${esc(description)}$2`)
  h = h.replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${esc(image)}$2`)
  // canonical + og:url：没有就加在 </head> 前
  const extra = `<link rel="canonical" href="${esc(url)}" />\n    <meta property="og:url" content="${esc(url)}" />\n  </head>`
  h = h.replace(/<link rel="canonical"[^>]*>\s*/g, '').replace(/<meta property="og:url"[^>]*>\s*/g, '')
  h = h.replace('</head>', extra)
  return h
}

// ---- 清掉上一轮生成的入口页（币可能被 SUPERSEDED 隐掉）----
for (const dir of ['t', 'curve', 'drop']) {
  if (existsSync(dir)) {
    for (const d of await readdir(dir)) await rm(`${dir}/${d}`, { recursive: true, force: true })
  }
}
await mkdir('img', { recursive: true })

const urls = [
  { loc: `${SITE}/`, pri: '1.0' },
  { loc: `${SITE}/explore`, pri: '0.9' },
  { loc: `${SITE}/launch`, pri: '0.9' },
  { loc: `${SITE}/fees`, pri: '0.4' },
]
let stubs = 0
let imgs = 0
for (const t of ours.tokens) {
  const sym = t.symbol || 'token'
  const name = t.name || sym
  const path =
    t.mode === 'curve' ? `/curve/${t.token}` : t.mode === 'queue' ? `/drop/${t.token}` : t.pool ? `/t/${t.pool}` : null
  if (!path) continue
  const url = SITE + path

  // og:image：v1 用存档 webp（站内路径）；v2 的 data:URI 落成文件；都没有用站点默认图
  let image = `${SITE}/banner-card.png`
  if (t.imageUrl?.startsWith('/')) image = SITE + t.imageUrl
  else if (t.imageUrl?.startsWith('data:image/')) {
    const m = t.imageUrl.match(/^data:image\/(\w+);base64,(.+)$/)
    if (m) {
      const ext = m[1] === 'jpeg' ? 'jpg' : m[1]
      await writeFile(`img/${t.token}.${ext}`, Buffer.from(m[2], 'base64'))
      image = `${SITE}/img/${t.token}.${ext}`
      imgs++
    }
  } else if (t.gt?.img?.startsWith('http')) image = t.gt.img

  const modeWord =
    t.mode === 'curve' ? 'on the bonding curve' : t.mode === 'queue' ? 'in a Fair Drop queue' : 'on Robinhood Chain'
  // 描述里**不放价格/成交量**：那会让每 10 分钟的 cron 重写一千个文件。入口页只在
  // bundle 变、新币出现或元信息变时才变 —— 实时数字由 App 加载后自己渲染。
  const stub = renderStub({
    title: `${name} ($${sym}) · dontblink`,
    description: `Trade ${name} ($${sym}) ${modeWord} — launched on dontblink, the fair launchpad on Robinhood Chain.`,
    image,
    url,
  })
  await mkdir(`.${path}`, { recursive: true })
  await writeFile(`.${path}/index.html`, stub)
  urls.push({ loc: url, pri: t.mode === 'v1' ? '0.5' : '0.7' })
  stubs++
}

// ---- tokenlist.json：Uniswap 风格 token list，每枚币带 https 的 logoURI ----
// 站内 logo 来自链上 LaunchMetadata 的 data:URI，站外（钱包 / 聚合器 / 有的 DEX 前端）不读那个，
// 它们认 token list 或自己的收录。这里把我们全部的币（v1 存档 + v2）连同 /img/<token>.jpg、
// /legacy/.../images/<hash>.webp 一起发成一份列表，谁要接就接 https://dontblink.community/tokenlist.json。
// 此前这个文件是 07-09 的手写版，只有 2 枚测试币。
{
  const v1imgs = new Set(existsSync('legacy/dontblink-family/images') ? await readdir('legacy/dontblink-family/images') : [])
  const list = []
  for (const t of ours.tokens) {
    if (!t.token || !t.symbol) continue
    let logo = null
    if (t.imageUrl?.startsWith('/')) logo = SITE + t.imageUrl
    else if (t.imageUrl?.startsWith('data:image/')) {
      const ext = t.imageUrl.match(/^data:image\/(\w+);/)?.[1]
      const file = `${t.token}.${ext === 'jpeg' ? 'jpg' : ext}`
      if (existsSync(`img/${file}`)) logo = `${SITE}/img/${file}`
    } else if (t.imageUrl?.includes('dontblink.family/api/token-images/')) {
      const hash = t.imageUrl.split('/').pop()
      if (v1imgs.has(`${hash}.webp`)) logo = `${SITE}/legacy/dontblink-family/images/${hash}.webp`
      else logo = t.imageUrl
    } else if (t.imageUrl?.startsWith('http')) logo = t.imageUrl
    else if (t.gt?.img?.startsWith('http')) logo = t.gt.img
    const entry = { chainId: 4663, address: t.token, name: (t.name || t.symbol).slice(0, 40), symbol: t.symbol.slice(0, 20), decimals: 18 }
    if (logo) entry.logoURI = logo
    entry.tags = [t.mode === 'v1' ? 'v1' : 'v2']
    list.push(entry)
  }
  const tokenlist = {
    name: 'dontblink',
    timestamp: new Date(ours.at || Date.now()).toISOString(),
    version: { major: 2, minor: 0, patch: 0 },
    logoURI: `${SITE}/logo.png`,
    keywords: ['dontblink', 'robinhood chain', 'launchpad'],
    tags: {
      v1: { name: 'dontblink v1', description: 'Launched on the original dontblink launchpad (archived)' },
      v2: { name: 'dontblink v2', description: 'Launched through the dontblink v2 Portal' },
    },
    tokens: list,
  }
  await writeFile('tokenlist.json', JSON.stringify(tokenlist))
  console.log(`tokenlist: ${list.length} tokens, ${list.filter((t) => t.logoURI).length} with logo`)
}

// ---- 站点级静态路由也给真实的 200 页（否则 /explore 直接访问是 404 状态码，爬虫会当它不存在）----
const STATIC_PAGES = {
  explore: ['Explore tokens · dontblink', 'Every token launched on dontblink, live prices and trading on Robinhood Chain.'],
  launch: ['Launch a token · dontblink', 'One click, gas only. Fixed supply, locked liquidity, no presale — launch on Robinhood Chain.'],
  fees: ['Fees · dontblink', 'Claim your creator fees from every trade of your token, forever.'],
  bridge: ['Bridge · dontblink', 'Bridge to Robinhood Chain to trade and launch on dontblink.'],
  points: ['Points · dontblink', 'Points and referrals on dontblink.'],
  'v1-fees': ['v1 fees · dontblink', 'Claim creator fees for tokens launched on dontblink v1.'],
  claim: ['Celebrity claim · dontblink', 'Verify your X handle and claim the vault bound to it.'],
  rewards: ['Fees · dontblink', 'Claim your creator fees from every trade of your token, forever.'],
  changelog: ['What’s new · dontblink', 'Release notes for dontblink — every feature, fix and speed-up we ship.'],
  affiliate: ['Affiliate · dontblink', 'Your link pays you: a cut of every launch and opening-window buy, on-chain, instantly.'],
}
for (const [seg, [title, description]] of Object.entries(STATIC_PAGES)) {
  await mkdir(seg, { recursive: true })
  await writeFile(`${seg}/index.html`, renderStub({ title, description, image: `${SITE}/banner-card.png`, url: `${SITE}/${seg}` }))
}

// ---- sitemap / robots / 404 ----
const today = new Date(ours.at || Date.now()).toISOString().slice(0, 10)
const sitemap =
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${today}</lastmod><priority>${u.pri}</priority></url>`).join('\n') +
  `\n</urlset>\n`
await writeFile('sitemap.xml', sitemap)
await writeFile('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`)
// 深链接兜底：必须是**当前** index.html 的副本，否则 /t/… 这类路径会加载旧 bundle
await writeFile('404.html', tpl)

console.log(`seo: ${stubs} token pages, ${imgs} images, sitemap ${urls.length} urls, 404.html synced`)
