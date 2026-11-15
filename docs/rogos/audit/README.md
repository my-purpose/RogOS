# 应用可用性排查（2026-11-15）

环境：RogOS codex/phase-one，Bun 1.4.4，Vite 开发模式，独立无登录 headless Chrome 上下文。未读取用户浏览器数据、未连接付费模型或配置后端。启动检查通过程序调用应用管理入口，不代表验证了每个桌面入口或全部功能。

## 发现与修复

1. **未启动 API 时返回源码而非接口结果**：GET `/api/fitness/exercises` 实际返回 200 和 Vite 转换后的 JavaScript；前端按 JSON 读取会失败。增加开发中间件，仅在没有 API 代理目标时将 `/api` 与 `/api/*` 返回 503 JSON、`BACKEND_UNAVAILABLE` 和 no-store。配置 `STANDALONE_API_PROXY_TARGET` 时不拦截；生产构建不启用。此修复让失败原因明确，不会让缺失的后端自动可用。
2. **开发依赖地址失效**：观察到按需图标导入触发预打包变更，TextEdit 等应用请求旧依赖 URL 得到 504，部分短时检查只看到桌面。等待初始扫描，并排除原生 ESM 的 Phosphor 包预打包，避免图标重写插件晚发现子路径时反复改写依赖地址。修复后重点复查 TextEdit、设置、Contacts、Books、Chats、iPod、Karaoke。只保证这轮检查未见对应错误，不承诺任何环境永不产生开发热更新重载。
3. **全量单测中 4 项环境污染失败**：桌面 bridge 测试直接赋值前序 DOM 测试留下的只读 window 属性。单独测试原本通过；改为按属性描述符创建并还原临时 window 后，全量通过。
4. 开工时本地 5174 服务已退出，已重新启动。终端进程退出后预览会停止，这与应用功能缺陷不同。

## 已执行真实交互

- Calculator：按钮输入 2 + 3 =，显示 5。
- Stickies：输入文字，刷新后恢复同一文字。
- TextEdit：编辑草稿后刷新保留；另通过文件菜单命名保存 RogOS-audit.md，刷新后文件名和正文均恢复。
- Paint：鼠标按下、拖动、松开后 canvas 内容改变。

这些操作在临时浏览器上下文内执行，不写入用户日常浏览器。没有完成全部应用的全功能端到端认证：文件导入/导出、多标签冲突、备份恢复、摄像头/麦克风、真实媒体播放、完整扫雷局等仍需专项验收。

## 应用结果解释

| 范围 | 结果与限制 |
| --- | --- |
| Finder | 虚拟文件与目录界面出现；不是主机磁盘 |
| TextEdit / Paint / Stickies / Calculator | 上述操作回归通过 |
| Preview / Minesweeper | 界面启动；格式兼容与游戏完整流程未验收 |
| Control Panels / Calendar / Contacts / Journal / Stuff / Terminal | 启动界面出现；作者预置内容仍在；备份、计划与导入等未全部验收 |
| Books | 窗口出现；未提供 EPUB 执行完整阅读验收 |
| Fitness | 计划界面可显示；动作库请求后端，食物 AI 未接入，不算完整可用 |
| Synth / Soundboard / Photo Booth | 界面启动；无实际麦克风、摄像头或扬声器质量测试 |
| Dashboard | 本地组件出现；外部天气/股票等不能据此判为可用 |
| Maps | 明确显示未配置 MapKit，不是 React 崩溃 |
| Dictionary | 搜索界面出现；词典后端未启动 |
| Chats | 欢迎界面出现；AI、登录与聊天室后端不可用 |
| iPod / Karaoke / Videos / TV / Winamp | 仅检查外壳/空曲库/预置列表；搜索、歌词、流媒体、授权与播放受额外依赖限制 |
| Internet Explorer | 代理/时间旅行需要 API，当前不能当作正常浏览器使用 |
| Infinite Mac / Virtual PC | 选择界面出现；未运行镜像，不保证外部资源与模拟器可用 |
| Applet Store / Viewer | 商店依赖后端，当前空内容不等于社区真的没有内容 |
| Admin | 未登录时访问拒绝符合预期；未进行管理员或权限绕过测试 |

原始启动观察见 browser-results.json：包含每个应用页面文本、HTTP 失败、pageerror。无 pageerror 只表示观察期间未捕获未处理异常；不表示功能完整。503 属于缺服务，不能混同资源加载 504。部分后台公共请求（auth/session、songs、analytics）在每个应用都会出现，不能把它们归为每个应用独立的代码缺陷。

## 检查结果

- 修改前全量：4242 pass / 4 skip / 4 fail（499 文件）。
- 修改后全量：4253 pass / 4 skip / 0 fail（500 文件）。
- TypeScript、测试注册、差异空白检查通过。
- 新增 7 项 API 边界测试；与桌面 bridge 合并定向运行共 21 项通过。
- 实际 HTTP 验证：API GET 返回 503 JSON，不再返回转换源码。
- 未运行生产构建和真实 API 集成；本次结论针对开发前端模式。

## 后续依赖工作

本次没有通过隐藏应用或伪造成功数据来掩盖后端缺失。若要使用动作库、账号、词典或媒体搜索等，需要在独立任务中配置 Bun API + Redis，再逐项配置第三方服务与权限。DeepSeek、地图和云同步不能通过修前端一并启用。当前没有声称所有应用已经修复或完整可用。
