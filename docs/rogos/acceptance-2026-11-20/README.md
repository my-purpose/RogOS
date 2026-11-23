# 第一阶段核心工作流补验

执行日期：2026-11-20 至 2026-11-23（Asia/Shanghai）。基线：7384006，加本次修复。

本轮补验承接 [上一轮报告](../acceptance-2026-11-19/README.md)，不重复将启动检查计作功能通过。Chrome headless 使用独立上下文，API/Redis/Vite 为本机专用服务；没有操作日常浏览器数据、配置付费密钥、发送消息或发布站点。源码导入仅用于启动应用和读取断言状态，编辑、文件导入、按钮点击及下载均走界面；故障注入限定在测试上下文。

## 已完成的核心流程

| 模块 | 新增实际验收 | 证据 |
| --- | --- | --- |
| Contacts | 新建立即刷新；三次修改已有联系人立即刷新；检查点配额失败提示/重试；数据库写失败提示/检查点恢复 | contacts.json（8 项） |
| Calendar | 跨三天全天事件与中文备注导出 ICS；独立上下文导入，刷新恢复；结束日期排他语义核对 | calendar.json |
| Fitness | 添加深蹲训练，8 次×60kg；480kg 总量与个人纪录；刷新后训练数据保留 | fitness.json |
| Stuff | 物品中文标题/品牌导出 Shelf，独立上下文导入并刷新 | stuff.json |
| Applet Viewer | 本地 HTML 导入、iframe 内按钮执行、sandbox 属性存在、刷新重新打开 | applet.json |
| Books | 自产两章 EPUB 导入、阅读、鼠标选段高亮、改蓝色、章节与进度、书签增删、刷新、返回书架并重开 | books-results.json / books.md |
| Journal / Stickies / Terminal / Paint / Finder / Preview / TextEdit | 逐项结果与限制见子报告；Terminal mkdir 占位不能算通过 | local-results.json / local.md |
| 媒体与外部服务 | 播放时间推进、权限拒绝、音频节点、词典查询与依赖检查等；模拟与真实设备分开记录 | media-final-results.json / media.md |

测试脚本位于 `scripts/acceptance/`：`contacts-boundaries.mjs`、`calendar-roundtrip.mjs`、`fitness-workout.mjs`、`stuff-roundtrip.mjs`、`applet-import.mjs`、`books.mjs`、`local-workflows.mjs`、`media-services.mjs`。

运行示例（本地服务就绪后）：

```sh
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node scripts/acceptance/contacts-boundaries.mjs
```

Calendar fixture 使用 2026-11-20 至 22 日，Fitness 训练推荐受日期影响；其他日期重跑时须核对日期与推荐动作，定位器失败不能直接归为产品缺陷。固定延时仅用于原有自动保存流程；Contacts 的立即刷新检查没有增加保存等待。

## 修复范围

- Books：返回书架按钮与右上角缩放热区重叠，增加右侧间距，保留窗口缩放。
- Preview：损坏图片解码失败没有明确错误状态，增加图片 onError 检测及已有失败提示。
- Soundboard：麦克风拒绝或录音启动失败仅输出控制台，改为可见错误提示；补录音按钮文字回退。
- Photo Booth：已有 cameraError 未展示，增加可访问错误提示。

## 验收结论边界

“核心流程通过”只对证据中的步骤成立，不代表全部格式、语言、设备及外部服务认证。没有把未配置服务自动豁免为通过；真实麦克风/摄像头/MIDI、听感、外部媒体授权、AI 与管理员权限仍需对应环境。Terminal mkdir 为明确未实现功能；不在本轮扩展产品功能。

全部模块的历史范围仍见上一轮 32 模块矩阵；本报告覆盖同名项目的最新证据。第一阶段可以按本地核心流程评估，但不能宣称全部应用全面可用。下一阶段配置权限与外部数据源时，必须继续关闭这些依赖门槛。


## 自动回归与新发现

2026-11-21：`bun run typecheck` 通过；全量 `bun run test:unit` 为 4255 pass / 4 skip / 0 fail，共 500 文件。4 个跳过项为真实 Redis 原子性 opt-in 用例，不计通过。Books 定向 229 pass；IE 路由定向 8 pass。结果摘要见 `validation.txt`、`books-unit.txt`。未执行生产构建（遵循本地 AGENTS 限制）。

全量回归曾暴露两个测试环境/维护问题，均已处理：新增错误提示需要所有 11 种语言保持键一致，已补齐并通过翻译审计；IE 路由测试使用 example.com 时，本地 DNS 返回保留地址 198.18.1.123，被正常 SSRF 防护拒绝。该用例在重定向或限流处分支退出，不请求目标内容，因此将路由测试目标改为公开 IP 字面量，避免 DNS 依赖，未修改产品安全逻辑。

2026-11-22 最终回归：录音完成回调增加立即持久化等待，录音状态在回调完成后结束；录音提交失败会显示错误并清理设备流。最终全量仍为 4255 pass / 4 skip / 0 fail，typecheck 通过。媒体成功录制、刷新与受限项目以 media.md 的最终证据为准。

2026-11-23 收尾：Soundboard 新建9空槽共享对象，原 WeakMap key 重复造成旧录音标签残留；改为 board.id:index 后界面完成状态与录音保存/立即刷新恢复通过。最终既有500文件全量4255 pass / 4 skip / 0 fail；随后新增槽位identity测试与持久化测试定向4 pass / 0 fail，类型检查通过。详见 media.md。

媒体最终汇总：9 pass / 10 blocked / 0 未关闭 fail，见 media-final-results.json（逐条链接原始证据）；blocked 不计通过。历史 media-results.json 中的录音失败由 media-recording-results.json 的最终定向结果替代。
