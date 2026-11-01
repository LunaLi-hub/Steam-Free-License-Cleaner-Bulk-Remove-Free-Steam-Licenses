![Steam Free License Cleaner](assets/Banner.png)

# Steam Free License Cleaner

Bulk-remove free licenses from your own Steam account — free games, free DLC, demos, betas, and Free Weekend licenses.

> Not affiliated with Valve. Deletions are real and cannot be undone by the script.

---

<a id="en"></a>
## Quick Start

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)
2. [Install the script](https://raw.githubusercontent.com/lulunana1245611/Steam-Free-License-Cleaner-Bulk-Remove-Free-Steam-Licenses/main/Steam-Free-License-Cleaner.user.js)
3. Sign in to Steam
4. Open https://store.steampowered.com/account/licenses/
5. In the panel, click **Scan list only** to preview, then **Start cleaning**

[⬆️ Back to top](#en)

---

<a id="zh"></a>
## 快速开始

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/)
2. [安装脚本](https://raw.githubusercontent.com/lulunana1245611/Steam-Free-License-Cleaner-Bulk-Remove-Free-Steam-Licenses/main/Steam-Free-License-Cleaner.user.js)
3. 登录 Steam
4. 打开 https://store.steampowered.com/account/licenses/
5. 面板里点 **仅扫描列表** 预览，再点 **开始清理**

[⬆️ 回到顶部](#zh)

---

## Error Codes · 错误码

| Error | Likely cause | What the script does | What you can do |
|---|---|---|---|
| **84** | Deleting too fast — Steam rate limit triggered | Enters an escalating cooldown and slows down subsequent deletions | Just wait. Don't open a second tab or lower the delay |
| **29** | License likely no longer available in the store (delisted / not removable by the user) | Records it in the **Skipped** tab and skips it permanently | Nothing — it cannot be removed from the script side |
| **24** | Login session expired | Stops the run immediately | Refresh the page, sign in again, then press **Start cleaning** |
| HTTP 429 | Same as error 84 — rate limited | Treated exactly like error 84 | Same as error 84 |
| Other / unknown | Temporary network or server error | Skips it for now and retries at the end of the run (max 3 attempts) | Let it run; if it keeps failing, check your network |

| 错误码 | 可能原因 | 脚本的处理方式 | 你可以做什么 |
|---|---|---|---|
| **84** | 删除间隔太短，触发 Steam 限流 | 自动进入递增冷却，并放慢后续删除节奏 | 等冷却结束即可。不要开第二个标签页，也不要调小间隔 |
| **29** | 推测该许可已无法在商店获取（已下架 / 用户不可移除） | 记入「已跳过」页签，之后永久跳过 | 脚本侧无法解决，无需操作 |
| **24** | 登录会话失效 | 立即停止本轮 | 刷新页面、重新登录后再点 **开始清理** |
| HTTP 429 | 与错误 84 相同，触发限流 | 按错误 84 处理 | 同错误 84 |
| 其他 / 未知 | 临时网络或服务器错误 | 先跳过，本轮结束时统一重试（最多 3 次） | 让它继续跑；若持续失败，检查网络 |

