// Offline unit tests for the pure scoring in points.mjs (no network).
// Run: node scripts/points.test.mjs
import assert from 'node:assert/strict'
import { computePoints } from './points.mjs'

let n = 0
const t = (name, fn) => { fn(); n++; console.log(`ok  ${name}`) }
const pts = (r, a) => r.points.get(a.toLowerCase()) ?? 0

// base volume -> points, per-wallet trade count
t('base volume becomes points', () => {
  const r = computePoints({
    trades: [
      { id: '1', trader: '0xAA', volumeUsd: 100 },
      { id: '2', trader: '0xAA', volumeUsd: 50 },
      { id: '3', trader: '0xBB', volumeUsd: 30 },
    ],
    referralBindings: [],
  })
  assert.equal(pts(r, '0xAA'), 150)
  assert.equal(pts(r, '0xBB'), 30)
  assert.equal(r.wallets.get('0xaa').trades, 2)
})

// duplicate trade id counted once (overlapping pools / rerun guard)
t('dedup by trade id', () => {
  const r = computePoints({
    trades: [
      { id: 'dup', trader: '0xAA', volumeUsd: 100 },
      { id: 'dup', trader: '0xAA', volumeUsd: 100 },
    ],
    referralBindings: [],
  })
  assert.equal(pts(r, '0xAA'), 100)
  assert.equal(r.wallets.get('0xaa').trades, 1)
})

// zero / negative / missing volume ignored, no NaN
t('bad volume ignored', () => {
  const r = computePoints({
    trades: [
      { id: '1', trader: '0xAA', volumeUsd: 0 },
      { id: '2', trader: '0xAA', volumeUsd: -5 },
      { id: '3', trader: '0xAA', volumeUsd: 'x' },
      { id: '4', trader: '0xAA', volumeUsd: 10 },
    ],
    referralBindings: [],
  })
  assert.equal(pts(r, '0xAA'), 10)
})

// referral bonus = 10% of invitee base
t('referral bonus', () => {
  const r = computePoints({
    trades: [{ id: '1', trader: '0xBB', volumeUsd: 200 }],
    referralBindings: [{ invitee: '0xBB', referrer: '0xAA' }],
  })
  assert.equal(pts(r, '0xBB'), 200)
  assert.equal(pts(r, '0xAA'), 20) // 10% of 200
  assert.equal(r.referrals.get('0xaa'), 1)
})

// self-referral does not pay
t('self-referral guard', () => {
  const r = computePoints({
    trades: [{ id: '1', trader: '0xAA', volumeUsd: 100 }],
    referralBindings: [{ invitee: '0xAA', referrer: '0xAA' }],
  })
  assert.equal(pts(r, '0xAA'), 100) // base only, no self bonus
  assert.equal(r.referrals.get('0xaa') ?? 0, 0)
})

// only the first binding for an invitee counts
t('first referral binding wins', () => {
  const r = computePoints({
    trades: [{ id: '1', trader: '0xCC', volumeUsd: 100 }],
    referralBindings: [
      { invitee: '0xCC', referrer: '0xAA' },
      { invitee: '0xCC', referrer: '0xBB' },
    ],
  })
  assert.equal(pts(r, '0xAA'), 10)
  assert.equal(pts(r, '0xBB') ?? 0, 0)
})

// invitee with no volume yields no bonus
t('no-volume invitee yields no bonus', () => {
  const r = computePoints({
    trades: [],
    referralBindings: [{ invitee: '0xBB', referrer: '0xAA' }],
  })
  assert.equal(pts(r, '0xAA') ?? 0, 0)
})

console.log(`\n${n} tests passed`)
