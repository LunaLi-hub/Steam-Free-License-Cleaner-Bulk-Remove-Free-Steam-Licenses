# Steam Free License Cleaner -Bulk Remove Free Steam Licenses

## About

**Steam Free License Cleaner** is a Tampermonkey userscript that bulk-removes free licenses from your own Steam account — free games, free DLC, demos, betas, and Free Weekend licenses.

It adds a Steam-styled panel to the Account Licenses page, reads every license page automatically, and deletes removable items on the fly. Error 29 items are skipped permanently; other failures are retried at the end of the run; Steam rate limits (error 84) trigger an escalating cooldown. The UI supports English and Chinese.

> Not affiliated with Valve. Deletions are real and not reversible by the script.

---

## 简介

**Steam Free License Cleaner** 是一个 Tampermonkey 用户脚本，用于批量移除你自己 Steam 账户中的免费许可 —— 免费游戏、免费 DLC、试玩、测试版和 Free Weekend 许可。

它在账户许可页面添加一个 Steam 风格面板，自动读取所有分页，并边读边删。错误 29 的项目永久跳过；其他失败会在本轮结束时统一重试；触发限流（错误 84）会自动进入递增冷却。界面支持中英文。

> 与 Valve 无关联。删除操作真实生效，脚本无法撤销。

---

<a id="en-quickstart"></a>
## Quick Start

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)
2. [Install the script](https://raw.githubusercontent.com/<user>/<repo>/main/steam-free-license-cleaner.user.js)
3. Sign in to Steam
4. Open https://store.steampowered.com/account/licenses/
5. In the panel, click **Scan list only** to preview, then **Start cleaning**

[⬆️ Back to top](#top) · [中文](#zh-quickstart)

---

<a id="zh-quickstart"></a>
## 快速开始

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/)
2. [安装脚本](https://raw.githubusercontent.com/<user>/<repo>/main/steam-free-license-cleaner.user.js)
3. 登录 Steam
4. 打开 https://store.steampowered.com/account/licenses/
5. 面板里点 **Scan list only** 预览，再点 **Start cleaning** 开始

[⬆️ 回到顶部](#top) · [English](#en-quickstart)

---

<a id="top"></a>

## Error Codes - Causes and What to Do

| Error | Likely cause | What the script does | What you can do |
|---|---|---|---|
| **84** | Deleting too fast — Steam's rate limit was triggered | Automatically enters an escalating cooldown and slows down subsequent deletions | Nothing — just wait. Do not open a second tab or lower the delay |
| **29** | The license is likely no longer available in the store (delisted / not removable by the user) | Records it in the **Skipped** tab and skips it permanently | Nothing — it cannot be removed from the script side |
| **24** | Login session expired | Stops the run immediately | Refresh the page, sign in again, then press **Start cleaning** |
| HTTP 429 | Same as error 84 — rate limited | Treated exactly like error 84 | Same as error 84 |
| Other / unknown | Temporary network or server error | Skips the item for now and retries at the end of the run (max 3 attempts) | Let it run; if it keeps failing, check your network |



---

## 错误码 · 原因与处理

| 错误码 | 可能原因 | 脚本的处理方式 | 你可以做什么 |
|---|---|---|---|
| **84** | 删除间隔太短，触发 Steam 限流 | 自动进入递增冷却，并放慢后续删除节奏 | 无需操作，等冷却结束即可。不要开第二个标签页，也不要调小间隔 |
| **29** | 推测是该许可已无法在商店获取（已下架 / 用户不可移除） | 记入「已跳过」页签，之后永久跳过 | 脚本侧无法解决，无需操作 |
| **24** | 登录会话失效 | 立即停止本轮 | 刷新页面、重新登录后，再点 **开始清理** |
| HTTP 429 | 与错误 84 相同，触发限流 | 按错误 84 处理 | 同错误 84 |
| 其他 / 未知 | 临时网络或服务器错误 | 先跳过，本轮结束时统一重试（最多 3 次） | 让它继续跑；若持续失败，检查网络 |


