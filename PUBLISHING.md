# 发布这个站点之前，先读这个

`dontblink.community` 是 GitHub Pages 静态站，内容来自把 SPA 构建产物同步进本仓。
**目前有不止一个会话/人在发布它**，而每次发布覆盖的是**整站 bundle**。

## 已经出过的事故（2026-08-19）

一个会话用**不含 z500 路由**的 `ssi-launchpad-rh` 源码树构建，同步后
**线上已发布的 z500 板块整个消失**。当事会话发布前检查了：构建通过 ✅、
文件数正常 ✅、`.git` 没被覆盖 ✅、bundle 指向正确 ✅ —— **四项全过，一项都没能发现功能缺失**。

根因不是手滑，是流程必然：**多个源码树各自构建整站，谁后发谁的 bundle 就是全站。**

## 所以发布前必须做这一步：确认「只增不减」

```bash
# 1) 抓线上现在跑的 bundle
OLD=$(curl -s https://dontblink.community/ | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1)
curl -s "https://dontblink.community/assets/$OLD" -o /tmp/old.js

# 2) 我要发的 bundle
NEW=$(grep -oE 'index-[A-Za-z0-9_-]+\.js' <WEB>/dist/index.html | head -1)

# 3) 逐个查线上有、我没有的路由/板块
for k in z500 bridge affiliate treasury points curve drop claim fees explore changelog; do
  o=$(grep -c "$k" /tmp/old.js); n=$(grep -c "$k" "<WEB>/dist/assets/$NEW")
  [ "$o" -gt 0 ] && [ "$n" -eq 0 ] && echo "❌ 线上有 $k，我的构建没有 —— 停，别发"
done
```

**只要命中一条就停下。** 命中意味着：你的源码树不是唯一发布源，直接发会删掉别人的东西。
这时应该先搞清那部分功能从哪来，合进来之后再发。

## 发布前打个招呼

多个会话同时在的时候，发布前用 `SendMessage` 通知对方。收到的一方如果手上有未发布的
改动，回一句"我这有 X 没进你的树"。**事前一句话，比事后救线上便宜得多。**

## 其余流程

```bash
cd dbc-deploy
git fetch origin && git reset --hard origin/main   # 这个克隆容易分叉
bash scripts/sync-web.sh <path-to>/ssi-launchpad-rh/web
git status -s && git ls-files | wc -l              # 正常 2000+，掉到几十 = .git 被覆盖了
git add -A && git commit && git push origin main
```

推完**必须核实**，不是推完就算：

```bash
gh api repos/dontblinkcomm/dontblink-community/pages/builds/latest --jq .status
curl -s https://dontblink.community/ | grep -oE 'index-[A-Za-z0-9_-]+\.js'
```

**看根路径 `/`**，它先更新；子路径 HTML 有 CDN 缓存会滞后十几分钟，资源文件是即时的。

## 丢弃本地提交前

`dbc-deploy` 经常和远端分叉（本地留着老血脉提交）。`reset --hard` 之前**先逐个文件确认
内容远端已有**：

```bash
for f in <改动的文件>; do
  git cat-file -e origin/main:$f 2>/dev/null && echo "远端有 $f" || echo "⚠️ 远端没有 $f"
done
```

08-19 那次差点丢掉一个未推的 legacy 提交，是查了文件才发现内容其实已在远端。
