# dontblink 平台來源角標與新幣通知交接

本文件的交付目標是：**在 GMGN 代幣頭像旁顯示 dontblink 平台 Logo 來源角標，並在每次可信發行完成後通知合作方。** 代幣本身的 logo、名稱與社群資料保持原樣。既有 lifecycle 擴充不是這項需求的替代品。

## 給 GMGN：最簡接入入口

**接入動作：用 `(chainId, CA)` 查來源；正面記錄符合下述條件時，在原 token 頭像角落疊加 dontblink Logo。** 不替換 token 頭像，不用名稱或 ticker 匹配。

| 用途 | 固定值／GET 入口 | 實際能力與狀態 |
|---|---|---|
| 平台識別 | `platformId = dontblink`；顯示名 `dontblink` | dontblink 提供的固定值；GMGN 尚未確認接收或映射。 |
| 平台 Logo | `https://dontblink.community/brand/dontblink-platform-badge.png` | 本次新增的官方品牌副本，**待正常 CI 發布及 URL 驗收**；PNG 與 SHA-256 見第 1 節。 |
| 支援鏈目錄 | `https://dontblink.community/data/verified/chains.json` | 既有靜態接口；目前 adapter 僅列 Robinhood `4663`。 |
| 逐幣來源 lookup | `https://dontblink.community/data/verified/4663/{token_address_lowercase}.json` | 既有逐幣接口；CA 為小寫 `0x` 加 40 位十六進位地址。`platformBadge` 是本次待發布的可選新增欄位。 |
| 全量當前登記索引 | `https://dontblink.community/data/verified/4663/index.json` | 既有接口，`tokens[]` 為當前登記摘要；逐項讀上述 lookup 才取得完整 `platformBadge`。**不是全鏈歷史全集**，覆蓋仍為 `partial`。 |
| 舊版兼容入口 | `https://dontblink.community/data/verified/index.json` 與 `https://dontblink.community/data/verified/{token_address_lowercase}.json` | 既有 4663 別名。新接入請用含 chainId 的路徑，不能將別名套到其他鏈。 |
| 增量／新幣推送 | **目前沒有公開增量 endpoint、`since`／cursor 查詢或已接通 webhook** | 可輪詢上述全量索引，在合作方按 `(chainId, CA)` 比對新增並定期刷新既有記錄。本地準備佇列不是 HTTP API，也不是已自動通知 GMGN。 |

以上路徑由現有 `generate.mjs` 的實際輸出與既有 API 規格核對；本次只讀本地源碼，**沒有重新請求公網，也不以此宣稱新 Logo／欄位已上線或 GMGN 已接受**。

### 最小匹配規則

1. 先讀 `chains.json`，只處理其支援鏈；當前為 `4663`。將 CA 驗為 20-byte EVM 地址並轉小寫，使用 `(4663, CA)` 作唯一鍵。
2. lookup 必須是 HTTP 200 的 JSON，`schema = dontblink.verified.v1`，且回應 `chainId`、`token` 均與請求相符。`recognized === true` 且 `platformBadge.platformId === 'dontblink'` 才按本次角標合同展示。
3. `source = factory/clone` 對應 `relation = launch_origin`；`source = registered` 只能對應 `relation = mechanism_provider`，保留 `launchedOnDontblink = false`，文案為「dontblink 機制整合」，不聲稱獨占部署。Logo 疊在 token 頭像旁，token 自己的 Logo 不變。
4. `recognized = null`（包括墓碑）不顯示當前來源角標；404 或缺少本次新 `platformBadge` 不新增角標。404／表中缺席是未知，舊 v1 沒有新欄位也不代表非本平台。超時、5xx、200 HTML 或身份不匹配是失敗，保留之前已核實的身份快取並標記未刷新，不改成否定結論。LP 未知仍為 null。

索引的 `generatedAt` 是產物生成時間，`sourceSnapshotAt` 是來源快照時間，`source.sha256` 是來源 `ours.json` **原始位元組**摘要。來源摘要不變也可能有新版角標欄位，不能只按它跳過全部既有記錄；定期刷新 lookup。新幣只在真實掃描與正常發布後可查，現階段沒有即時到達或最壞延遲承諾。

以下僅提供可複製的只讀命令，**本次未執行**；單幣 CA 使用既有規格中的歷史示例，接入時換成待查地址，實際結果以回應為準：

```sh
curl --fail-with-body --max-time 20 -H 'Accept: application/json' \
  'https://dontblink.community/data/verified/chains.json'
curl --fail-with-body --max-time 20 -H 'Accept: application/json' \
  'https://dontblink.community/data/verified/4663/index.json'
curl --fail-with-body --max-time 20 -H 'Accept: application/json' \
  'https://dontblink.community/data/verified/4663/0x615a20f0d89e0925415dbad3ae5d5eee97137719.json'
```

## 1. 平台角標合同（已實作，尚待正常發布與 GMGN 接入）

目前可識別來源的 `dontblink.verified.v1` 正面記錄增加可選欄位 `platformBadge`，其餘欄位／路徑／別名不變。歷史無此欄位的 v1 回應仍可讀；未知、404 及移除記錄的墓碑均不得帶角標。打標依可信登記表與已審查的發射器事件，不能依 ticker、行情列表、第三方共用工廠或 UI 成功提示。

```json
{
  "platformBadge": {
    "schema": "dontblink.platform-badge.v1",
    "platformId": "dontblink",
    "label": "dontblink",
    "placement": "token_avatar_corner",
    "logo": {
      "url": "https://dontblink.community/brand/dontblink-platform-badge.png",
      "mediaType": "image/png",
      "sha256": "8cded1abeec35385f866941c8d7d11b5686e5a4e4c5a35beaf123ab65e385dff"
    },
    "relation": "mechanism_provider",
    "description": "dontblink mechanism integration; the underlying token may be deployed by a third-party launchpad.",
    "tokenLogoUnchanged": true,
    "disclaimer": "Platform attribution only. Not an audit, risk rating, listing approval or LP-lock guarantee."
  }
}
```

- `factory`／`clone`：`relation=launch_origin`，依現有登記來源語義識別。歷史行可保留 `evidence.kind=registry`，不補造交易證據。
- `registered`：`relation=mechanism_provider`，表示 dontblink 提供機制整合；**不宣稱獨占部署来源**。RH Wink 仍要求已知 emitter 的實際事件；`launchedOnDontblink=false` 保持不變。
- 角標不代表審計、安全、GMGN 認證／上架、即時可交易或 LP 已鎖。未知 LP 繼續為 null。
- 目前此 adapter 僅支援 **Robinhood 4663**；不把相同地址套到其他鏈。其他 adapter 接入必須提供各自來源證據。
- 圖檔是現有官方 NewUI 紫底眼睛標誌的**逐位元組副本**，來源 `web/public/newui/dontblink-favicon.png`；品牌交付副本在 `infra/gmgn-api/assets/dontblink-platform-badge.png`，公共靜態資源在 `web/public/brand/dontblink-platform-badge.png`。不使用個別 token logo，也未重新生成圖形。
- Schema：`infra/gmgn-api/schema/platform-badge.v1.schema.json`；精確語義校驗在 `platform-badge.mjs` 與既有 verifier。此欄位是 dontblink 提供給合作方的合同，**不是已獲 GMGN 接受的官方欄位**。

新 URL 只有經正常 source CI 發布後才可對外標為可用；本次實作不聲稱已上線。

## 2. 新幣通知：已備好本地準備佇列，尚未自動通知

`launch-outbox.mjs` 是獨立、無網路的準備工具，不改 scanner／cron／publisher，不會 POST、不讀金鑰，也不存在「已送達」狀態。預設 dry run，明確 `--persist` 才儲存到公開產物倉之外的私有狀態檔。

每個輸入包含：

- 通過現有規則的正面 `record`，且 `evidence.kind=event`；僅歷史 registry 身分不足以產生「新發行」通知。
- 原始成功 `receipt`（加明確 chainId），完整 logs；拒簽、revert、pending／unknown 均不產生通知。
- 同鏈 `canonicalBlock:{chainId,number,hash}`、`head:{chainId,number,hash}`、`observedAt` 和已審查的 `manifest`。數字可用 JSON 整數或 RPC 十六進位字串。
- 最新只讀觀測在一小時內；預設至少 64 個觀測確認，可明確提供其他正整數政策。**確認數不是鏈最終性保證**。

工具逐項核對 receipt 成功、交易／區塊 hash、canonical block、emitter、topic、ABI 佈局、實際 token／creator／可核 pool、logIndex 與部署高度。所有输入先通過，才變更佇列。這是**校驗所提供證據**，工具本身不另發 RPC 驗真；只能輸入可信 observer 的資料，不接受瀏覽器 toast 充當來源。

穩定 ID：`dontblink:launch:<chainId>:<txHash>:<logIndex>:<emitter>:<token>`。

- 重複觀測與重新整理名稱／生成時間不新增項目；可重跑同一批做回補或再次匯出待交付 payload。
- 同一 ID 的不可變事件內容（例如 blockHash）變動會拒絕，保留原檔，交人工檢查重組。不靜默覆寫。
- 儲存採排他鎖與同目錄原子替換。程序中斷留下的鎖需人工確認，不自動移除別人的鎖。
- 狀態只能是 `prepared_not_sent`，`attempts=0`、`acknowledgement=null`；`sent=0`。再次準備不是一次發送重試。
- 未設全鏈掃描或自動歷史回補。每批 1–1000 件；历史事件須補取近期 canonical／head 觀測。

```sh
# 預設只讀輸入與舊佇列，輸出候選 payload，不寫檔也不發送。
node infra/gmgn-api/launch-outbox.mjs \
  --input /private/captures/confirmed-launches.json \
  --outbox /private/gmgn-state/outbox.json \
  --repository /absolute/path/dontblink-community

# 同樣完全離線；明確保存本地待通知記錄。
node infra/gmgn-api/launch-outbox.mjs \
  --input /private/captures/confirmed-launches.json \
  --outbox /private/gmgn-state/outbox.json \
  --repository /absolute/path/dontblink-community --persist
```

輸入檔頂層為 `{ "inputs": [ { "record": {}, "receipt": {}, "canonicalBlock": {}, "head": {}, "observedAt": "...", "manifest": {} } ] }`；完整可執行合成資料見 `platform-badge.test.mjs`。通知 schema：`launch-notification.v1.schema.json`，不是 GMGN 已定接收格式。

## 3. 真正自動通知仍需要合作方確認

GMGN 的 token logo 與 launchpad/platform 來源標籤是兩種資料；目前未取得可公開確認的角標寫入／新幣通知接收合同。不能用 token logo 更新 API 代替來源角標，也不能由此聲稱 GMGN 已顯示標記。

需要 GMGN 提供並確認：接收 URL、鏈命名映射、鑑權、platform ID／品牌資源接受方式、registered 的顯示文字、idempotency key、ack／查單合同、限流／批量規則、timeout 的 unknown 處理、重組撤回規則、歷史回補方式與測試環境。

確認之後另審接線：既有可信成功事件 observer → 同一持久佇列 → 單一 sender（有界退避，未知回執先查單，禁止盲重送）→ 真實 ack 保存 → GMGN 顯示驗收。拒簽／失敗不排隊；同一事件不重複通知；未收到 ack 不能宣稱送達。需要保持既有單 writer 與公開資產 ownership。

**本次完成：角標資料合同、品牌副本、兼容校驗、本地幂等準備佇列。未完成：部署、GMGN 接收合同、事件 observer 自動接線、sender／真實重試／ack、合作方角標顯示。**
