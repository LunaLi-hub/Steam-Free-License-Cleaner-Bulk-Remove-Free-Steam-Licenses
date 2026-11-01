// ==UserScript==
// @name         Steam-Free-License-Cleaner
// @name:zh-CN   Steam 免费游戏批量删除 / 一键清库存脚本
// @namespace    https://github.com/LunaLi-hub/Steam-Free-License-Cleaner-Bulk-Remove-Free-Steam-Licenses
// @version      1.1
// @description  Selectable filter bar (category chips + checkboxes + select all/invert/clear), quick-clean buttons (Demo/Trial, Soundtrack, DLC, Tool), multi-language demo detector, risk banner and delete confirmation, ETA with finish time, clear-log button. Only checked items are removed.
// @description:zh-CN  可勾选筛选栏（分类标签＋复选框＋全选/反选/清空），快捷清理按钮（试用版/原声/DLC/工具），多语言试用版识别，首页风险提示与删除确认，预计剩余时间与完成时刻，日志清理按钮。只删除勾选的项目。
// @author       luna
// @match        https://store.steampowered.com/account/licenses/*
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    const CFG = {
        delaySec: 2,
        coolMin: 5,
        coolStepMin: 1,
        coolMax: 15 * 60000,
        coolJitter: 0.1,
        coolDecayAfter: 20,
        gapFirst: 3000,
        gapGrowth: 1.5,
        gapMax: 60000,
        gapDecayAfter: 25,
        gapDecay: 0.85,
        failDelay: [3000, 6000],
        breakerAfter: 4,
        maxAttempts: 3,
        retryPassWait: 30000,
        netRetryDelay: [5000, 10000],
        pageFetchDelay: [800, 1800],
        maxPages: 3000
    };

    const CAT_DEFS = [
        {
            id: 'demo',
            res: [
                /\bdemo\b/i, /\btrial\b/i, /\bbeta\b/i, /\bplaytest\b/i, /\bpreview\b/i,
                /\bprologue\b/i, /\bprolog\b/i,
                /试[玩用]/, /体验版?|體驗版?/, /序章/, /测试版?|測試版?/, /预览版?|預覽版?/,
                /体験版?/, /お試し/, /체험판/, /데모/, /프롤로그/,
                /демо/i, /пробн/i, /пролог/i,
                /demostración/i, /démo/i
            ]
        },
        {
            id: 'soundtrack',
            res: [
                /\bsoundtrack\b/i, /\bsound\s+track\b/i, /\bost\b/i,
                /\boriginal\s+(?:game\s+)?soundtrack\b/i,
                /原声带?|原聲帶?/, /音乐包|音樂包/, /音轨|音軌/, /配乐|配樂/, /音乐集|音樂集/,
                /サウンドトラック/, /サントラ/,
                /사운드트랙/, /오리지널\s*사운드/,
                /саундтрек/i, /партитура/i,
                /banda\s+sonora/i, /colonna\s+sonora/i
            ]
        },
        {
            id: 'dlc',
            res: [
                /\bdlc\b/i, /\badd-?on\b/i, /\bexpansion\b/i, /\bseason\s+pass\b/i,
                /\bbundle\b/i, /\bpack\b/i,
                /扩展包?|擴展包?|资料片|資料片|追加内容|追加內容|季票/,
                /拡張パック?/, /追加コンテンツ/, /シーズンパス/,
                /확장팩/, /추가\s*콘텐츠/, /시즌\s*패스/,
                /дополнени/i, /сезонный\s+пропуск/i,
                /\bexpansión\b/i, /\bpase\s+de\s+temporada\b/i
            ]
        },
        {
            id: 'tool',
            res: [
                /\bdedicated\s+server\b/i, /\bsdk\b/i,
                /\btool\b/i, /\bworkshop\b/i, /\bmod\s+tool\b/i,
                /工具/, /服务器|伺服器/, /专用服务器|專用伺服器/,
                /ツール/, /サーバー/,
                /도구/, /서버/,
                /инструмент/i, /сервер/i,
                /herramienta/i, /servidor/i
            ]
        }
    ];

    function categorize(name) {
        const cats = [];
        for (const c of CAT_DEFS) {
            if (c.res.some(re => re.test(name))) cats.push(c.id);
        }
        if (!cats.length) cats.push('game');
        return cats;
    }

    const I18N = {
        en: {
            title: 'License Cleaner',
            riskBanner: '⚠ Deleting licenses cannot be undone. Most games can be re-added from the store; delisted games cannot, and some games are no longer available in certain regions.',
            stat_removed: 'Removed (total)', stat_skipped: 'Skipped (error 29)',
            stat_retry: 'To retry', stat_remain: 'Remaining',
            notStarted: 'Not started',
            btn_start: 'Start cleaning', btn_scan: 'Scan list only', btn_stop: 'Stop', btn_reset: 'Reset records',
            btn_clearCool: 'Clear cooldown',
            btn_restoreSkip: 'Restore skipped list',
            btn_clearLog: 'Clear log',
            tip_scan: 'Read every page and list the removable items without deleting anything',
            tip_reset: 'Clear the skipped list, totals, deleted list and cooldown state',
            tip_restoreSkip: 'Restore the skipped (error 29) list that was backed up when you last reset records',
            tip_clearLog: 'Empty the log panel (records, totals and lists are not affected)',
            confirmReset: 'Reset all records?\n\nThis clears the skipped list, totals, deleted list and cooldown state. The skipped list is backed up first, so you can bring it back later with the "Restore skipped list" button.',
            confirmDelete: 'This cannot be undone. You may accidentally remove a game you want to keep.\n\nMost games can be re-added by searching the Steam store, but delisted games cannot be re-added, and some games are no longer available in certain regions.',
            set_delay_pre: 'Base delay', set_delay_post: 'sec',
            set_cool_pre: 'First cooldown', set_cool_post: 'min (+1 each, max 15)',
            set_skip_pre: 'Skip first', set_skip_post: 'items (deleted last)',
            tab_log: 'Log', tab_pending: 'Pending', tab_deleted: 'Deleted', tab_skipped: 'Skipped', tab_failed: 'Failed',
            filterPh: 'Search name or ID',
            b_idle: 'Idle', b_run: 'Running', b_cool: 'Cooling down', b_done: 'Done',
            b_scanned: 'Scan done', b_stopped: 'Stopped', b_scanning: 'Scanning',
            curScanning: (p, n) => `Scanning pages (${p} read, ${n} found)`,
            curPreparing: 'Preparing queue (reading the first batch)',
            curProcessing: n => `Processing: ${n}`,
            curScanDone: n => `Scan complete, ${n} pending`,
            curAllDone: 'All done', curStopped: 'Stopped',
            eta: (dur, at) => `About ${dur} left, done around ${at}`,
            etaReading: ' (still reading pages)',
            coolBar: (c, l, r) => `Rate-limit cooldown, <b>${c}</b> left · level ${l}` +
                (r ? ' — no delete requests are sent during cooldown' : ' — it will wait for the cooldown to end after you press Start'),
            unitMin: 'min', unitHour: 'h', unitDay: 'd',
            unknownName: 'Unknown item', nameMissing: '(name not recorded)',
            processing: 'Processing', queuePos: i => `Queue #${i}`,
            tailPos: i => `Last batch #${i}`,
            retryExtra: (a, m, e) => `To retry · failed ${a}/${m} · ${e}`,
            gaveExtra: e => `Given up · ${e}`,
            emptyPending: 'Nothing yet. Press "Scan list only" or "Start cleaning" to read the removable items.',
            emptyDeleted: 'No deletion records yet (only items deleted since v5.1 are recorded).',
            emptySkipped: 'No skipped items.', emptyFailed: 'No failed items.',
            noMatch: 'No matching items',
            more: (n, c) => `${n} items, showing the first ${c}. Use the search box to narrow it down.`,
            errCode: c => `Error ${c}`,
            resetDone: 'Records reset',
            coolCleared: 'Cooldown cleared',
            restoreDone: (a, n) => `Restored ${a} skipped items (${n} on record)`,
            restoreEmpty: 'No backup to restore',
            prepLog: n => `Skip-first is on: reading the first ${n} items first, they will be deleted last`,
            startLog: (r, s) => `Started (total removed ${r}, skipped on record ${s})`,
            startLogChecked: n => `Started with ${n} checked items`,
            stillCooling: c => `Still inside the previous cooldown, ${c} left. Waiting first.`,
            logWait: (l, s) => `${l}, about ${s}s`,
            pageHttp: s => `Page read: HTTP ${s}, retrying shortly`,
            pageErr: m => `Page read failed: ${m}, retrying shortly`,
            readProg: (p, n) => `Read up to page ${p}, ${n} removable found so far`,
            readDone: (p, n) => `Finished reading ${p} pages, ${n} removable found`,
            reason84: 'Error 84: rate limited',
            reasonBreaker: (n, e) => `${n} failures in a row (${e}), probably rate limited`,
            coolLog: (r, ok, d, l, g) => `${r} (${ok} successes before this). Cooling down ${d} (level ${l}, +1 min per level, max 15 min); extra delay per deletion is now ${g}s`,
            okLog: (n, id) => `✓ ${n} (${id}) deleted`,
            skipLog: (n, id) => `- ${n} (${id}) error 29, skipped for good`,
            err24: 'Error 24: login session expired. Refresh the page or sign in again, then press Start.',
            deferLog: (n, id, e, a, m) => `! ${n} (${id}) ${e}. Skipping for now, will retry at the end (failure ${a}/${m})`,
            gaveLog: (n, id, a, e) => `✕ Giving up on ${n} (${id}): failed ${a} times, last error ${e}`,
            retryStart: (n, p) => `Retrying ${n} earlier failures (pass ${p})`,
            retryWaitLabel: 'Waiting a moment before retrying',
            rescan: r => `Round ${r}: re-reading all pages to check for leftovers`,
            scriptErr: m => `Script error: ${m}`,
            finishLog: (done, r, s, g, t) => `${done ? 'Finished' : 'Stopped'}: removed ${r}, skipped ${s}, gave up ${g} this run; ${t} removed in total`,
            gaveList: (names, more) => `Given up (press Start later to try again): ${names}${more ? ' …' : ''}`,
            stopReq: 'Stop requested; will stop after the current step',
            scanStart: 'Scanning all pages (nothing will be deleted)',
            scanDone: n => `Scan complete: ${n} removable items. See the Pending tab.`,
            scanStopped: 'Scan stopped',
            scanErr: m => `Scan error: ${m}`,
            scanSwitched: 'Switched to "Pending" tab — check items, then press "Start cleaning".',
            cat_demo: 'Demo/Trial', cat_soundtrack: 'Soundtrack', cat_dlc: 'DLC',
            cat_tool: 'Tool', cat_game: 'Game',
            sel_info: (a, b) => `${a} / ${b} selected`,
            sel_all: 'Select all', sel_inv: 'Invert', sel_none: 'Clear',
            noSelection: 'Nothing selected — pick at least one item.',
            q_label: 'Quick clean:',
            q_demo: 'Only Demo/Trial',
            q_soundtrack: 'Only Soundtrack',
            q_dlc: 'Only DLC',
            q_tool: 'Only Tool',
            quickScanning: 'Quick clean: scanning first...',
            quickNoItems: 'Quick clean: no removable items found.',
            quickNone: c => `Quick clean: no "${c}" items.`,
            quickStart: (n, c) => `Quick clean: starting with ${n} "${c}" item(s).`
        },
        zh: {
            title: '库存清理器',
            riskBanner: '⚠ 删除授权不可逆。大部分游戏可在商店重新添加；已下架的游戏无法重新入库，部分游戏也不再支持某些地区。',
            stat_removed: '已删除（累计）', stat_skipped: '已跳过（错误29）',
            stat_retry: '待重试', stat_remain: '本轮剩余',
            notStarted: '尚未开始',
            btn_start: '开始清理', btn_scan: '仅扫描列表', btn_stop: '停止', btn_reset: '重置记录',
            btn_clearCool: '清除冷却',
            btn_restoreSkip: '恢复跳过列表',
            btn_clearLog: '清理日志',
            tip_scan: '只读取所有分页并列出待删除项目，不执行删除',
            tip_reset: '清除已跳过列表、累计计数、已删除列表和冷却状态',
            tip_restoreSkip: '恢复上次重置记录时备份的“错误29已跳过”列表',
            tip_clearLog: '清空日志面板（不影响记录、计数和各列表）',
            confirmReset: '确定要重置所有记录吗？\n\n将清除已跳过列表、累计计数、已删除列表和冷却状态。已跳过列表会先备份，之后可用“恢复跳过列表”按钮找回。',
            confirmDelete: '此操作不可逆，可能误删想保留的游戏。\n\n大部分游戏可在商店搜索重新添加，但已下架的游戏无法重新入库，部分游戏也不再支持某些地区。',
            set_delay_pre: '基础间隔', set_delay_post: '秒',
            set_cool_pre: '首次冷却', set_cool_post: '分钟（每次+1，最多15）',
            set_skip_pre: '跳过前', set_skip_post: '个（最后删除）',
            tab_log: '日志', tab_pending: '待删除', tab_deleted: '已删除', tab_skipped: '已跳过', tab_failed: '失败',
            filterPh: '搜索名称或 ID',
            b_idle: '空闲', b_run: '运行中', b_cool: '冷却中', b_done: '已完成',
            b_scanned: '扫描完成', b_stopped: '已停止', b_scanning: '扫描中',
            curScanning: (p, n) => `正在扫描分页（已读 ${p} 页，发现 ${n} 个）`,
            curPreparing: '正在准备队列（先读取前一批）',
            curProcessing: n => `正在处理：${n}`,
            curScanDone: n => `扫描完成，共 ${n} 个待删除`,
            curAllDone: '全部处理完毕', curStopped: '已停止',
            eta: (dur, at) => `预计还需 ${dur}，约 ${at} 完成`,
            etaReading: '（仍在读取分页）',
            coolBar: (c, l, r) => `限流冷却中，剩余 <b>${c}</b>　·　第 ${l} 级` +
                (r ? '，冷却期间不会发送任何删除请求' : '，点击开始后会先等冷却结束'),
            unitMin: '分钟', unitHour: '小时', unitDay: '天',
            unknownName: '未知游戏名', nameMissing: '（名称未记录）',
            processing: '处理中', queuePos: i => `排队第 ${i} 位`,
            tailPos: i => `最后批次第 ${i} 位`,
            retryExtra: (a, m, e) => `待重试 · 失败 ${a}/${m} · ${e}`,
            gaveExtra: e => `已放弃 · ${e}`,
            emptyPending: '暂无。点击"仅扫描列表"或"开始清理"来读取待删除项目',
            emptyDeleted: '还没有删除记录（只记录 v5.1 之后删除的项目）',
            emptySkipped: '没有被跳过的项目', emptyFailed: '没有失败的项目',
            noMatch: '没有匹配的项目',
            more: (n, c) => `共 ${n} 条，仅显示前 ${c} 条，可用搜索框筛选`,
            errCode: c => `错误${c}`,
            resetDone: '记录已重置',
            coolCleared: '冷却已清除',
            restoreDone: (a, n) => `已恢复 ${a} 个跳过项目（当前记录 ${n} 个）`,
            restoreEmpty: '没有可恢复的备份',
            prepLog: n => `已启用"跳过前 N 个"：先读取前 ${n} 个项目，它们将在最后删除`,
            startLog: (r, s) => `开始清理（累计已删 ${r}，已记录跳过 ${s}）`,
            startLogChecked: n => `开始清理，仅处理已勾选的 ${n} 个项目`,
            stillCooling: c => `仍在上次的冷却期内，剩余 ${c}，先等待`,
            logWait: (l, s) => `${l}，约 ${s} 秒`,
            pageHttp: s => `读取分页 HTTP ${s}，稍后重试`,
            pageErr: m => `读取分页出错：${m}，稍后重试`,
            readProg: (p, n) => `已读取到第 ${p} 页，累计发现可删 ${n} 个`,
            readDone: (p, n) => `分页读取结束，共 ${p} 页，发现可删 ${n} 个`,
            reason84: '错误84，触发限流',
            reasonBreaker: (n, e) => `连续失败 ${n} 次（${e}），疑似限流`,
            coolLog: (r, ok, d, l, g) => `${r}（此前连续成功 ${ok} 个）。冷却 ${d}（第 ${l} 级，每次+1分钟，最多15分钟），之后每次删除额外间隔 ${g} 秒`,
            okLog: (n, id) => `✓ ${n}（${id}）已删除`,
            skipLog: (n, id) => `- ${n}（${id}）错误29，已永久跳过`,
            err24: '错误24：登录会话已失效，请刷新页面或重新登录后再开始',
            deferLog: (n, id, e, a, m) => `! ${n}（${id}）${e}，先跳过，最后再重试（第 ${a}/${m} 次失败）`,
            gaveLog: (n, id, a, e) => `✕ 放弃 ${n}（${id}）：失败 ${a} 次，最后一次 ${e}`,
            retryStart: (n, p) => `开始重试 ${n} 个先前失败的项目（第 ${p} 轮）`,
            retryWaitLabel: '先等一会儿再重试',
            rescan: r => `第 ${r} 轮：重新读取分页，检查有无遗漏`,
            scriptErr: m => `脚本异常：${m}`,
            finishLog: (done, r, s, g, t) => `${done ? '已完成' : '已停止'}：本次删除 ${r}，跳过 ${s}，放弃 ${g}；累计删除 ${t}`,
            gaveList: (names, more) => `放弃的项目（可稍后再点开始重试）：${names}${more ? ' ……' : ''}`,
            stopReq: '已请求停止，当前操作结束后停下',
            scanStart: '开始扫描所有分页（不会删除任何东西）',
            scanDone: n => `扫描完成：共 ${n} 个可删除项目，可在"待删除"页签查看`,
            scanStopped: '扫描已停止',
            scanErr: m => `扫描异常：${m}`,
            scanSwitched: '已切换到「待删除」页，勾选项目后点「开始清理」。',
            cat_demo: '试用版', cat_soundtrack: '原声', cat_dlc: 'DLC',
            cat_tool: '工具', cat_game: '游戏',
            sel_info: (a, b) => `已选 ${a} / ${b}`,
            sel_all: '全选', sel_inv: '反选', sel_none: '清空',
            noSelection: '没有选中任何项目——请至少勾选一项。',
            q_label: '快捷清理：',
            q_demo: '仅删试用版',
            q_soundtrack: '仅删原声',
            q_dlc: '仅删 DLC',
            q_tool: '仅删工具',
            quickScanning: '快捷清理：先扫描列表...',
            quickNoItems: '快捷清理：未找到可删除项目。',
            quickNone: c => `快捷清理：没有「${c}」类项目。`,
            quickStart: (n, c) => `快捷清理：开始处理「${c}」共 ${n} 项。`
        }
    };

    const STORE_KEY = 'steamLicenseCleanerState';
    const DEFAULTS = {
        skipped: [], removed: 0, minGap: 0,
        coolLevel: 0, cooldownUntil: 0,
        delaySec: CFG.delaySec, coolMin: CFG.coolMin,
        skipFirst: 0,
        skippedInfo: {},
        lang: 'en'
    };
    function loadState() {
        try {
            const s = JSON.parse(localStorage.getItem(STORE_KEY));
            if (s) return Object.assign({}, DEFAULTS, s);
        } catch (e) {}
        return Object.assign({}, DEFAULTS);
    }
    function saveState() {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
    }
    const state = loadState();
    if (typeof state.coolMin !== 'number' || !(state.coolMin >= 1)) state.coolMin = CFG.coolMin;
    if (state.coolMin > 15) state.coolMin = 15;
    if (typeof state.skipFirst !== 'number' || !(state.skipFirst >= 0)) state.skipFirst = 0;
    state.skipFirst = Math.floor(state.skipFirst);
    const skipSet = new Set(state.skipped);
    if (!state.skippedInfo || typeof state.skippedInfo !== 'object') state.skippedInfo = {};
    if (!I18N[state.lang]) state.lang = 'en';

    const t = (k, ...a) => {
        const v = (I18N[state.lang] && I18N[state.lang][k] !== undefined) ? I18N[state.lang][k] : I18N.en[k];
        return typeof v === 'function' ? v(...a) : v;
    };

    const DEL_KEY = 'steamLicenseCleanerDeleted';
    const DEL_MAX = 20000;
    let deletedList = [];
    try { deletedList = JSON.parse(localStorage.getItem(DEL_KEY)) || []; } catch (e) {}
    let delTimer = null;
    function saveDeleted() {
        if (delTimer) { clearTimeout(delTimer); delTimer = null; }
        try { localStorage.setItem(DEL_KEY, JSON.stringify(deletedList)); } catch (e) {}
    }
    function recordDeleted(g) {
        deletedList.push([g.packageId, g.itemName, Date.now()]);
        if (deletedList.length > DEL_MAX) deletedList.splice(0, deletedList.length - DEL_MAX);
        if (!delTimer) delTimer = setTimeout(saveDeleted, 3000);
    }

    const SKIP_BACKUP_KEY = 'steamLicenseCleanerSkippedBackup';
    function loadSkipBackup() {
        try {
            const b = JSON.parse(localStorage.getItem(SKIP_BACKUP_KEY));
            if (b && Array.isArray(b.skipped)) return b;
        } catch (e) {}
        return null;
    }
    let skipBackup = loadSkipBackup();

    const run = {
        running: false, scanning: false, last: '', ctl: null, current: '',
        queue: [], cur: null, tail: [], preparing: false,
        retry: new Map(),
        gaveUp: new Map(),
        processed: 0, removedRun: 0, skippedRun: 0,
        startAt: 0, okStreak: 0, sinceLimit: 0, failStreak: [],
        wake: null, lockRelease: null,
        scanList: [],
        allowedSet: null
    };

    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const rand = ([min, max]) => Math.round(min + Math.random() * (max - min));
    const pad2 = n => String(n).padStart(2, '0');
    const fmtClock = ms => {
        const s = Math.ceil(ms / 1000);
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
        return h > 0 ? `${h}:${pad2(m)}:${pad2(sec)}` : `${pad2(m)}:${pad2(sec)}`;
    };
    // 预计剩余时长：天 / 小时 / 分钟
    const fmtDhm = ms => {
        const total = Math.max(1, Math.ceil(ms / 60000));
        const d = Math.floor(total / 1440);
        const h = Math.floor((total % 1440) / 60);
        const m = total % 60;
        const parts = [];
        if (d) parts.push(`${d}${t('unitDay')}`);
        if (d || h) parts.push(`${h}${t('unitHour')}`);
        parts.push(`${m}${t('unitMin')}`);
        return parts.join(' ');
    };
    // 预计完成的具体日期时间
    const fmtAt = ms => {
        const d = new Date(Date.now() + ms);
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    };

    let els = null;
    const origTitle = document.title;

    const CSS = `
    #slc{margin:14px 0 22px;border-radius:3px;background:linear-gradient(135deg,rgba(22,32,45,.96),rgba(27,40,56,.96));border:1px solid rgba(102,192,244,.18);box-shadow:0 0 14px rgba(0,0,0,.55);color:#c6d4df;font-family:"Motiva Sans",Arial,Helvetica,sans-serif;font-size:13px;overflow:hidden}
    #slc *{box-sizing:border-box}
    #slc [hidden]{display:none !important}
    #slc .slc-head{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:linear-gradient(to right,rgba(62,103,150,.38),rgba(0,0,0,0) 80%);border-bottom:1px solid rgba(0,0,0,.35)}
    #slc .slc-title{display:flex;align-items:center;gap:9px;font-size:16px;color:#fff;letter-spacing:.03em}
    #slc .slc-title svg{width:18px;height:18px;fill:#67c1f5}
    #slc .slc-title em{font-style:normal;font-size:11px;color:#56707f;letter-spacing:0}
    #slc .slc-headr{display:flex;align-items:center;gap:10px}
    #slc .slc-lang{border:1px solid rgba(103,193,245,.35);background:none;color:#67c1f5;border-radius:2px;padding:1px 9px;font-size:12px;cursor:pointer;font-family:inherit}
    #slc .slc-lang:hover{background:rgba(103,193,245,.2);color:#fff}
    #slc .slc-badge{padding:2px 11px;border-radius:2px;font-size:12px;background:rgba(103,193,245,.15);color:#67c1f5}
    #slc .slc-badge.run{background:rgba(164,208,7,.16);color:#a4d007}
    #slc .slc-badge.cool{background:rgba(255,200,44,.16);color:#ffc82c}
    #slc .slc-badge.done{background:rgba(164,208,7,.16);color:#a4d007}
    #slc .slc-risk{display:flex;align-items:flex-start;gap:8px;padding:9px 16px;background:rgba(224,96,94,.08);border-left:3px solid #e0605e;color:#e8a09e;font-size:12px;line-height:1.5}
    #slc .slc-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:rgba(0,0,0,.3)}
    #slc .slc-stat{background:rgba(10,18,28,.55);padding:12px 16px}
    #slc .slc-stat b{display:block;font-size:24px;font-weight:300;color:#fff;line-height:1.2}
    #slc .slc-stat span{font-size:11px;color:#8f98a0;letter-spacing:.04em}
    #slc .slc-prog{padding:14px 16px 4px}
    #slc .slc-bar{height:6px;border-radius:3px;background:rgba(0,0,0,.45);overflow:hidden}
    #slc .slc-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#1a9fff,#67c1f5);transition:width .4s}
    #slc .slc-meta{display:flex;justify-content:space-between;gap:12px;margin-top:7px;font-size:12px;color:#8f98a0}
    #slc .slc-meta span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #slc .slc-meta span:last-child{flex-shrink:0;max-width:60%;text-align:right;white-space:normal;font-variant-numeric:tabular-nums}
    #slc .slc-cool{margin:10px 16px 0;padding:8px 12px;background:rgba(255,200,44,.08);border-left:3px solid #ffc82c;color:#ffc82c;font-size:12px}
    #slc .slc-cool b{font-weight:600;font-variant-numeric:tabular-nums}
    #slc .slc-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:14px 16px}
    #slc .slc-quickbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:0 16px 14px;font-size:12px}
    #slc .slc-quickbar .slc-quicklabel{color:#8f98a0;margin-right:2px}
    #slc .slc-quickbtn{border:1px solid rgba(103,193,245,.3);background:rgba(103,193,245,.08);color:#67c1f5;border-radius:2px;padding:5px 12px;font-size:12px;cursor:pointer;font-family:inherit;transition:filter .15s}
    #slc .slc-quickbtn:hover{background:rgba(103,193,245,.25);color:#fff}
    #slc .slc-quickbtn:disabled{opacity:.35;cursor:default}
    #slc .slc-quickbtn.q-demo{color:#c9e07b;border-color:rgba(164,208,7,.4);background:rgba(164,208,7,.1)}
    #slc .slc-quickbtn.q-demo:hover{background:rgba(164,208,7,.28);color:#fff}
    #slc .slc-quickbtn.q-sound{color:#c5a3ff;border-color:rgba(152,110,255,.4);background:rgba(152,110,255,.1)}
    #slc .slc-quickbtn.q-sound:hover{background:rgba(152,110,255,.28);color:#fff}
    #slc .slc-quickbtn.q-dlc{color:#ff9f7a;border-color:rgba(255,130,80,.4);background:rgba(255,130,80,.1)}
    #slc .slc-quickbtn.q-dlc:hover{background:rgba(255,130,80,.28);color:#fff}
    #slc .slc-quickbtn.q-tool{color:#ffc82c;border-color:rgba(255,200,44,.4);background:rgba(255,200,44,.1)}
    #slc .slc-quickbtn.q-tool:hover{background:rgba(255,200,44,.28);color:#fff}
    #slc .slc-btn{border:0;border-radius:2px;padding:0 16px;line-height:30px;font-size:13px;cursor:pointer;font-family:inherit;transition:filter .15s}
    #slc .slc-btn:disabled{opacity:.35;cursor:default}
    #slc .slc-green{background:linear-gradient(-60deg,#6fa720 5%,#588a1b 95%);color:#d2efa9}
    #slc .slc-green:not(:disabled):hover{background:linear-gradient(-60deg,#8ed629 5%,#6aa621 95%);color:#fff}
    #slc .slc-red{background:rgba(212,60,60,.25);color:#ff8a80}
    #slc .slc-red:not(:disabled):hover{background:rgba(212,60,60,.45);color:#fff}
    #slc .slc-ghost{background:rgba(103,193,245,.15);color:#67c1f5}
    #slc .slc-ghost:not(:disabled):hover{background:rgba(103,193,245,.3);color:#fff}
    #slc .slc-yellow{background:rgba(255,200,44,.18);color:#ffc82c}
    #slc .slc-yellow:not(:disabled):hover{background:rgba(255,200,44,.35);color:#fff}
    #slc .slc-set{margin-left:auto;display:flex;flex-wrap:wrap;gap:14px;color:#8f98a0;font-size:12px}
    #slc .slc-set label{display:flex;align-items:center;gap:6px}
    #slc .slc-set input{width:64px;padding:3px 6px;border-radius:2px;border:1px solid #000;background:rgba(0,0,0,.35);color:#fff;font-size:12px;box-shadow:1px 1px 0 rgba(255,255,255,.08)}
    #slc .slc-log{max-height:260px;overflow-y:auto;padding:10px 16px;background:rgba(0,0,0,.38);border-top:1px solid rgba(0,0,0,.4);font:12px/1.7 Consolas,"Courier New",monospace;color:#9fb0bd}
    #slc .slc-log div{white-space:pre-wrap;word-break:break-all}
    #slc .slc-log .t{color:#4b5d6b;margin-right:8px}
    #slc .slc-log .ok{color:#8ec14a}
    #slc .slc-log .skip{color:#7f8c97}
    #slc .slc-log .warn{color:#ffc82c}
    #slc .slc-log .err{color:#e0605e}
    #slc .slc-log .info{color:#67c1f5}
    #slc .slc-log::-webkit-scrollbar{width:8px}
    #slc .slc-log::-webkit-scrollbar-thumb{background:rgba(103,193,245,.25);border-radius:4px}
    #slc .slc-tabs{display:flex;align-items:center;flex-wrap:wrap;gap:2px;padding:0 10px;border-top:1px solid rgba(0,0,0,.4);background:rgba(0,0,0,.2)}
    #slc .slc-tab{background:none;border:0;border-bottom:2px solid transparent;color:#8f98a0;padding:10px 12px;font-size:13px;cursor:pointer;font-family:inherit}
    #slc .slc-tab:hover{color:#fff}
    #slc .slc-tab.on{color:#fff;border-bottom-color:#67c1f5;background:rgba(103,193,245,.08)}
    #slc .slc-tab em{font-style:normal;margin-left:6px;padding:0 7px;border-radius:8px;background:rgba(103,193,245,.18);color:#67c1f5;font-size:11px}
    #slc .slc-filter{margin-left:auto;width:190px;padding:4px 8px;border-radius:2px;border:1px solid #000;background:rgba(0,0,0,.35);color:#fff;font-size:12px;font-family:inherit;box-shadow:1px 1px 0 rgba(255,255,255,.08)}
    #slc .slc-selbar{padding:10px 16px;border-top:1px solid rgba(0,0,0,.4);background:rgba(0,0,0,.2);display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    #slc .slc-cats{display:flex;flex-wrap:wrap;gap:6px}
    #slc .slc-cat{border:1px solid rgba(103,193,245,.3);background:rgba(103,193,245,.08);color:#8f98a0;border-radius:12px;padding:3px 10px;font-size:12px;cursor:pointer;font-family:inherit}
    #slc .slc-cat:hover{background:rgba(103,193,245,.2);color:#fff}
    #slc .slc-cat em{font-style:normal;margin-left:5px;color:#67c1f5;font-size:11px}
    #slc .slc-selbtns{display:flex;gap:6px;margin-left:auto;align-items:center}
    #slc .slc-selbtns button{border:1px solid rgba(103,193,245,.3);background:rgba(103,193,245,.1);color:#67c1f5;border-radius:2px;padding:3px 10px;font-size:12px;cursor:pointer;font-family:inherit}
    #slc .slc-selbtns button:hover{background:rgba(103,193,245,.25);color:#fff}
    #slc .slc-selinfo{font-size:12px;color:#8f98a0;margin-left:8px;font-variant-numeric:tabular-nums}
    #slc .slc-list{max-height:320px;overflow-y:auto;background:rgba(0,0,0,.38);border-top:1px solid rgba(0,0,0,.4);font-size:12px}
    #slc .slc-row{display:grid;grid-template-columns:minmax(0,1fr) 90px 190px;gap:12px;padding:6px 16px;align-items:center}
    #slc .slc-row.sel{grid-template-columns:24px minmax(0,1fr) 90px 160px}
    #slc .slc-row input[type=checkbox]{width:14px;height:14px;accent-color:#67c1f5;cursor:pointer;margin:0}
    #slc .slc-row:nth-child(even){background:rgba(255,255,255,.025)}
    #slc .slc-row:hover{background:rgba(103,193,245,.08)}
    #slc .slc-row .n{color:#c6d4df;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #slc .slc-row .i{color:#56707f;font-variant-numeric:tabular-nums}
    #slc .slc-row .x{color:#8f98a0;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #slc .slc-row .x.bad{color:#e0605e}
    #slc .slc-row.now .n{color:#a4d007}
    #slc .slc-empty,#slc .slc-more{padding:18px 16px;color:#56707f;text-align:center}
    #slc .slc-list::-webkit-scrollbar{width:8px}
    #slc .slc-list::-webkit-scrollbar-thumb{background:rgba(103,193,245,.25);border-radius:4px}
    @media (max-width:640px){#slc .slc-stats{grid-template-columns:repeat(2,1fr)}#slc .slc-set{margin-left:0}#slc .slc-row{grid-template-columns:minmax(0,1fr) 120px}#slc .slc-row .i{display:none}#slc .slc-row.sel{grid-template-columns:24px minmax(0,1fr) 120px}#slc .slc-filter{margin-left:0;width:100%}#slc .slc-meta{flex-direction:column;gap:3px}#slc .slc-meta span:last-child{max-width:100%;text-align:left}}
    `;

    function buildUI() {
        const titleElem = document.querySelector('.page_content > h2');
        if (!titleElem) return;

        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        const root = document.createElement('div');
        root.id = 'slc';
        root.innerHTML = `
          <div class="slc-head">
            <div class="slc-title">
              <svg viewBox="0 0 24 24"><path d="M9 3h6l1 2h4v2H4V5h4l1-2zm-3 6h12l-1 12H7L6 9zm4 2v8h1.5v-8H10zm3.5 0v8H15v-8h-1.5z"/></svg>
              <span data-i18n="title"></span><em>v1.1</em>
            </div>
            <div class="slc-headr">
              <button class="slc-lang" data-k="lang" title="English / 中文"></button>
              <span class="slc-badge" data-k="badge"></span>
            </div>
          </div>
          <div class="slc-risk" data-i18n="riskBanner"></div>
          <div class="slc-stats">
            <div class="slc-stat"><b data-k="removed">0</b><span data-i18n="stat_removed"></span></div>
            <div class="slc-stat"><b data-k="skipped">0</b><span data-i18n="stat_skipped"></span></div>
            <div class="slc-stat"><b data-k="retry">0</b><span data-i18n="stat_retry"></span></div>
            <div class="slc-stat"><b data-k="remain">0</b><span data-i18n="stat_remain"></span></div>
          </div>
          <div class="slc-prog">
            <div class="slc-bar"><i data-k="bar"></i></div>
            <div class="slc-meta"><span data-k="cur"></span><span data-k="eta"></span></div>
          </div>
          <div class="slc-cool" data-k="cool" hidden></div>
          <div class="slc-actions">
            <button class="slc-btn slc-green" data-k="start" data-i18n="btn_start"></button>
            <button class="slc-btn slc-ghost" data-k="scan" data-i18n="btn_scan" data-i18n-title="tip_scan"></button>
            <button class="slc-btn slc-red" data-k="stop" data-i18n="btn_stop" disabled></button>
            <button class="slc-btn slc-yellow" data-k="clearcool" data-i18n="btn_clearCool"></button>
            <button class="slc-btn slc-ghost" data-k="clearlog" data-i18n="btn_clearLog" data-i18n-title="tip_clearLog"></button>
            <button class="slc-btn slc-ghost" data-k="reset" data-i18n="btn_reset" data-i18n-title="tip_reset"></button>
            <button class="slc-btn slc-ghost" data-k="restoreskip" data-i18n="btn_restoreSkip" data-i18n-title="tip_restoreSkip"></button>
            <div class="slc-set">
              <label><span data-i18n="set_delay_pre"></span> <input type="number" min="0.5" step="0.5" data-k="delay"> <span data-i18n="set_delay_post"></span></label>
              <label><span data-i18n="set_cool_pre"></span> <input type="number" min="1" max="15" step="1" data-k="coolmin"> <span data-i18n="set_cool_post"></span></label>
              <label><span data-i18n="set_skip_pre"></span> <input type="number" min="0" step="1" data-k="skipfirst"> <span data-i18n="set_skip_post"></span></label>
            </div>
          </div>
          <div class="slc-quickbar">
            <span class="slc-quicklabel" data-i18n="q_label"></span>
            <button class="slc-quickbtn q-demo" data-k="qDemo" data-i18n="q_demo"></button>
            <button class="slc-quickbtn q-sound" data-k="qSound" data-i18n="q_soundtrack"></button>
            <button class="slc-quickbtn q-dlc" data-k="qDlc" data-i18n="q_dlc"></button>
            <button class="slc-quickbtn q-tool" data-k="qTool" data-i18n="q_tool"></button>
          </div>
          <div class="slc-tabs">
            <button class="slc-tab on" data-tab="log"><span data-i18n="tab_log"></span></button>
            <button class="slc-tab" data-tab="pending"><span data-i18n="tab_pending"></span><em>0</em></button>
            <button class="slc-tab" data-tab="deleted"><span data-i18n="tab_deleted"></span><em>0</em></button>
            <button class="slc-tab" data-tab="skipped"><span data-i18n="tab_skipped"></span><em>0</em></button>
            <button class="slc-tab" data-tab="failed"><span data-i18n="tab_failed"></span><em>0</em></button>
            <input class="slc-filter" data-k="filter" hidden>
          </div>
          <div class="slc-selbar" data-k="selbar" hidden>
            <div class="slc-cats" data-k="cats"></div>
            <div class="slc-selbtns">
              <button data-k="selall" data-i18n="sel_all"></button>
              <button data-k="selinv" data-i18n="sel_inv"></button>
              <button data-k="selnone" data-i18n="sel_none"></button>
              <span class="slc-selinfo" data-k="selinfo"></span>
            </div>
          </div>
          <div class="slc-log" data-k="log"></div>
          <div class="slc-list" data-k="list" hidden></div>`;
        titleElem.parentNode.insertBefore(root, titleElem.nextSibling);

        els = { root };
        root.querySelectorAll('[data-k]').forEach(el => { els[el.dataset.k] = el; });
        root.querySelectorAll('.slc-tab').forEach(b => b.addEventListener('click', () => {
            view.tab = b.dataset.tab;
            view.sig = '';
            render();
        }));
        els.filter.addEventListener('input', () => { view.sig = ''; render(); });
        els.scan.addEventListener('click', scanOnly);
        els.clearcool.addEventListener('click', clearCooldown);
        els.clearlog.addEventListener('click', clearLog);
        els.restoreskip.addEventListener('click', restoreSkipped);
        els.selall.addEventListener('click', () => selectAll(true));
        els.selnone.addEventListener('click', () => selectAll(false));
        els.selinv.addEventListener('click', invertSel);
        els.qDemo.addEventListener('click', () => quickClean('demo'));
        els.qSound.addEventListener('click', () => quickClean('soundtrack'));
        els.qDlc.addEventListener('click', () => quickClean('dlc'));
        els.qTool.addEventListener('click', () => quickClean('tool'));
        els.lang.addEventListener('click', () => {
            state.lang = state.lang === 'zh' ? 'en' : 'zh';
            saveState();
            applyLang();
            view.sig = '';
            render();
        });

        els.delay.value = state.delaySec;
        els.coolmin.value = state.coolMin;
        els.skipfirst.value = state.skipFirst;
        els.delay.addEventListener('change', () => {
            const v = parseFloat(els.delay.value);
            state.delaySec = v >= 0.5 ? v : CFG.delaySec;
            els.delay.value = state.delaySec;
            saveState();
        });
        els.coolmin.addEventListener('change', () => {
            const v = parseFloat(els.coolmin.value);
            state.coolMin = Math.min(15, Math.max(1, isFinite(v) ? v : CFG.coolMin));
            els.coolmin.value = state.coolMin;
            saveState();
        });
        els.skipfirst.addEventListener('change', () => {
            const v = parseInt(els.skipfirst.value, 10);
            state.skipFirst = Math.max(0, isFinite(v) ? v : 0);
            els.skipfirst.value = state.skipFirst;
            saveState();
        });
        els.start.addEventListener('click', () => runCleaning());
        els.stop.addEventListener('click', stopCleaning);
        els.reset.addEventListener('click', () => {
            if (run.running) return;
            if (!window.confirm(t('confirmReset'))) return;
            try {
                localStorage.setItem(SKIP_BACKUP_KEY, JSON.stringify({
                    skipped: state.skipped.slice(),
                    skippedInfo: Object.assign({}, state.skippedInfo),
                    time: Date.now()
                }));
            } catch (e) {}
            skipBackup = loadSkipBackup();
            state.skipped = []; skipSet.clear();
            state.removed = 0; state.minGap = 0; state.coolLevel = 0; state.cooldownUntil = 0;
            state.skippedInfo = {};
            deletedList = [];
            saveDeleted();
            saveState();
            log(t('resetDone'), 'info');
            render();
        });

        applyLang();
        setInterval(render, 500);
        render();
    }

    function selectAll(checked) {
        if (run.running || !run.scanList.length) return;
        run.scanList.forEach(g => { g.checked = checked; });
        view.sig = '';
        render();
    }

    function invertSel() {
        if (run.running || !run.scanList.length) return;
        run.scanList.forEach(g => { g.checked = !g.checked; });
        view.sig = '';
        render();
    }

    function selectOnlyCat(cat) {
        if (run.running || !run.scanList.length) return;
        run.scanList.forEach(g => { g.checked = g.cats.includes(cat); });
        view.sig = '';
        render();
    }

    function updateSelInfo() {
        if (!els || !els.selinfo) return;
        if (!run.scanList.length) { els.selinfo.textContent = ''; return; }
        let sel = 0;
        for (const g of run.scanList) if (g.checked) sel++;
        els.selinfo.textContent = t('sel_info', sel, run.scanList.length);
    }

    async function quickClean(cat) {
        if (run.running) return;
        if (!run.scanList.length) {
            log(t('quickScanning'), 'info');
            await scanOnly();
            if (!run.scanList.length) {
                log(t('quickNoItems'), 'warn');
                return;
            }
        }
        let count = 0;
        run.scanList.forEach(g => {
            g.checked = g.cats.includes(cat);
            if (g.checked) count++;
        });
        if (!count) {
            log(t('quickNone', t('cat_' + cat)), 'warn');
            view.tab = 'pending';
            view.sig = '';
            render();
            return;
        }
        if (!window.confirm(t('confirmDelete'))) {
            view.tab = 'pending';
            view.sig = '';
            render();
            return;
        }
        log(t('quickStart', count, t('cat_' + cat)), 'info');
        view.tab = 'pending';
        view.sig = '';
        render();
        await runCleaning(true);
    }

    function clearCooldown() {
        const hadCooldown = state.cooldownUntil > Date.now();
        state.cooldownUntil = 0;
        state.coolLevel = 0;
        saveState();
        if (hadCooldown) log(t('coolCleared'), 'info');
        view.sig = '';
        render();
    }

    // 清空日志面板；运行中也可使用，不影响任何记录
    function clearLog() {
        if (!els || !els.log) return;
        els.log.textContent = '';
        els.log.scrollTop = 0;
    }

    function restoreSkipped() {
        if (run.running) return;
        const b = loadSkipBackup();
        if (!b || !Array.isArray(b.skipped) || !b.skipped.length) {
            log(t('restoreEmpty'), 'warn');
            return;
        }
        let added = 0;
        for (const id of b.skipped) {
            if (!skipSet.has(id)) {
                skipSet.add(id);
                state.skipped.push(id);
                added++;
            }
            if (b.skippedInfo && b.skippedInfo[id] && !state.skippedInfo[id]) {
                state.skippedInfo[id] = b.skippedInfo[id];
            }
        }
        skipBackup = b;
        saveState();
        log(t('restoreDone', added, state.skipped.length), 'info');
        view.sig = '';
        render();
    }

    function applyLang() {
        if (!els) return;
        els.root.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n); });
        els.root.querySelectorAll('[data-i18n-title]').forEach(e => { e.title = t(e.dataset.i18nTitle); });
        els.filter.placeholder = t('filterPh');
        els.lang.textContent = state.lang === 'zh' ? 'EN' : '中文';
        document.documentElement.setAttribute('data-slc-lang', state.lang);
    }

    function log(msg, type) {
        if (!els) return;
        const d = document.createElement('div');
        if (type) d.className = type;
        const ts = document.createElement('span');
        ts.className = 't';
        ts.textContent = new Date().toTimeString().slice(0, 8);
        d.appendChild(ts);
        d.appendChild(document.createTextNode(msg));
        const box = els.log;
        const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
        box.appendChild(d);
        while (box.childElementCount > 400) box.removeChild(box.firstChild);
        if (nearBottom) box.scrollTop = box.scrollHeight;
    }

    const view = { tab: 'log', sig: '' };
    const LIST_CAP = 300;

    function fmtWhen(ts) {
        const d = new Date(ts), now = new Date();
        const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
        return d.toDateString() === now.toDateString() ? hm : `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${hm}`;
    }

    function listRows(tab) {
        const rows = [];
        if (tab === 'pending') {
            if (!run.running && run.scanList.length) {
                run.scanList.forEach((g, idx) => {
                    rows.push({
                        id: g.packageId,
                        name: g.itemName,
                        cats: g.cats,
                        checked: !!g.checked,
                        idx,
                        selectable: true,
                        extra: g.cats.map(c => t('cat_' + c)).join(' · ')
                    });
                });
            } else {
                if (run.cur) rows.push({ id: run.cur.packageId, name: run.cur.itemName, extra: t('processing'), now: true });
                run.queue.forEach((g, i) => rows.push({ id: g.packageId, name: g.itemName, extra: t('queuePos', i + 1) }));
                if (run.tail && run.tail.length) {
                    run.tail.forEach((g, i) => rows.push({ id: g.packageId, name: g.itemName, extra: t('tailPos', i + 1) }));
                }
            }
        } else if (tab === 'deleted') {
            for (let i = deletedList.length - 1; i >= 0; i--) {
                const e = deletedList[i];
                rows.push({ id: e[0], name: e[1], extra: fmtWhen(e[2]) });
            }
        } else if (tab === 'skipped') {
            for (let i = state.skipped.length - 1; i >= 0; i--) {
                const id = state.skipped[i];
                rows.push({ id, name: state.skippedInfo[id] || t('nameMissing'), extra: t('errCode', 29) });
            }
        } else if (tab === 'failed') {
            run.retry.forEach(g => rows.push({
                id: g.packageId, name: g.itemName,
                extra: t('retryExtra', g.attempts, CFG.maxAttempts, g.lastErr || '')
            }));
            run.gaveUp.forEach(g => rows.push({
                id: g.packageId, name: g.itemName, bad: true,
                extra: t('gaveExtra', g.lastErr || '')
            }));
        }
        return rows;
    }

    function renderSelbar() {
        if (!els || !els.selbar) return;
        const show = view.tab === 'pending' && !run.running && run.scanList.length > 0;
        els.selbar.hidden = !show;
        if (!show) return;
        updateSelInfo();
    }

    function renderCatButtons() {
        if (!els || !els.cats) return;
        els.cats.textContent = '';
        const counts = {};
        for (const g of run.scanList) {
            for (const c of g.cats) counts[c] = (counts[c] || 0) + 1;
        }
        ['demo', 'soundtrack', 'dlc', 'tool', 'game'].forEach(cat => {
            const n = counts[cat] || 0;
            if (!n) return;
            const b = document.createElement('button');
            b.className = 'slc-cat';
            b.textContent = t('cat_' + cat);
            const em = document.createElement('em');
            em.textContent = n;
            b.appendChild(em);
            b.addEventListener('click', () => selectOnlyCat(cat));
            els.cats.appendChild(b);
        });
    }

    function renderList(tab, q) {
        const rows = listRows(tab).filter(r =>
            !q || r.name.toLowerCase().includes(q) || String(r.id).includes(q));
        const box = els.list;
        const top = box.scrollTop;
        box.textContent = '';

        if (!rows.length) {
            const d = document.createElement('div');
            d.className = 'slc-empty';
            const emptyKey = { pending: 'emptyPending', deleted: 'emptyDeleted', skipped: 'emptySkipped', failed: 'emptyFailed' }[tab];
            d.textContent = q ? t('noMatch') : t(emptyKey);
            box.appendChild(d);
            return;
        }
        const frag = document.createDocumentFragment();
        rows.slice(0, LIST_CAP).forEach(r => {
            const row = document.createElement('div');
            row.className = 'slc-row' + (r.now ? ' now' : '') + (r.selectable ? ' sel' : '');
            if (r.selectable) {
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = r.checked;
                cb.addEventListener('change', () => {
                    const g = run.scanList[r.idx];
                    if (g) g.checked = cb.checked;
                    updateSelInfo();
                });
                row.appendChild(cb);
            }
            const n = document.createElement('span'); n.className = 'n'; n.textContent = r.name; n.title = r.name;
            const i = document.createElement('span'); i.className = 'i'; i.textContent = r.id;
            const x = document.createElement('span'); x.className = 'x' + (r.bad ? ' bad' : ''); x.textContent = r.extra || ''; x.title = r.extra || '';
            row.append(n, i, x);
            frag.appendChild(row);
        });
        if (rows.length > LIST_CAP) {
            const m = document.createElement('div');
            m.className = 'slc-more';
            m.textContent = t('more', rows.length, LIST_CAP);
            frag.appendChild(m);
        }
        box.appendChild(frag);
        box.scrollTop = top;
    }

    function renderTabs() {
        const counts = {
            pending: (!run.running && run.scanList.length)
                ? run.scanList.length
                : run.queue.length + (run.cur ? 1 : 0) + (run.tail ? run.tail.length : 0),
            deleted: deletedList.length,
            skipped: state.skipped.length,
            failed: run.retry.size + run.gaveUp.size
        };
        els.root.querySelectorAll('.slc-tab').forEach(b => {
            const k = b.dataset.tab;
            b.classList.toggle('on', k === view.tab);
            const em = b.querySelector('em');
            if (em) em.textContent = counts[k];
        });

        const isLog = view.tab === 'log';
        els.log.hidden = !isLog;
        els.list.hidden = isLog;
        els.filter.hidden = isLog;
        renderSelbar();
        if (isLog) return;

        const q = els.filter.value.trim().toLowerCase();
        const pendingToken = (!run.running && run.scanList.length)
            ? `S${run.scanList.length}`
            : `${run.queue.length}|${run.queue[0] ? run.queue[0].packageId : ''}|${run.cur ? run.cur.packageId : ''}|${run.tail ? run.tail.length : 0}`;
        const token = {
            pending: pendingToken,
            deleted: deletedList.length,
            skipped: state.skipped.length,
            failed: `${run.retry.size}|${run.gaveUp.size}|${[...run.retry.values()].reduce((a, g) => a + g.attempts, 0)}`
        }[view.tab];
        const sig = `${state.lang}|${view.tab}|${q}|${token}`;
        if (sig === view.sig) return;
        view.sig = sig;

        if (view.tab === 'pending' && !run.running && run.scanList.length) {
            renderCatButtons();
        }
        renderList(view.tab, q);
    }

    function render() {
        if (!els) return;
        const left = Math.max(0, state.cooldownUntil - Date.now());
        const ctl = run.ctl;

        let cls = '', label = t('b_idle');
        if (run.scanning) { cls = 'run'; label = t('b_scanning'); }
        else if (run.running) { cls = left > 0 ? 'cool' : 'run'; label = left > 0 ? t('b_cool') : t('b_run'); }
        else if (run.last === 'done') { cls = 'done'; label = t('b_done'); }
        else if (run.last === 'scanned') { cls = 'done'; label = t('b_scanned'); }
        else if (run.last === 'stopped') { label = t('b_stopped'); }
        els.badge.className = 'slc-badge ' + cls;
        els.badge.textContent = label;

        els.removed.textContent = state.removed;
        els.skipped.textContent = state.skipped.length;
        els.retry.textContent = run.retry.size;
        const remain = ctl ? Math.max(0, ctl.total - ctl.finished) : 0;
        els.remain.textContent = remain + (ctl && !ctl.readerDone ? '+' : '');

        const pct = ctl && ctl.total ? Math.min(100, ctl.finished / ctl.total * 100) : 0;
        els.bar.style.width = pct.toFixed(1) + '%';

        if (run.scanning) els.cur.textContent = t('curScanning', ctl ? ctl.pages : 0, ctl ? ctl.total : 0);
        else if (run.running && run.preparing) els.cur.textContent = t('curPreparing');
        else if (run.running && run.current) els.cur.textContent = t('curProcessing', run.current);
        else if (!run.running && run.last === 'scanned') els.cur.textContent = t('curScanDone', ctl ? ctl.total : 0);
        else if (!run.running && run.last) els.cur.textContent = run.last === 'done' ? t('curAllDone') : t('curStopped');
        else els.cur.textContent = t('notStarted');

        let eta = '';
        if (run.running && !run.scanning && run.processed >= 5 && remain > 0) {
            const per = (Date.now() - run.startAt) / run.processed;
            const ms = per * remain + left;
            eta = t('eta', fmtDhm(ms), fmtAt(ms));
            if (ctl && !ctl.readerDone) eta += (state.lang === 'zh' ? '' : ' ') + t('etaReading');
        } else if (ctl && ctl.total && !run.scanning && run.last !== 'scanned') {
            eta = `${ctl.finished} / ${ctl.total}`;
        }
        els.eta.textContent = eta;

        if (left > 0) {
            els.cool.hidden = false;
            els.cool.innerHTML = t('coolBar', fmtClock(left), state.coolLevel, run.running);
        } else {
            els.cool.hidden = true;
        }

        els.start.disabled = run.running;
        els.scan.disabled = run.running;
        els.stop.disabled = !run.running;
        els.reset.disabled = run.running;
        els.clearcool.disabled = left <= 0;
        els.restoreskip.disabled = run.running || !skipBackup || !skipBackup.skipped || !skipBackup.skipped.length;
        els.qDemo.disabled = run.running;
        els.qSound.disabled = run.running;
        els.qDlc.disabled = run.running;
        els.qTool.disabled = run.running;
        renderTabs();

        document.title = run.running && ctl && ctl.total
            ? `[${ctl.finished}/${ctl.total}] ${origTitle}` : origTitle;
    }

    async function waitInterruptible(ms, label) {
        const end = Date.now() + ms;
        if (label && ms > 10000) log(t('logWait', label, Math.round(ms / 1000)), 'info');
        while (Date.now() < end) {
            if (!run.running) return false;
            await sleep(Math.min(500, Math.max(0, end - Date.now())));
        }
        return run.running;
    }

    async function honorCooldown() {
        while (run.running) {
            const left = state.cooldownUntil - Date.now();
            if (left <= 0) return true;
            await sleep(Math.min(500, left));
        }
        return false;
    }

    function parseRemovable(doc) {
        const games = [];
        doc.querySelectorAll('.account_table tr').forEach(row => {
            const link = row.querySelector('a[href^="javascript:RemoveFreeLicense"]');
            if (!link) return;
            const match = link.getAttribute('href').match(/RemoveFreeLicense\(\s*(\d+)\s*,/);
            if (!match) return;
            const packageId = match[1];
            if (skipSet.has(packageId) || run.gaveUp.has(packageId)) return;
            const cells = row.querySelectorAll('td');
            games.push({
                packageId,
                itemName: cells[1] ? cells[1].textContent.trim() : t('unknownName'),
                attempts: 0
            });
        });
        return games;
    }

    function findNext(html, curOffset) {
        let best = null;
        const consider = (token, offset) => {
            if (offset > curOffset && (!best || offset < best.offset)) best = { token, offset };
        };
        let m;
        const re1 = /continuationToken=([^&"'\s<>]+)(?:&amp;|&)offset=(\d+)/g;
        while ((m = re1.exec(html))) consider(m[1], +m[2]);
        const re2 = /offset=(\d+)(?:&amp;|&)continuationToken=([^&"'\s<>]+)/g;
        while ((m = re2.exec(html))) consider(m[2], +m[1]);
        return best;
    }

    async function fetchPage(url) {
        for (let n = 0; n < 5; n++) {
            if (!run.running) return null;
            try {
                const resp = await fetch(url, { credentials: 'same-origin' });
                if (resp.ok) return await resp.text();
                log(t('pageHttp', resp.status), 'warn');
            } catch (e) {
                log(t('pageErr', e.message), 'warn');
            }
            if (!(await waitInterruptible(rand(CFG.netRetryDelay)))) return null;
        }
        return null;
    }

    async function readerTask(queue, ctl) {
        const seen = new Set();
        let url = 'https://store.steampowered.com/account/licenses/';
        let offset = 0;
        try {
            for (let page = 1; page <= CFG.maxPages && run.running; page++) {
                const html = await fetchPage(url);
                if (html === null) break;

                const doc = new DOMParser().parseFromString(html, 'text/html');
                for (const g of parseRemovable(doc)) {
                    if (seen.has(g.packageId)) continue;
                    if (run.allowedSet && !run.allowedSet.has(g.packageId)) continue;
                    seen.add(g.packageId);
                    g.cats = categorize(g.itemName);
                    g.checked = true;
                    queue.push(g);
                    ctl.total++;
                }
                ctl.pages = page;
                if (page % 5 === 1) log(t('readProg', page, ctl.total), 'info');

                const next = findNext(html, offset);
                if (!next) {
                    log(t('readDone', page, ctl.total), 'info');
                    break;
                }
                offset = next.offset;
                url = `https://store.steampowered.com/account/licenses/?continuationToken=${next.token}&offset=${next.offset}`;
                await sleep(rand(CFG.pageFetchDelay));
            }
        } finally {
            ctl.readerDone = true;
        }
    }

    async function removeGame(packageId) {
        try {
            const response = await fetch('https://store.steampowered.com/account/removelicense', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `sessionid=${encodeURIComponent(g_sessionID)}&packageid=${encodeURIComponent(packageId)}`
            });
            if (response.status === 429) return { success: false, code: 84, error: 'HTTP 429' };
            if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
            const data = await response.json();
            if (data.success === 1) return { success: true };
            return { success: false, code: data.success, error: t('errCode', data.success) };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    function triggerCooldown(reason) {
        state.coolLevel = Math.min(state.coolLevel + 1, 15);
        const startMin = Math.min(15, Math.max(1, state.coolMin || CFG.coolMin));
        const minutes = Math.min(15, startMin + (state.coolLevel - 1) * CFG.coolStepMin);
        let dur = minutes * 60000;
        dur *= 1 + (Math.random() * 2 - 1) * CFG.coolJitter;
        dur = Math.min(CFG.coolMax, Math.max(startMin * 60000, dur));
        state.cooldownUntil = Date.now() + dur;
        state.minGap = Math.min(CFG.gapMax, Math.max(CFG.gapFirst, Math.round(state.minGap * CFG.gapGrowth)));
        saveState();
        log(t('coolLog', reason, run.sinceLimit, fmtClock(dur), state.coolLevel, Math.round(state.minGap / 1000)), 'warn');
        run.sinceLimit = 0;
        run.okStreak = 0;
    }

    function onSuccess() {
        run.okStreak++;
        run.sinceLimit++;
        run.failStreak = [];
        if (run.okStreak % CFG.coolDecayAfter === 0 && state.coolLevel > 0) {
            state.coolLevel--;
        }
        if (run.okStreak % CFG.gapDecayAfter === 0 && state.minGap > 0) {
            state.minGap = Math.round(state.minGap * CFG.gapDecay);
            if (state.minGap < 1000) state.minGap = 0;
        }
    }

    async function attemptInner(g, ctl) {
        while (run.running) {
            if (!(await honorCooldown())) return 'stop';
            run.current = g.itemName;
            const res = await removeGame(g.packageId);

            if (res.success) {
                onSuccess();
                state.removed++;
                recordDeleted(g);
                run.removedRun++; run.processed++; ctl.finished++;
                run.retry.delete(g.packageId);
                saveState();
                log(t('okLog', g.itemName, g.packageId), 'ok');
                return 'removed';
            }

            if (res.code === 29) {
                state.skipped.push(g.packageId);
                state.skippedInfo[g.packageId] = g.itemName;
                skipSet.add(g.packageId);
                run.skippedRun++; run.processed++; ctl.finished++;
                run.retry.delete(g.packageId);
                saveState();
                log(t('skipLog', g.itemName, g.packageId), 'skip');
                return 'skipped';
            }

            if (res.code === 84) {
                triggerCooldown(t('reason84'));
                continue;
            }

            if (res.code === 24) {
                log(t('err24'), 'err');
                run.running = false;
                return 'stop';
            }

            g.attempts = (g.attempts || 0) + 1;
            g.lastErr = res.error;
            run.okStreak = 0;
            run.failStreak.push(g);

            if (run.failStreak.length >= CFG.breakerAfter) {
                run.failStreak.forEach(x => { x.attempts = Math.max(0, x.attempts - 1); });
                run.failStreak = [];
                run.retry.set(g.packageId, g);
                triggerCooldown(t('reasonBreaker', CFG.breakerAfter, res.error));
                return 'deferred';
            }

            if (g.attempts >= CFG.maxAttempts) {
                run.gaveUp.set(g.packageId, g);
                run.retry.delete(g.packageId);
                run.processed++; ctl.finished++;
                log(t('gaveLog', g.itemName, g.packageId, g.attempts, res.error), 'err');
                return 'gaveup';
            }

            run.retry.set(g.packageId, g);
            log(t('deferLog', g.itemName, g.packageId, res.error, g.attempts, CFG.maxAttempts), 'warn');
            return 'deferred';
        }
        return 'stop';
    }

    async function attempt(g, ctl) {
        run.cur = g;
        try { return await attemptInner(g, ctl); }
        finally { run.cur = null; }
    }

    async function pace(r) {
        if (!run.running) return;
        let ms;
        if (r === 'deferred' || r === 'gaveup') {
            ms = rand(CFG.failDelay);
        } else {
            const d = state.delaySec * 1000;
            ms = rand([d * 0.6, d * 1.4]) + state.minGap;
        }
        await waitInterruptible(ms);
    }

    async function keepAwake(on) {
        try {
            if (on) {
                if (navigator.wakeLock && !run.wake) run.wake = await navigator.wakeLock.request('screen');
                if (navigator.locks && !run.lockRelease) {
                    navigator.locks.request('slc-keepalive', () => new Promise(res => { run.lockRelease = res; }));
                }
            } else {
                if (run.wake) { await run.wake.release(); run.wake = null; }
                if (run.lockRelease) { run.lockRelease(); run.lockRelease = null; }
            }
        } catch (e) {}
    }
    document.addEventListener('visibilitychange', () => {
        if (run.running && document.visibilityState === 'visible') { run.wake = null; keepAwake(true); }
    });
    window.addEventListener('beforeunload', e => {
        saveDeleted();
        if (run.running) { e.preventDefault(); e.returnValue = ''; }
    });

    async function runCleaning(skipConfirm) {
        if (run.running) return;

        let allowedSet = null;
        if (run.scanList.length) {
            const checked = run.scanList.filter(g => g.checked);
            if (!checked.length) {
                log(t('noSelection'), 'warn');
                return;
            }
            allowedSet = new Set(checked.map(g => g.packageId));
        }
        if (!skipConfirm && !window.confirm(t('confirmDelete'))) return;
        run.allowedSet = allowedSet;

        run.running = true;
        run.last = '';
        run.processed = 0; run.removedRun = 0; run.skippedRun = 0;
        run.startAt = Date.now();
        run.okStreak = 0; run.sinceLimit = 0; run.failStreak = [];
        run.retry.clear();
        run.gaveUp.clear();
        run.tail = [];
        run.preparing = false;
        keepAwake(true);

        if (allowedSet) log(t('startLogChecked', allowedSet.size), 'info');
        else log(t('startLog', state.removed, state.skipped.length), 'info');
        if (state.cooldownUntil > Date.now()) {
            log(t('stillCooling', fmtClock(state.cooldownUntil - Date.now())), 'warn');
        }

        let finishedAll = false;
        try {
            let round = 0;
            while (run.running) {
                round++;
                if (round > 1) log(t('rescan', round), 'info');
                const queue = run.queue = [];
                const ctl = { readerDone: false, total: 0, finished: 0, pages: 0 };
                run.ctl = ctl;
                run.tail = [];
                run.preparing = false;
                readerTask(queue, ctl);

                const skipN = Math.max(0, Math.floor(Number(state.skipFirst) || 0));
                if (skipN > 0) {
                    log(t('prepLog', skipN), 'info');
                    run.preparing = true;
                    while (run.running && queue.length < skipN && !ctl.readerDone) {
                        await sleep(100);
                    }
                    run.preparing = false;
                    if (queue.length > 0) {
                        run.tail = queue.splice(0, Math.min(skipN, queue.length));
                    }
                }

                while (run.running) {
                    if (!queue.length) {
                        if (!ctl.readerDone) { await sleep(300); continue; }
                        if (run.tail.length) {
                            queue.push(...run.tail);
                            run.tail = [];
                            continue;
                        }
                        break;
                    }
                    const g = queue.shift();
                    const r = await attempt(g, ctl);
                    if (r === 'stop') break;
                    await pace(r);
                }

                let pass = 0;
                while (run.running && run.retry.size) {
                    pass++;
                    log(t('retryStart', run.retry.size, pass), 'info');
                    if (!(await waitInterruptible(CFG.retryPassWait, t('retryWaitLabel')))) break;
                    const items = [...run.retry.values()];
                    run.retry.clear();
                    for (const g of items) {
                        if (!run.running) break;
                        const r = await attempt(g, ctl);
                        if (r === 'stop') break;
                        await pace(r);
                    }
                }

                if (!run.running) break;
                if (ctl.finished === 0) { finishedAll = true; break; }
            }
        } catch (e) {
            log(t('scriptErr', e && e.message), 'err');
        }

        run.last = finishedAll ? 'done' : 'stopped';
        run.running = false;
        run.preparing = false;
        run.tail = [];
        // 清理结束后丢弃过期的扫描列表与勾选状态，避免下次误用旧勾选
        run.scanList = [];
        run.allowedSet = null;
        view.sig = '';
        keepAwake(false);
        saveState();
        saveDeleted();

        log(t('finishLog', finishedAll, run.removedRun, run.skippedRun, run.gaveUp.size, state.removed), finishedAll ? 'ok' : 'info');
        if (run.gaveUp.size) {
            const names = [...run.gaveUp.values()].slice(0, 20).map(x => `${x.itemName}(${x.packageId})`).join(', ');
            log(t('gaveList', names, run.gaveUp.size > 20), 'err');
        }
        render();
    }

    async function scanOnly() {
        if (run.running) return;
        run.allowedSet = null;
        run.running = true;
        run.scanning = true;
        run.last = '';
        run.queue = [];
        run.tail = [];
        run.scanList = [];
        const ctl = { readerDone: false, total: 0, finished: 0, pages: 0 };
        run.ctl = ctl;
        log(t('scanStart'), 'info');
        try {
            await readerTask(run.queue, ctl);
        } catch (e) {
            log(t('scanErr', e && e.message), 'err');
        }
        const completed = run.running;
        run.scanList = run.queue.slice();
        run.queue = [];
        run.last = completed ? 'scanned' : 'stopped';
        run.running = false;
        run.scanning = false;
        log(completed ? t('scanDone', ctl.total) : t('scanStopped'), completed ? 'ok' : 'info');
        if (completed && run.scanList.length) {
            view.tab = 'pending';
            log(t('scanSwitched'), 'info');
        }
        view.sig = '';
        render();
    }

    function stopCleaning() {
        if (!run.running) return;
        run.running = false;
        log(t('stopReq'), 'info');
    }

    function waitForPage() {
        return new Promise(resolve => {
            if (document.querySelector('.page_content > h2')) return resolve();
            const observer = new MutationObserver(() => {
                if (document.querySelector('.page_content > h2')) {
                    observer.disconnect();
                    resolve();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }
    waitForPage().then(buildUI);
})();
