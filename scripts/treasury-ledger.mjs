// 金库账本快照 → /data/treasury.json。
//
// 为什么存在：官方 RPC 的 CORS 头会间歇性坏掉（08-28 首发、09-03 复发），浏览器全部
// 拒收，金库页整页「Couldn't read the chain」；publicnode 不给历史 getLogs；CF worker
// 代理又被上游的 Cloudflare 挡（error 1042）。服务器侧（Actions runner）直连没有 CORS
// 一说 —— 所以账本走快照，页面直连只做增量，直连挂了就用这份。
//
// 事件源两处都要扫：v2.12 起 FeesClaimed 从 LpLock 发（签名没变、地址变了）——
// 只扫 Portal 就会重演「8/18 之后平台没记录」（09-03 老板抓到的那个）。
//
// 输出是**解码后的中性事件**，不预排版 —— 排版逻辑只在前端一份，避免两份独立实现
// 各红各的（HoardLaunchE2E 的教训）。
import { mkdir, writeFile, readFile } from 'node:fs/promises'

const RPC = 'https://rpc.mainnet.chain.robinhood.com'
const PORTAL = '0x7a4eb7f99833178c6463184bd0d8d17b6fc2d59c'
const LP_LOCK = '0x137f67344563cc98b0e2a5ee644849bc846e070d'
const FEE_TREASURY = '0x6c71148e3acba6c5ecceffffcce17dc7a43e8f98'
const FROM_BLOCK = 38_269_916 // Portal 部署块（与 ours.mjs 一致）

// keccak 手算好的 topic0（node 无 viem；对着前端 parseAbiItem 的事件签名逐字校过）
// keccak 用 cast 现算的（别手抄，checksum 地址已经栽过 6 次）
const TOPIC = {
  feesClaimed: '0xbbd1d92c7ce0a939e197766ef1f870dda058c847032d4e0d4eb8ab530e400a9a',
  launchFee:   '0x93b3d968bee35c7241cecbc7a9b2713fb5cc3105bab6dae5c3ced8a960dad6c7',
  opsSpend:    '0x92f65adb40f1091f3c2a132ff923c7024dd208db2f0569c31c9428c891b5e475',
  buyback:     '0x96ae7f4e9a7580f1933fb51c2ab25547c2a489c6a5990e1783b0d861fdfbd5aa',
}

let idSeq = 1
async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: idSeq++, method, params }),
  })
  if (!r.ok) throw new Error(`${method} http ${r.status}`)
  const j = await r.json()
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`)
  return j.result
}

const word = (data, i) => data.slice(2 + 64 * i, 2 + 64 * (i + 1))
// 两种来源两种切法：topic 带 0x 前缀（32 字节 → 从 26 起），data word 不带（从 24 起）。
// 第一版混用 slice(24) → token 解出 0x0011c102…（多出两个 0、掉了尾巴）。
const addrT = (topic) => '0x' + topic.slice(26)
const addrW = (w) => '0x' + w.slice(24)
const num = (w) => BigInt('0x' + w).toString()

async function logsFor(address, topic0) {
  // 全量一把抓；量大再分片 —— 目前全站事件几百条级别
  return rpc('eth_getLogs', [{ address, topics: [topic0], fromBlock: '0x' + FROM_BLOCK.toString(16), toBlock: 'latest' }])
}

async function main() {
  const [claimsA, claimsB, launchFees, ops, burns] = await Promise.all([
    logsFor(PORTAL, TOPIC.feesClaimed),
    logsFor(LP_LOCK, TOPIC.feesClaimed),
    logsFor(PORTAL, TOPIC.launchFee),
    logsFor(FEE_TREASURY, TOPIC.opsSpend),
    logsFor(FEE_TREASURY, TOPIC.buyback),
  ])

  const events = []
  for (const l of [...claimsA, ...claimsB]) {
    events.push({
      type: 'claim', block: Number(l.blockNumber), tx: l.transactionHash,
      token: addrT(l.topics[1]),
      creator0: num(word(l.data, 0)), treasury0: num(word(l.data, 1)),
      creator1: num(word(l.data, 2)), treasury1: num(word(l.data, 3)),
      source: l.address.toLowerCase() === PORTAL ? 'portal' : 'lplock',
    })
  }
  for (const l of launchFees) {
    events.push({
      type: 'launchfee', block: Number(l.blockNumber), tx: l.transactionHash,
      payer: addrT(l.topics[1]), referrer: addrT(l.topics[2]),
      toReferrer: num(word(l.data, 0)), toTreasury: num(word(l.data, 1)),
    })
  }
  for (const l of ops) {
    // memo 是 string，偏移在第 3 字；快照只留前 96 字节的解码
    const off = parseInt(word(l.data, 1), 16) // amount 在 0，memo offset 在 1
    const len = parseInt(l.data.slice(2 + off * 2, 2 + off * 2 + 64), 16)
    const memoHex = l.data.slice(2 + off * 2 + 64, 2 + off * 2 + 64 + Math.min(len, 96) * 2)
    const memo = Buffer.from(memoHex, 'hex').toString('utf8')
    events.push({
      type: 'ops', block: Number(l.blockNumber), tx: l.transactionHash,
      asset: addrT(l.topics[1]), to: addrT(l.topics[2]),
      amount: num(word(l.data, 0)), memo,
    })
  }
  for (const l of burns) {
    events.push({
      type: 'buyback', block: Number(l.blockNumber), tx: l.transactionHash,
      assetIn: addrT(l.topics[1]),
      spent: num(word(l.data, 0)), burned: num(word(l.data, 1)),
    })
  }

  // 区块时间戳：去重后逐个拿（几十个级别），失败的条目留 0，前端显示区块号兜底
  const blocks = [...new Set(events.map((e) => e.block))]
  const ts = {}
  for (const b of blocks) {
    try {
      const blk = await rpc('eth_getBlockByNumber', ['0x' + b.toString(16), false])
      ts[b] = parseInt(blk.timestamp, 16)
    } catch { ts[b] = 0 }
  }
  for (const e of events) e.ts = ts[e.block] ?? 0
  events.sort((a, b) => b.block - a.block)

  await mkdir('data', { recursive: true })
  await writeFile('data/treasury.json', JSON.stringify({ at: Date.now(), fromBlock: FROM_BLOCK, events }))
  console.log(`treasury.json: ${events.length} events (claims=${claimsA.length}+${claimsB.length} lplock)`)
}

await main()
