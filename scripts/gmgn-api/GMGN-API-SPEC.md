# dontblink 代币来源查询 API v1

> 新增交接包：[GMGN-HANDOFF-KIT.md](GMGN-HANDOFF-KIT.md)。保留本 v1 全部字段/路径，兼容增加 Thesis → 发射 → GMGN 生命周期状态；本包编写时扩展尚未发布（实时以响应字段为准），GMGN 提交/收录无证据仍为 unknown。最新固定观测、schema、curl 与更新说明见该包。

更新：2026-09-17。本文取代早期方案中的 `404 = 非 dontblink`、默认 LP 已锁、登记表完整覆盖、每小时必达等未证实承诺。

**交付状态（2026-09-17 20:38 UTC）：正式 URL 已上线，真实生产登记表共 1,159 条，含五枚具有发射事件证据的 Wink及新发行QAREJ。20:35–20:37的逐币/兼容别名全量检查通过，2,324次请求零传输错误、实际重试0次；首尾索引一致。源快照为20:24:17.404 UTC，来源SHA及四代Wink游标均已复核。** 当前可交付范围为 Robinhood Chain（4663）；BSC（56）尚未接入，登记覆盖仍为partial。此前公网曾观察到偶发CDN 503，无重试校验因此中断；本次成功不取消调用方的传输失败处理要求。历史见 [发布记录](../acceptance/PRODUCTION-RELEASE-2026-09-17.md)，最新冲突修复、真实补扫与公网实证见 [数据发布恢复](../acceptance/MINI-DATA-PIPELINE-2026-09-17.md)。

## 1. 查询地址与判定

正式基址：`https://dontblink.community/data/verified/`。静态 JSON，无 API 密钥。

| GET 路径 | 内容 |
|---|---|
| `chains.json` | 实际支持的链及索引路径 |
| `4663/index.json` | Robinhood 完整的当前登记表索引 |
| `4663/{token_address_lowercase}.json` | 逐币记录；地址必须为小写 20 字节 EVM 地址 |
| `index.json`、`{token_address_lowercase}.json` | 仅为 4663 的兼容别名；不得用于其他链 |

身份键为 **`(chainId, token)`**，不能按符号、名字、地址后缀或跨链同地址认币。调用方必须先确认链支持情况，再校验响应中的 `chainId` 和 `token` 与请求一致。

- 有效 JSON、`schema = dontblink.verified.v1` 且 `recognized === true`：当前登记表正面识别。
- `recognized === null`：未知。曾存在但现不在登记表的记录会保留这种显式响应，避免不删除旧文件的发布方式留下过期正面结果。
- HTTP 404：当前端点未找到，**不是“该币不属于 dontblink”的证据**。
- 超时、5xx、200 HTML、schema 不匹配：接口或传输错误，不做身份结论。SPA 回退页即使为 200，也不是 API 成功。
- 已观察到 CDN 偶发 503 后恢复。调用方可对网络异常、429、502/503/504 做有限重试（例如总计最多三次、1 秒和 3 秒退避，并遵守 `Retry-After`）；失败耗尽时报告服务暂不可用，保留此前身份缓存。不要重试到无限等待，也不要把传输故障改成 `recognized: false`。

当前登记表为 **部分覆盖**：历史内部发行可能从站点列表排除，某些链上游标可能落后，不能用“不在表里”反推归属。

## 2. 逐币字段

调用方应先校验 `schema`、`chainId`、`token`，再按 `recognized` 分支解析。下表的来源、市场和证据字段描述正面记录。`recognized: null` 的已移除记录只返回身份、原因、时间及审计/风险声明等基本字段，`source` 为 null，可能省略 `evidence`、`launchedOnDontblink`、`pool`、`poolId`、`lpLockEvidence` 与 `tokenUrl`；不能把缺失字段当作 false 或空地址。不存在的地址也可能直接返回 HTTP 404。

| 字段 | 当前语义 |
|---|---|
| `schema` | `dontblink.verified.v1` |
| `chainId` / `token` | 链与代币地址；本版仅 4663 |
| `recognized` | `true` 或 `null`，本版不输出否定结论 `false` |
| `source` | `factory`：已维护的 dontblink 发射登记；`registered`：通过 dontblink 机制层、底层部署器共享。`clone` 为保留类型，本生成器不推断此类型 |
| `launchedOnDontblink` | `factory` / `clone` 为 true，`registered` 为 false；后者可以使用不同的机制层标识 |
| `launchMode` | `v1` / `instant` / `queue` / `curve` / `sale` / `wink` / `unknown`。没有足够模式证据时为 unknown |
| `reportedLaunchMode` | 上游历史标签，只供参考，不能覆盖 `launchMode`。历史 instant 标签曾包含 Handler 发射 |
| `pool` | 20 字节池合约地址或 null |
| `poolId` | 32 字节池标识或 null；不是合约地址，不能与 `pool` 混用 |
| `creator` / `createdBlock` / `createdAt` | 登记数据；未知为 null。区块高度不会被转换成伪造创建时间 |
| `lpLocked` / `lpLockContract` / `lpLockEvidence` | 本版均为 null：尚无逐币锁仓证明；不等于 false，也不能显示“LP 已锁” |
| `evidence` | `event` 或 `registry`，见下节 |
| `generatedAt` | 本次 API 文件生成时间，**不能当作链扫描完成时间** |
| `sourceSnapshotAt` | 上游 ours.json 的快照时间；不证明每条发射器都扫描至该时间 |
| `tokenUrl` | dontblink 站内币页链接 |
| `audited` / `riskAssessed` | 恒为 false，来源识别不构成审计或风险评级 |

`symbol` 与 `name` 仅用于显示，不参与归属判定。不包含图片或行情大字段。

### 来源证据

- `evidence.kind = registry`：来自正式维护的 `data/ours.json`，`evidence.uri` 为来源 URI，`evidence.inputSha256` 为该输入文件原始字节的 SHA-256（不是 Git 提交 SHA）。历史行没有单独的发射日志，**不会伪造交易哈希**。URI 表示生产来源；本地导出的文件哈希应与实际输入对照。
- `evidence.kind = event`：提供已知发射器、正确事件 topic0、交易哈希和区块高度。可取交易回执，独立复核发射器事件是否包含该代币。
- Wink 必须有清单内四代 Wink 发射器的 `WinkModeLaunched` 事件。Doppler 的共享工厂和共享实现不构成 dontblink 归属证明；Wink 的 `source` 为 `registered`，不是 `clone`。
- Portal Handler 模式只有在同笔交易、同区块的 `LaunchedVia` 证明与登记的 handler 地址及 modeId 都匹配时，才解析为具体玩法。

清单见 [发射器附件](../GMGN-附件A-发射器清单.md) 和 [机器可读清单](../../infra/launch-manifest/launchers.json)。

### 当前实际示例（APPA，字段节选）

以下来自本轮真实登记表；并未为示例填入锁状态或时间：

```json
{
  "schema": "dontblink.verified.v1",
  "chainId": 4663,
  "token": "0x615a20f0d89e0925415dbad3ae5d5eee97137719",
  "recognized": true,
  "source": "factory",
  "launchedOnDontblink": true,
  "launchMode": "unknown",
  "reportedLaunchMode": "sale",
  "pool": "0x6e5b5681c9e47e049f9e11fd24e376947f9a329f",
  "poolId": null,
  "createdBlock": 58862966,
  "createdAt": null,
  "lpLocked": null,
  "lpLockContract": null,
  "audited": false,
  "riskAssessed": false
}
```

## 3. 索引、时效与同步

索引 `schema` 为 `dontblink.verified.index.v1`，含 `chainId`、`count`、`tokens`、`generatedAt`、`sourceSnapshotAt` 和 `source.sha256`。`source.sha256` 是本次输入 `ours.json` 原始字节的 SHA-256，不是 Git 提交 SHA；每条 summary 与逐币文件一致。

- `coverage.status = partial`；`coverage.absentMeans = unknown`。
- `scannedToBlock = null`：目前没有“所有发射器已完整扫描到同一高度”的证明。
- `coverage.scan` 保留上游实际提供的游标键：v1、v2、v2meta 以及有数据时按 emitter 区分的 Wink 游标。缺失的键可能省略；存在但无效的高度转换为 null，不造新高度。
- 现有数据由 mini 主机上的单一 cron 写入，GitHub Actions 保留手动补跑。新接口跟随这条流程生成，不单独新增定时写入者。
- 正式更新频率与最坏时延须在部署后根据实际连续运行结果确认；当前不承诺“新币最坏一小时必到”。

调用方可缓存已识别身份，但应独立观察快照时间、分支扫描游标与刷新是否成功。一次失败不应把之前的正面识别改成否定。

## 4. 展示标签

- `recognized === true && source === factory/clone`：可展示 dontblink 来源标识。
- `recognized === true && source === registered`：可展示 dontblink 机制层标识，避免声称其合约模板由 dontblink 独占部署。
- 当前 `lpLocked === null`：不展示 LP 已锁标签。
- 不展示“官方审计”“低风险”“安全”。

免责声明固定为：`dontblink provides launch infrastructure. This is NOT an audit and NOT a risk rating.`

## 5. 交付验收

部署后运行仓库提供的验收器（包括真实 GMGN Origin、JSON 类型、schema、地址、链、索引与单点一致性、未知地址行为）：

```sh
node infra/gmgn-api/verify.mjs --url https://dontblink.community/data/verified/ --all
```

HTTP 验收前不得把“本地产物已生成”描述为“线上 API 已可用”。安装与运维步骤见 [GMGN pipeline](../../infra/gmgn-api/README.md)。
