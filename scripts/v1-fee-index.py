#!/usr/bin/env python3
"""Build the data the v1 fee-claim page needs, from the frozen v1 archive + live chain.

Two outputs, both written next to the archive:

  legacy/dontblink-family/dev-index.json   deployer -> [[token, tokenId, symbol, name], ...]
      A slim lookup so the claim page never has to pull the 1 MB registry. Static: the v1
      launchpad records the deployer at launch and it can never change.

  legacy/dontblink-family/v1-fees.json     aggregate snapshot + the list of bricked launches
      Live figures, so it goes stale. The page shows the capture time and reads the exact
      numbers for the connected wallet straight off the chain anyway.

Why the "bricked" list exists: V1.claim() pays half the collected LP fee to the deployer and
half to the treasury as plain ERC20 transfers. The launch token enforces a 2% max-wallet cap
and neither payee is exempt, so once a launch's accrued token-side fee grows past 2x that cap
the transfer reverts and takes the whole claim -- WETH included -- down with it. Only the v1
owner can fix that, via exemptToken().

Usage:
  python3 scripts/v1-fee-index.py            # index + live snapshot
  python3 scripts/v1-fee-index.py --no-scan  # index only (no RPC)
"""
import json
import os
import sys
import time
import urllib.request

RPC = "https://rpc.mainnet.chain.robinhood.com"
V1 = "0xF441cc979fa862f2674b9188A7b529caFd3ce204"
NFPM = "0x73991a25c818bf1f1128deaab1492d45638de0d3"
WETH = "0x0bd7d308f8e1639fab988df18a8011f41eacad73"
NEUTRAL_CALLER = "0x000000000000000000000000000000000000dEaD"
MAX128 = (1 << 128) - 1

HERE = os.path.dirname(os.path.abspath(__file__))
ARCHIVE = os.path.join(os.path.dirname(HERE), "legacy", "dontblink-family")


def rpc(payload):
    req = urllib.request.Request(
        RPC,
        data=json.dumps(payload).encode(),
        headers={"content-type": "application/json", "User-Agent": "curl/8.7.1"},
    )
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read())
        except Exception:
            if attempt == 4:
                raise
            time.sleep(1.5 * (attempt + 1))


def batched_calls(items, to, data_of, batch=40, caller=NEUTRAL_CALLER):
    """items -> {index: ('ok', hexdata) | ('revert', reason)}"""
    out = {}
    for s in range(0, len(items), batch):
        chunk = items[s : s + batch]
        payload = [
            {
                "jsonrpc": "2.0",
                "id": s + j,
                "method": "eth_call",
                "params": [{"from": caller, "to": to, "data": data_of(it)}, "latest"],
            }
            for j, it in enumerate(chunk)
        ]
        for item in rpc(payload):
            if "error" in item:
                out[item["id"]] = ("revert", decode_revert(item["error"].get("data") or ""))
            else:
                out[item["id"]] = ("ok", item["result"])
        print(f"  {min(s + batch, len(items))}/{len(items)}", file=sys.stderr, flush=True)
    return out


def decode_revert(data: str) -> str:
    if not data or data == "0x":
        return "revert"
    if data.startswith("0x08c379a0"):
        body = data[10:]
        try:
            off = int(body[0:64], 16) * 2
            ln = int(body[off : off + 64], 16) * 2
            return bytes.fromhex(body[off + 64 : off + 64 + ln]).decode("utf8", "replace")
        except Exception:
            return "revert"
    return "custom:" + data[:10]


def main():
    tokens = json.load(open(os.path.join(ARCHIVE, "tokens.json")))

    # ---- dev-index.json (pure archive derivation, no RPC) ----
    index = {}
    for t in tokens:
        index.setdefault(t["deployer"].lower(), []).append(
            [t["token"], str(t["tokenId"]), t.get("symbol") or "", t.get("name") or ""]
        )
    dev_path = os.path.join(ARCHIVE, "dev-index.json")
    json.dump(
        {"launchpad": V1, "chainId": 4663, "launches": len(tokens), "devs": len(index), "byDev": index},
        open(dev_path, "w"),
        separators=(",", ":"),
    )
    print(f"dev-index.json: {len(index)} devs / {len(tokens)} launches "
          f"({os.path.getsize(dev_path) / 1024:.0f} KB)")

    if "--no-scan" in sys.argv:
        return

    # ---- live scan: what each position still holds, and whether claim() would go through ----
    print("static-collect on every position…", file=sys.stderr)
    fees = batched_calls(
        tokens,
        NFPM,
        lambda t: "0xfc6f7865"
        + "".join(f"{w:064x}" for w in (int(t["tokenId"]), int(V1, 16), MAX128, MAX128)),
        # NFPM.collect only answers the position owner, which is the launchpad itself
        caller=V1,
    )
    print("simulating claim() on every launch…", file=sys.stderr)
    claims = batched_calls(tokens, V1, lambda t: "0x1e83409a" + f"{int(t['token'], 16):064x}")

    now = int(time.time())
    stats = {"claimable": 0, "nothing": 0, "capped": 0, "windowOpen": 0, "other": 0}
    weth = {"claimable": 0, "capped": 0, "other": 0}
    bricked, claimable_devs = [], set()

    for i, t in enumerate(tokens):
        fkind, fval = fees.get(i, ("revert", "missing"))
        w = tok = 0
        if fkind == "ok" and len(fval) >= 130:
            raw = fval[2:]
            a0, a1 = int(raw[0:64], 16), int(raw[64:128], 16)
            token_is_0 = t["token"].lower() < WETH.lower()
            w, tok = (a1, a0) if token_is_0 else (a0, a1)

        ckind, creason = claims.get(i, ("revert", "missing"))
        if ckind == "ok":
            if w or tok:
                stats["claimable"] += 1
                weth["claimable"] += w
                claimable_devs.add(t["deployer"].lower())
            else:
                stats["nothing"] += 1
        elif "pay failed" in creason:
            stats["capped"] += 1
            weth["capped"] += w
            bricked.append({
                "token": t["token"], "symbol": t.get("symbol"), "name": t.get("name"),
                "deployer": t["deployer"], "weth": str(w), "tokens": str(tok),
            })
        elif "TF" in creason and t["windowEnd"] > now:
            stats["windowOpen"] += 1
        else:
            stats["other"] += 1
            weth["other"] += w

    head = rpc({"jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": []})
    snap = {
        "capturedAt": now,
        "block": int(head["result"], 16),
        "launchpad": V1,
        "counts": stats,
        "wethOutstanding": str(weth["claimable"] + weth["capped"] + weth["other"]),
        "wethClaimable": str(weth["claimable"]),
        "wethBricked": str(weth["capped"]),
        "devsWithClaimable": len(claimable_devs),
        "bricked": sorted(bricked, key=lambda b: -int(b["weth"])),
    }
    json.dump(snap, open(os.path.join(ARCHIVE, "v1-fees.json"), "w"), indent=1)

    print(f"\nblock {snap['block']}")
    print(f"  claimable now : {stats['claimable']:4d} launches  "
          f"{weth['claimable'] / 1e18:.4f} WETH ({len(claimable_devs)} devs)")
    print(f"  bricked by cap: {stats['capped']:4d} launches  {weth['capped'] / 1e18:.4f} WETH")
    print(f"  window open   : {stats['windowOpen']:4d}")
    print(f"  nothing owed  : {stats['nothing']:4d}")
    print(f"  other reverts : {stats['other']:4d}  {weth['other'] / 1e18:.4f} WETH")


if __name__ == "__main__":
    main()
