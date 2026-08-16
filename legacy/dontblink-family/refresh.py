#!/usr/bin/env python3
"""Re-capture the dontblink v1 archive.

Run from this directory:  python3 refresh.py [--no-images]

Sources, in order of authority:
  1. Robinhood Chain logs of the v1 launchpad (LaunchCreated + LaunchMetadata)
     -- the only source that survives the old site going dark.
  2. https://dontblink.family/api/tokens -- adds name/symbol/price/liquidity/volume
     and the re-hosted logo URLs. Optional: if it 404s, everything except those
     fields still rebuilds from chain.

Requires: foundry's `cast` on PATH, Pillow, and `magick` for animated GIFs.
"""
import argparse
import concurrent.futures as cf
import datetime
import hashlib
import json
import os
import subprocess
import sys
import urllib.request

RPC = "https://rpc.mainnet.chain.robinhood.com"
LAUNCHPAD = "0xF441cc979fa862f2674b9188A7b529caFd3ce204"
DEPLOY_BLOCK = 31524140
STEP = 250_000
API = "https://dontblink.family/api/tokens"
T_CREATED = "0xa84c89db4ef0ae60697badbc52ac5cd74ad3b5ba62c9152b523bbb964f2d7388"
T_META = "0x81757bd4a3f7375c9021d3bd561d1a8075d765544734931f26896acacda7ccdc"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
HERE = os.path.dirname(os.path.abspath(__file__))
IMGDIR = os.path.join(HERE, "images")
BASE = "/legacy/dontblink-family/images/"
MAX_PX = 384


def cast_logs(topic, head):
    out, b = [], DEPLOY_BLOCK
    while b <= head:
        e = min(b + STEP - 1, head)
        p = subprocess.run(
            ["cast", "logs", "--rpc-url", RPC, "--address", LAUNCHPAD, topic,
             "--from-block", str(b), "--to-block", str(e), "--json"],
            capture_output=True, text=True, timeout=300)
        p.check_returncode()
        out.extend(json.loads(p.stdout))
        b = e + 1
    return out


def dec_str(data, off):
    p = 2 + off * 2
    ln = int(data[p:p + 64], 16)
    return bytes.fromhex(data[p + 64: p + 64 + ln * 2]).decode("utf8", "replace")


def get(url, timeout=45):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-images", action="store_true")
    args = ap.parse_args()

    head = int(subprocess.run(["cast", "block-number", "--rpc-url", RPC],
                              capture_output=True, text=True, timeout=60).stdout.strip())
    print("head block", head)

    created = {}
    for lg in cast_logs(T_CREATED, head):
        d = lg["data"][2:]
        t = "0x" + lg["topics"][1][26:]
        created[t.lower()] = {
            "token": t,
            "deployer": "0x" + lg["topics"][2][26:],
            "pool": "0x" + d[24:64],
            "tokenId": str(int(d[64:128], 16)),
            "windowEnd": int(d[128:192], 16),
            "createdBlock": str(int(lg["blockNumber"], 16)),
            "txHash": lg["transactionHash"],
        }
    print("LaunchCreated", len(created))

    meta = {}
    for lg in cast_logs(T_META, head):
        t = "0x" + lg["topics"][1][26:]
        data = lg["data"]
        offs = [int(data[2 + i * 64: 2 + (i + 1) * 64], 16) for i in range(5)]
        meta[t.lower()] = dict(zip(
            ["imageURI", "xUrl", "webUrl", "tgUrl", "bio"],
            [dec_str(data, o) for o in offs]))
    print("LaunchMetadata", len(meta))

    api = {}
    try:
        api = json.loads(get(API, 60))
        print("api tokens", len(api.get("tokens", [])))
    except Exception as e:  # noqa: BLE001
        print("api unreachable, chain-only rebuild:", e)

    apim = {t["token"].lower(): t for t in api.get("tokens", [])}

    rows = []
    for k, c in created.items():
        a, m = apim.get(k, {}), meta.get(k, {})
        src = a.get("img") or ""
        if not src:
            uri = m.get("imageURI", "")
            if uri.startswith("ipfs://"):
                src = "https://ipfs.io/ipfs/" + uri[7:]
            elif uri.startswith(("http", "data:")):
                src = uri
        rows.append({**c,
                     "name": a.get("name", ""), "symbol": a.get("symbol", ""),
                     "createdAt": a.get("createdAt"),
                     "imageURI": m.get("imageURI", ""),
                     "xUrl": m.get("xUrl", "") or a.get("xUrl", ""),
                     "webUrl": m.get("webUrl", "") or a.get("webUrl", ""),
                     "tgUrl": m.get("tgUrl", ""), "bio": m.get("bio", ""),
                     "imgSource": src, "img": "",
                     "sqrtPriceX96": a.get("sqrtPriceX96"),
                     "liquidity": a.get("liquidity"),
                     "vol24hWeth": a.get("vol24hWeth"), "spark": a.get("spark")})
    rows.sort(key=lambda r: int(r["createdBlock"]))

    os.makedirs(IMGDIR, exist_ok=True)

    def key_for(url):
        if url.startswith("https://dontblink.family/api/token-images/"):
            return url.rsplit("/", 1)[-1]
        return "ext-" + hashlib.sha256(url.encode()).hexdigest()

    todo = {}
    for r in rows:
        if r["imgSource"]:
            todo.setdefault(key_for(r["imgSource"]), r["imgSource"])

    if not args.no_images:
        from PIL import Image
        import io

        def grab(item):
            key, url = item
            dst = os.path.join(IMGDIR, key + ".webp")
            if os.path.exists(dst):
                return key, True
            try:
                if url.startswith("data:"):
                    import base64
                    raw = base64.b64decode(url.split(",", 1)[1])
                else:
                    raw = get(url)
                with Image.open(io.BytesIO(raw)) as im:
                    if getattr(im, "n_frames", 1) > 1:
                        tmp = os.path.join(IMGDIR, key + ".src")
                        open(tmp, "wb").write(raw)
                        subprocess.run(["magick", tmp, "-coalesce", "-resize",
                                        f"{MAX_PX}x{MAX_PX}>", "-quality", "75", dst],
                                       capture_output=True, timeout=180)
                        os.remove(tmp)
                    else:
                        im2 = im.convert("RGBA") if im.mode in ("P", "LA", "RGBA") else im.convert("RGB")
                        im2.thumbnail((MAX_PX, MAX_PX), Image.LANCZOS)
                        im2.save(dst, "WEBP", quality=80, method=6)
                return key, os.path.exists(dst)
            except Exception:  # noqa: BLE001
                return key, False

        ok = 0
        with cf.ThreadPoolExecutor(max_workers=8) as ex:
            for _, good in ex.map(grab, todo.items()):
                ok += bool(good)
        print("images on disk", ok, "of", len(todo))

    idx = {}
    for key, url in todo.items():
        p = os.path.join(IMGDIR, key + ".webp")
        if os.path.exists(p):
            idx[key] = {"source": url, "bytes": os.path.getsize(p)}
    for r in rows:
        if r["imgSource"]:
            k = key_for(r["imgSource"])
            if k in idx:
                r["img"] = BASE + k + ".webp"

    capture = {
        "capturedAt": datetime.datetime.now(datetime.timezone.utc)
        .replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "source": "https://dontblink.family",
        "sourceApi": API,
        "chainId": api.get("chainId", 4663),
        "launchpad": LAUNCHPAD,
        "launchpadContractName": "V3LaunchpadGatedMax",
        "launchpadDeployBlock": DEPLOY_BLOCK,
        "apiBlockNumber": api.get("blockNumber", str(head)),
        "apiUpdatedAt": api.get("updatedAt"),
        "ethUsdAtCapture": api.get("ethUsd"),
        "cumulativeVolumeWeth": api.get("volumeWeth", "0"),
        "counts": {
            "tokens": len(rows),
            "onchainLaunchCreated": len(created),
            "onchainLaunchMetadata": len(meta),
            "withBio": sum(1 for r in rows if r["bio"]),
            "withTelegram": sum(1 for r in rows if r["tgUrl"]),
            "imagesArchived": len(idx),
            "tokensWithLocalImage": sum(1 for r in rows if r["img"]),
            "tokensWithoutImage": sum(1 for r in rows if not r["img"]),
        },
        "notes": [
            "tokens.json img fields point at this repo; imgSource keeps the original URL.",
            "sqrtPriceX96 / liquidity / vol24hWeth / spark are a point-in-time snapshot, not live.",
            "bio and tgUrl come from the on-chain LaunchMetadata event; the upstream "
            "/api/tokens does not expose them.",
        ],
    }

    json.dump(rows, open(os.path.join(HERE, "tokens.json"), "w"), indent=1)
    if api:
        json.dump(api, open(os.path.join(HERE, "tokens-api-raw.json"), "w"), indent=1)
    json.dump(capture, open(os.path.join(HERE, "capture.json"), "w"), indent=1)
    json.dump(idx, open(os.path.join(IMGDIR, "index.json"), "w"), indent=0)
    print(json.dumps(capture["counts"], indent=1))


if __name__ == "__main__":
    sys.exit(main())
