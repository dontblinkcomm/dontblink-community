# GMGN 接入交接包：来源识别与项目生命周期

**编写时状态（2026-09-18 00:10 UTC 观测）：v1 来源识别已在公网运行；本包的 lifecycle 扩展已实现并离线验证，当时尚未发布。实时是否已到达以 `.lifecycle.schema` 与文件 HTTP 验收为准。**
本包不代表 GMGN 已接受合作、已提交项目、已收录币种，也不会主动向 GMGN 发送任何资料。

## 1. 给接入方的最小合同

Base：`https://dontblink.community/data/verified/`。GET、静态 JSON、无鉴权；成功响应需要 JSON Content-Type 和允许 GMGN Origin 的 CORS。

| GET 路径 | 已有合同 | 本次兼容新增 |
|---|---|---|
| `4663/index.json` | `dontblink.verified.index.v1`，`tokens` 为已登记 RH token | 可选 `lifecycle`：`dontblink.lifecycle.directory.v1` |
| `4663/<lowercase-token>.json` | `dontblink.verified.v1`，来源/玩法/证据 | 可选 `lifecycle`：`dontblink.lifecycle.token.v1` |
| `index.json` / `<token>.json` | 上述 RH 兼容别名 | 与 canonical 完全相同 |
| `chains.json` | 已接入链清单 | 仍只有 4663，不能据此推断其他链无项目 |

每个 token 的唯一身份为 `(4663, lowercase address)`；ticker、名称、共享 Doppler 部署地址均不能充当身份或绑定证据。
未知地址和未支持链的 404 都是 **unknown**，不是“确定不属于 dontblink”。200 HTML 也是失败。
`lpLocked=null` 是未核实，不是未锁或已锁。保留 v1 的 `audited=false`、`riskAssessed=false` 及免责声明。
完整旧合同见 [GMGN-API-SPEC.md](GMGN-API-SPEC.md)（其中历史验收/源码链接属于源仓材料，非全部公开托管）。

### Developers 入口可使用的地址

- 数据目录：`https://dontblink.community/data/verified/4663/index.json`
- 单币路径模板：`https://dontblink.community/data/verified/4663/{token}.json`
- 本包发布后文档：`https://dontblink.community/scripts/gmgn-api/GMGN-HANDOFF-KIT.md`
- 本包发布后目录 schema：`https://dontblink.community/scripts/gmgn-api/schema/lifecycle-directory.v1.schema.json`
- 本包发布后 token schema：`https://dontblink.community/scripts/gmgn-api/schema/lifecycle-token.v1.schema.json`

后面三项由既有 source CI 安装器复制；发布前可能 404，不能先宣称线上已可用。
Schema 应用到响应的 `.lifecycle`，不替换外层 v1 schema。来源、哈希、关联、时间先后与 canonical/alias 一致性还须由 `verify.mjs` 验证。

## 2. 如何得到“从项目开始到发射”的目录

客户端合并两个集合，而不是把所有币重新复制到一个无限增长的新索引中：

1. 现有 `index.tokens` 是已登记 token 集合。对任意一行，项目 ID 为 `token:4663:<token>`，详情为 `4663/<token>.json`。
2. `index.lifecycle.projects` 是 **本次观察到的 Thesis 来源项目**。明确 token 引用命中登记表时，使用同一 token 项目 ID，并列出所有关联 `thesisIds`；其余使用 `thesis:<id>`，`launchStatus=unknown`。按项目 ID 去重即可得到本次可观察目录。

`lifecycle.tokenProjects` 提供 `/tokens` JSON Pointer、详情和 ID 模板。`count` 仅指 `projects` 数量；`totalProjectCount` 是去重后观察到的总数，不是所有历史项目总数。
`inputs.thesisSnapshot.records` 提供规范化 Thesis 资料、作者、创建时间及原始绑定字段，供查看来源记录。

没有服务端分页；`?page=` / `?limit=` 不会产生新页。接入方可对一次静态快照本地分页。
新增来源读取硬限 **2 MiB / 2000 条**；name 最长 200、ticker/stock 最长 64 字符。
超限、重复 ID、无效地址、跨链标记或错误结构会整次拒绝并保留旧快照，**不静默截断并假装完整**。
既有 token 索引保持兼容；新增目录不重复每一个没有 Thesis 关联的 token。它不是公开数据库查询接口。

### 单币三段状态

```json
{
  "origin": {"status":"service_record_observed","theses":["see actual typed objects"]},
  "launch": {"status":"event_observed","evidence":{"kind":"event"}},
  "gmgn": {
    "submission":{"status":"unknown","evidence":[]},
    "listing":{"status":"unknown","evidence":[]}
  }
}
```

上面是阅读示意，不是可通过 schema 的完整样例。完整真实样例在 [examples/gmgn-lifecycle-capture-2026-09-17.json](examples/gmgn-lifecycle-capture-2026-09-17.json)。

- `origin.status=service_record_observed`：公开 Thesis 服务返回了精确 token 字段；不是按名称猜配。`unknown` 不等于没有前身。
- `relationship=service_reported_exact_token_reference`、`ownershipVerified=false`：只陈述服务里的关联。当前 Worker 的作者可以绑定 token；公开响应不含签名证明，部分旧记录也没有 `boundBy/boundAt`。不能声称作者就是链上 creator 或追溯了全部签名。
- `launch.status=event_observed`：登记表附有已知 emitter/topic/transaction/block；`registry_observed` 是维护登记表事实，没有逐币事件材料。两者都不代表 GMGN 收录。独立 receipt 复核不在本导出器内。
- Wink 为 dontblink 机制注册，沿用 `source=registered`、`launchedOnDontblink=false`，仍可观察到 Wink 事件；不是冒称由 dontblink 的工厂部署 token。
- 当前没有 GMGN 的提交回执或收录观察器。**此版本只输出 unknown，不输出 submitted/pending/listed。** 发射成功、tokenUrl、搜索结果或相同名字均不能推进 GMGN 状态。

真实提交/收录状态接入需要 GMGN 确认的 receipt 或精确 chain+token 的公开 listing 证据，以及观察时间、证据 URL/哈希和复核责任人；协议确认后单独增加版本化适配与回归。接入前端不可自行将 unknown 改成 pending。交易可用、项目真实性和风险评价也不由本 API 保证。

## 3. 来源、链覆盖与时效

| 数据 | 当前 authority / 覆盖 | 不可推断的部分 |
|---|---|---|
| RH token / launch | `https://dontblink.community/data/ours.json`；只接 4663，partial | 不是全链、全玩法、全部历史完整证明 |
| Thesis 开始/引用 | `https://dontblink-thesis.lawson-e69.workers.dev/board` | Worker 未暴露完整分页与签名证明；可能含演示/测试或未审核记录；不是已认证项目 |
| GMGN | 尚无状态 authority 接入 | submitted、pending、listed、rejected 全部不得猜测 |
| BSC / Base / Solana / Morph / Arc 等 | 此 API 无已验证 adapter | 前端可发射、存在其他 API/链上合约不等于本 API 覆盖 |

`generatedAt` 仅表示这份派生 JSON 的生成时间。token 的 `sourceSnapshotAt` 与 Thesis 的 `sourceAt` / `observedAt` 各自保留，不能用重新生成时间洗新旧数据。
`coverage.thesis.freshness`：无来源为 unavailable；最近抓取失败或 sourceAt 距生成超过 7200 秒为 stale；其余为 recent（不是完整/实时保证）。用户端还应相对 **自己的当前时间** 计算来源年龄：冻结在 CDN 的一个旧 `recent` 响应不能永久显示新鲜。
`inputs.refresh` 记录最近是否实际尝试及错误类别；重跑 SEO 或 API 不会推进该时间。
`responseSha256` 是那次原始 HTTP 正文的 SHA-256；`recordsSha256` 是公开规范化记录数组的 `JSON.stringify` SHA-256。它们用于对账，不是链上签名或第三方认证。

现有主采集在自己的共享锁内完成 ours 写入后，仅附加一次该固定 Thesis authority 的 GET（10 秒超时、拒绝重定向、流式字节上限，无后台循环/额外 cron）。失败不阻断有效来源识别更新，明确保留旧来源或 unavailable。
SEO、source CI 安装和 rebase 重算均离线复用 index 内的来源快照，不对每枚 token 发外部请求。
部署新版源码后，旧 1159 等快照可立即生成兼容扩展但 Thesis 显示 unavailable；待既有主采集下一次成功读取后才有真正来源项目。没有新增 SLA 保证。

## 4. 接入方可直接执行的只读验证

```sh
# 原始头部不要省：必须确认 JSON + CORS，不能只检查 HTTP 200。
curl --fail --show-error --max-time 30 -H 'Origin: https://gmgn.ai' \
  -D index.headers https://dontblink.community/data/verified/4663/index.json -o index.json

# 真实已有的 POWERPLAY token（精确服务引用，不声称其作者拥有该 token）。
curl --fail --show-error --max-time 30 -H 'Origin: https://gmgn.ai' \
  https://dontblink.community/data/verified/4663/0x11c10293fb59a6cfe75ec01fc9b2a609e28a17bc.json

# 从源码根执行：默认抽样，检查 canonical/alias、CORS、404/其他链。
node infra/gmgn-api/verify.mjs --url https://dontblink.community/data/verified/
node infra/gmgn-api/check-release.mjs --url https://dontblink.community \
  --manifest infra/launch-manifest/launchers.json --save /tmp/gmgn-release-observation.json

# --all 会读取所有 canonical + alias；按实际网络与稳定部署窗口安排，勿把抽样当全量。
node infra/gmgn-api/verify.mjs --url https://dontblink.community/data/verified/ --all
```

接入验收必须记录：固定源 SHA、index SHA、两类来源时间、coverage、checkedTokens、前后快照稳定性、未知地址/链结果。
`check-release` 的 `ready_for_full_public_verification` 不是全量通过；原 CLI 遇传输失败会失败，不会吞错或自动重试。
发布新版本时应额外确认 `lifecycle.schema` 真正出现、文档/schema 返回 200、关联字段与源快照吻合。旧 v1 响应缺少 lifecycle 代表扩展未到达，不等于空目录。

## 5. 本轮真实观测和样例边界

- 2026-09-18 **00:10:07–00:10:10 UTC**：公网 bounded release-check 通过；来源与索引前后稳定，全部 5 个 manifest Wink 和 4 个 emitter 游标核对通过，coverage 仍 partial。
- 公网快照：1159 token，`sourceSnapshotAt=2026-09-17T23:24:36.811Z`，`generatedAt=2026-09-17T23:24:46.328Z`；源 SHA `36f1deb0ccc770137ab94b7b25341c4a0326b5103b5679285d92bfa02f17214c`。
- 本次公网抽样：5 token 的 canonical + alias 通过、CORS `*`，unknown 地址及 BSC probe 都为 404；本轮未重跑公网全量。
- 2026-09-17 **23:58:32 UTC** 抓到 Thesis 129 条，只有 1 条 token 字段与该登记表精确命中。未据此推断完整历史。
- 2026-09-18 00:19:58 UTC，用新增采集器原生 Node fetch 只读抓取该 Thesis authority，在本机返回 ETIMEDOUT（network_error）；此前 curl 已抓成功。采集器如实返回 unavailable，未改变 authority/TLS 或伪造成功。正式采集主机的首次可达性仍须用既有任务的实际产物确认。
- 由这两份真实输入生成的 **本地、未发布** 扩展：1159 token 详情全量离线校验，129 来源项目、去重后观察目录 1287；所有 GMGN 状态 unknown。真实关联为 Thesis `f8911d4cf4b1` → `4663:0x11c10293fb59a6cfe75ec01fc9b2a609e28a17bc`，旧记录未暴露 bind 元数据。

这些数值是固定观测，不是长期在线数量承诺。示例包含该源 SHA、公开响应 SHA 和观察时间；新来源可能改变字段、增加记录或解除绑定。

本地复现命令（输出目录必须尚不存在，不覆盖任何 checkout；原始捕获时刻须真实记录）：

```sh
node infra/gmgn-api/preview-lifecycle.mjs \
  /path/to/captured/ours.json /path/to/captured/theses.json \
  2026-09-17T23:58:32.000Z /tmp/new-gmgn-handoff-preview
node infra/gmgn-api/verify.mjs /tmp/new-gmgn-handoff-preview/data/verified
node --test infra/gmgn-api/*.test.mjs scripts/publish-site-retry.test.mjs
```

## 6. 发布与伙伴交接步骤

1. 审核本包、schema、真实样例和 API 边界。v1 消费者继续忽略未知字段。
2. 经正常 source PR/CI 安装新版模块、schema 和文档；不另起 writer，不手改 mini/cron，不向 GMGN 自动提交。
3. 先验兼容 v1，再观察既有主采集产出带真实 Thesis sourceAt 的扩展；若抓取失败，检查 stale/unavailable，不能填假空值。
4. 在同一稳定产物快照下做 bounded release-check、目录本地全量和计划中的 HTTP 全量验收；保留失败证据。
5. 将公开 base、schema、此文档和固定验收结果交给伙伴。实际 GMGN 接收方、提交流程、receipt/listing 标准由双方确认；没有回执时所有项目仍 unknown。

schema 文件和此文档安装到 `scripts/gmgn-api/` 只由 source CI 更新；运行时只生成原来已受管的 `data/verified` 文件名。没有新目录碰撞、没有修改资产/404/发射交易，现有共享锁及推送重算规则保持不变。
