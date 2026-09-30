// 最小 keccak-256（Ethereum 用的原版 Keccak，**不是** NIST SHA-3 —— 两者填充不同，
// node 内置的 'sha3-256' 出来的结果是错的，别用）。只为地址 checksum 服务。
// ⚠️ 写完必须对着 `cast to-check-sum-address` 验一批再用（本仓 scripts/tokenlist.mjs 启动时会自检）。
const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
]
const R = [
  [0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61], [28, 55, 25, 21, 56], [27, 20, 39, 8, 14],
]
const M = (1n << 64n) - 1n
const rotl = (x, n) => n === 0 ? x : (((x << BigInt(n)) | (x >> BigInt(64 - n))) & M)

function keccakF(A) {
  for (let round = 0; round < 24; round++) {
    const C = []
    for (let x = 0; x < 5; x++) C[x] = A[x][0] ^ A[x][1] ^ A[x][2] ^ A[x][3] ^ A[x][4]
    for (let x = 0; x < 5; x++) {
      const D = C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1)
      for (let y = 0; y < 5; y++) A[x][y] ^= D
    }
    const B = [[], [], [], [], []]
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) B[y][(2 * x + 3 * y) % 5] = rotl(A[x][y], R[x][y])
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) A[x][y] = B[x][y] ^ (~B[(x + 1) % 5][y] & M & B[(x + 2) % 5][y])
    A[0][0] ^= RC[round]
  }
  return A
}

export function keccak256(bytes) {
  const rate = 136 // 1088 bits for keccak-256
  const pad = rate - (bytes.length % rate)
  const buf = new Uint8Array(bytes.length + pad)
  buf.set(bytes)
  buf[bytes.length] = 0x01            // Keccak 原版填充（SHA-3 是 0x06 —— 这一位就是两者的全部区别）
  buf[buf.length - 1] |= 0x80
  const A = [[], [], [], [], []]
  for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) A[x][y] = 0n
  for (let off = 0; off < buf.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = 0n
      for (let b = 7; b >= 0; b--) lane = (lane << 8n) | BigInt(buf[off + i * 8 + b])
      A[i % 5][(i / 5) | 0] ^= lane
    }
    keccakF(A)
  }
  const out = new Uint8Array(32)
  for (let i = 0; i < 4; i++) {
    let lane = A[i % 5][(i / 5) | 0]
    for (let b = 0; b < 8; b++) { out[i * 8 + b] = Number(lane & 0xffn); lane >>= 8n }
  }
  return out
}

/** EIP-55 校验和地址。 */
export function toChecksum(addr) {
  const lower = addr.toLowerCase().replace(/^0x/, '')
  const hash = keccak256(new TextEncoder().encode(lower))
  const hex = [...hash].map((b) => b.toString(16).padStart(2, '0')).join('')
  let out = '0x'
  for (let i = 0; i < 40; i++) out += parseInt(hex[i], 16) >= 8 ? lower[i].toUpperCase() : lower[i]
  return out
}
