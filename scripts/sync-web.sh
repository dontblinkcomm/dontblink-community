#!/bin/bash
# Copy a fresh SPA build into this Pages repo, without touching anything the repo owns.
#
#   bash scripts/sync-web.sh [path-to-ssi-launchpad-rh/web]
#
# Deliberately no --delete. Most of this repo is not build output and would be wiped by it:
#   .github/  the cron workflows that write data/
#   legacy/   the frozen v1 archive (its own page + tokens.json + logos + the fee index)
#   data/     the cron-written snapshots (points, boards)
#   scripts/  this file and its neighbours
#   CNAME, logo.png, tokenlist.json
# Old hashed assets are left behind on purpose too: a visitor holding a cached index.html is
# still asking for the bundle it was cut from, and Pages has no other copy of it.
#
# 404.html is a byte-for-byte copy of index.html: this is a hash-router SPA, and a Pages 404
# that is anything else means a deep link renders whatever stale bundle that file was cut from.
set -euo pipefail
HERE=$(cd "$(dirname "$0")/.." && pwd)
WEB=${1:-$HERE/../ssi-launchpad-rh/web}

[ -d "$WEB/dist" ] || { echo "no build at $WEB/dist — run 'npm run build' there first"; exit 1; }

# --exclude=.git 不是保险起见，是修一个实际存在的地雷：
# web/dist/ 里躺着一个几个月前 "deploy v0.2" 时代遗留的 .git 空壳仓（无远端，
# 而 dist/ 被 gitignore 所以一直没人看见）。不排除的话 rsync -a 会把它盖到本仓的
# .git 上 —— 2026-08-18 实测：索引从 1955 个文件掉到 23 个、22 个线上资源显示被删、
# HEAD 都被换成了那个空壳仓的。那一步之后要是直接 commit && push，生产仓就毁了。
# 当时是提交前核对 git status 才拦下的。
rsync -a --exclude=.git "$WEB/dist/" "$HERE/"

cp "$HERE/index.html" "$HERE/404.html"

echo "synced $(cd "$WEB" && git rev-parse --short HEAD) → $HERE"
cmp -s "$HERE/index.html" "$HERE/404.html" && echo "  404.html == index.html ✓"
grep -o 'assets/[a-zA-Z0-9._-]*' "$HERE/index.html" | sort -u | sed 's/^/  /'

# 同步完自检：这个仓自己的东西一件都不能少。上面那次事故就是这几样被清掉的。
missing=0
for p in .github data scripts legacy CNAME tokenlist.json; do
  [ -e "$HERE/$p" ] || { echo "  !! $p 不见了 —— 不要提交，检查 rsync"; missing=1; }
done
git -C "$HERE" rev-parse --git-dir >/dev/null 2>&1 || { echo "  !! .git 坏了"; missing=1; }
[ "$missing" = 0 ] && echo "  仓库自有文件完好 ✓" || exit 1
