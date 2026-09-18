/** Attribution display contract, not a GMGN write API or a token-logo replacement. */
import assert from 'node:assert/strict'
export const PLATFORM_LOGO = Object.freeze({
  url: 'https://dontblink.community/brand/dontblink-platform-badge.png',
  mediaType: 'image/png',
  sha256: '8cded1abeec35385f866941c8d7d11b5686e5a4e4c5a35beaf123ab65e385dff',
})
export function platformBadgeFor(record) {
  if (record.recognized !== true) return null
  if (record.schema !== 'dontblink.verified.v1' || record.chainId !== 4663 ||
    !/^0x[0-9a-f]{40}$/.test(record.token ?? '') || /^0x0+$/.test(record.token)) throw new Error('Unsupported badge identity')
  const historical = record.evidence?.kind === 'registry' && record.evidence.uri === 'https://dontblink.community/data/ours.json' && /^[0-9a-f]{64}$/.test(record.evidence.inputSha256 ?? '')
  const event = record.evidence?.kind === 'event'
  if (record.source === 'registered') {
    if (!event || record.evidence.line !== 'wink' || record.launchMode !== 'wink' || record.launchedOnDontblink !== false) throw new Error('Registered badge needs verified Wink mechanism attribution')
  } else if (!['factory', 'clone'].includes(record.source) || record.launchedOnDontblink !== true || (!historical && !event)) {
    throw new Error('No supported platform attribution')
  }
  // Called only after the registry has established positive identity. Badge fields never establish it themselves.
  return {
    schema: 'dontblink.platform-badge.v1', platformId: 'dontblink', label: 'dontblink',
    placement: 'token_avatar_corner', logo: { ...PLATFORM_LOGO },
    relation: record.source === 'registered' ? 'mechanism_provider' : 'launch_origin',
    description: record.source === 'registered'
      ? 'dontblink mechanism integration; the underlying token may be deployed by a third-party launchpad.'
      : 'Token attributed to dontblink launch infrastructure by the maintained registry.',
    tokenLogoUnchanged: true,
    disclaimer: 'Platform attribution only. Not an audit, risk rating, listing approval or LP-lock guarantee.',
  }
}
/** Old v1 records can omit the additive field. Unknown/tombstone records must omit it. */
export function validatePlatformBadge(record) {
  if (record.platformBadge === undefined) return
  assert.equal(record.recognized, true, 'Unknown identity cannot carry a platform badge')
  assert.deepEqual(record.platformBadge, platformBadgeFor(record), 'Platform badge must match verified attribution and fixed brand asset')
}
