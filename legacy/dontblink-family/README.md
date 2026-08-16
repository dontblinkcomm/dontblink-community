# dontblink v1 archive

A frozen, self-hosted copy of everything the original **dontblink.family** site knew about
its own launches, so none of it depends on that server staying up.

Browse it at [`/legacy/dontblink-family/`](./index.html).

## What is here

| File | What it is |
|---|---|
| `tokens.json` | Canonical registry — one entry per launch, chain fields + site fields merged, `img` rewritten to a local path |
| `tokens-api-raw.json` | Verbatim capture of `https://dontblink.family/api/tokens` (kept unmodified for diffing) |
| `capture.json` | When it was captured, from which block, and the counts below |
| `images/*.webp` | Every token logo, re-encoded (longest side 384px, animated GIFs stay animated) |
| `images/index.json` | `image key → {original URL, bytes}` |
| `index.html` | Static browser for the archive — no build step, reads the JSON directly |
| `refresh.py` | Re-runs the whole capture |

## Where the data comes from

1. **Robinhood Chain (authoritative).** The v1 launchpad
   `0xF441cc979fa862f2674b9188A7b529caFd3ce204` (verified as `V3LaunchpadGatedMax`,
   deployed at block 31,524,140) emits `LaunchCreated(token, deployer, pool, tokenId, windowEnd)`
   and `LaunchMetadata(token, imageURI, xUrl, webUrl, tgUrl, bio)`. Both were enumerated in full
   from the deploy block. This survives the old site going dark.
2. **`dontblink.family/api/tokens` (convenience).** Adds `name`, `symbol`, `createdAt` and a
   point-in-time market snapshot (`sqrtPriceX96`, `liquidity`, `vol24hWeth`, `spark`), plus the
   re-hosted logo URLs the images were pulled from.

The two agree exactly: 999 launches on chain, 999 in the API, zero on either side only.

## Counts at capture

- **999** tokens, **999** `LaunchCreated`, **962** `LaunchMetadata`
- **897** tokens with an archived logo (**794** unique images — duplicates are copycat launches
  reusing the same file); 101 launches never set an image; 1 logo was already dead upstream
  (`metadata.j7tracker.io`, 404 before we got there)
- **353** bios and **5** Telegram links — these live only on chain, the upstream API never
  exposed them
- Raw logos totalled 177.6 MB; the archived webp set is 8.7 MB

## Caveats

- Market fields are a **snapshot, not live**. `capture.json.apiBlockNumber` says exactly when.
- `img` points into this repo; `imgSource` keeps the original URL so the rewrite is auditable.
- One token genuinely has an empty symbol (`0x7d7cb7ff…7243`, name `NO TICKER`) — verified by
  calling `symbol()` on chain, not a capture bug.

## Refreshing

```bash
cd legacy/dontblink-family
python3 refresh.py            # full re-capture (needs foundry `cast`, Pillow, `magick`)
python3 refresh.py --no-images # JSON only
```

`refresh.py` is chain-first: if `dontblink.family` is gone, it still rebuilds the registry from
events and only loses the name/symbol/market columns.
