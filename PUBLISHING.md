# 发布这个站点之前，先读这个

`dontblink.community` 是 GitHub Pages 静态站，内容来自把 SPA 构建产物同步进本仓。
**目前有不止一个会话/人在发布它**，而每次发布覆盖的是**整站 bundle**。

## 已经出过的事故（2026-08-19）

一个会话用**不含 z500 路由**的 `ssi-launchpad-rh` 源码树构建，同步后
**线上已发布的 z500 板块整个消失**。当事会话发布前检查了：构建通过 ✅、
文件数正常 ✅、`.git` 没被覆盖 ✅、bundle 指向正确 ✅ —— **四项全过，一项都没能发现功能缺失**。

根因不是手滑，是流程必然：**多个源码树各自构建整站，谁后发谁的 bundle 就是全站。**

## 所以发布前必须做这一步：资产清单比对（少一个 chunk 就停）

**不要用关键词比对。** 08-19 试过，它抓不到新增的东西：`/z500/onboard` 是**新**路由、
门槛控件是页面内的一个控件 —— 线上 bundle 有、旧 bundle 没有，反向比对根本不会报。
关键词比对只在"我知道该查什么"时有效，而那正是最不该依赖的前提。

改成**文件级**：线上有的 chunk，本次构建必须都有。

```bash
WEB=<path-to>/ssi-launchpad-rh/web

# 1) 线上资产清单（从 index.html 递归取所有 chunk 名）
curl -s https://dontblink.community/ -o /tmp/live.html
LIVE_MAIN=$(grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' /tmp/live.html | head -1)
curl -s "https://dontblink.community/$LIVE_MAIN" -o /tmp/live-main.js
# 主 chunk 里引用的其它 chunk（Vite 用相对路径 import）
grep -oE '"\./[A-Za-z0-9_-]+-[A-Za-z0-9_-]+\.js"' /tmp/live-main.js \
  | tr -d '"./' | sort -u > /tmp/live-chunks.txt
grep -oE 'assets/[A-Za-z0-9_-]+-[A-Za-z0-9_-]+\.js' /tmp/live.html \
  | sed 's|assets/||' | sort -u >> /tmp/live-chunks.txt

# 2) 本次构建的清单（按 chunk 名去掉 hash 比对，hash 每次都变）
ls "$WEB/dist/assets/" | grep '\.js$' | sed -E 's/-[A-Za-z0-9_-]{8}\.js$//' | sort -u > /tmp/new-names.txt
sed -E 's/-[A-Za-z0-9_-]{8}\.js$//' /tmp/live-chunks.txt | sort -u > /tmp/live-names.txt

# 3) 线上有、本次构建没有的 —— 一个都不该有
comm -23 /tmp/live-names.txt /tmp/new-names.txt
```

**输出非空就停下。** 每一行都是一个你即将从线上删掉的页面/功能。

停下之后要做的不是"想办法绕过检查"，而是搞清那个 chunk 从哪来 ——
**大概率是对方手上有还没推上 origin 的提交**（08-19 两次事故都是这个形状）。

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

## 最根本的一条：推完自己确认，别信返回码

08-19 两次事故的共同点：**双方都把 `origin` 当成了对方的真相，而 origin 两次都是过时的。**

一次是合并了 `origin/feat/z500-bsc`，但对方最新的提交还在他本地；
一次是我以为 `git push` 成功了 —— 它返回 0、`&& echo "已推"` 也打印了，
但 `origin/master` 根本没变。

根因是配置：`push.default = upstream`，而 `master` 的 upstream 被配成了 `origin/main`。
于是 `git push origin master` 推的是 `main`（本来就最新）→ 报 `Everything up-to-date`。

**所以推完必须问 GitHub，不是看返回码：**

```bash
git push origin <branch>:refs/heads/<branch>     # 用完整 refspec，绕开 push.default
git ls-remote origin <branch>                    # 权威，和本地 rev-parse 对一遍
```

同理，合并别人的分支之前，先跟对方确认 `origin` 上那条是不是他的最新。
