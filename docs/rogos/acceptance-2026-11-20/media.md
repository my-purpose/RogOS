# 媒体与外部服务补验

执行于 2026-11-20 至 2026-11-23（Asia/Shanghai），本地 5174，Chrome headless 隔离上下文。未读取日常浏览器数据，未输入密钥、未调用付费模型、未发送聊天消息。用 UI 打开、点击和录音，读取媒体元素/存储仅用于断言。合成摄像头和麦克风不等于真实硬件认证。

## 已确认并修复

1. Soundboard 拒绝麦克风权限后只有控制台错误，用户不知道为什么没有开始录音。`useAudioRecorder` 现在显示可操作的权限提示，其他录音失败显示检查设备提示，同时保留原有状态重置。
2. Photo Booth 已有 cameraError，但组件没有展示，只把画面降低透明度。现在在画面区域显示带 `role=alert` 的错误。
3. Soundboard 空槽/录音中缺少翻译键，出现 `apps.soundboard.slot.record` 等原始键。补齐全部 11 个语种的录音标签和错误文本，其他语言 fallback 保留。

`media-before.json` 保留修复前实际 UI 失败：点击空槽后录音拒绝没有提示、摄像头拒绝没有提示；无未处理页面异常不能代表可用。修复后相同拒绝用例通过。

4. 合成麦克风录音停止后，曾出现内存有 9024 字符音频、500ms 后刷新却无录音的结果。录音完成回调现在立即提交并等待持久化，提交结束才退出录音状态；异步保存失败显示错误，流清理放进 finally。回归以录音状态结束作为保存完成信号，随即刷新，不通过额外睡眠掩盖延迟写入。

`media-recording-before.json` 保留新增录音丢失的证据。其他旧失败包括 iPod 空库导出按钮本来禁用（测试错误），已改为断言禁用；TV 开始时已播放，没有 Play 菜单时退出菜单并直接验证媒体。

## 证据与范围

- `media-results.json`：逐用例原始结果、失败步骤、API 或网络错误、媒体元素播放时间。
- `scripts/acceptance/media-services.mjs`：可重复脚本。所有操作仅限 localhost/127.0.0.1；每个用例用独立 context；内置媒体 `play` 和 Web Audio 仅加观察器，不替换播放实现。拒绝权限用例显式注入 NotAllowedError；成功录音/拍照使用 Chromium 合成设备。
- Soundboard 默认音频：实际媒体 currentTime 前进，无解码错误。
- Synth：按下琴键后出现按压状态且新增 OscillatorNode.start；切换 Pad。没有对听感、音质或 MIDI 实物认证。
- Dictionary：点击 serendipity 后获取包含 discovery/chance 等词义内容；不是多语言词典全面认证。
- Maps：明确显示 MapKit 未配置提示，配置提示验收通过，地图核心功能仍 blocked。
- YouTube 播放器仅在实际 video/audio 时间前进且未暂停时记通过；外部加载没有达到该条件记 blocked，不把按钮切到 Pause 当作播放成功。
- iPod/Karaoke 空曲库、管理员未登录、系统镜像/外部网页等，仅把本轮看到的界面与限制记录为 blocked，不冒充已完成核心功能验收。

## 执行

```sh
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node scripts/acceptance/media-services.mjs
bun test tests/unit/i18n/test-translation-audit.test.ts
```

翻译审计：10 pass / 0 fail，21248 assertions。完整报告汇总以 `media-results.json` 的最终运行内容为准。第一阶段不能据本报告认定所有外部服务/物理设备可用。

## 录音保存补验

录音完成回调原来只更新内存，现立即提交待处理持久化写入并等待完成，随后才结束录音状态；提交失败显示错误并清理设备流。测试用合成麦克风实际录制，等待所有录音中标签消失后立即刷新，再等待存储恢复并比较音频长度；没有增加刷新前保存延时。不承诺提交完成前强制刷新零丢失。


## 最终收尾（2026-11-23）

最后全套运行 `media-results.json` 为 8 pass / 10 blocked / 1 fail。唯一 fail 是合成录音停止后仍有 Recording… 文本，不是数据库提交一直未完成：诊断发现 store 的九个录音状态已全为 false、音频已保存，DOM 仍残留旧录音槽。

根因：新板的 `Array(9).fill({...})` 让九个空槽共享对象，而 SoundGrid 的 WeakMap 按对象生成 key，导致九个槽 key 相同。编辑槽又改变对象和 key，React 无法正确协调节点。改用 `${board.id}:${index}`，固定九个槽位有唯一且稳定的身份，不同板也不复用。新增 `test-soundboard-slot-identity.test.tsx` 用共享对象空槽复现此条件，验证唯一、编辑稳定、跨板不同三个约束。

修复后仅重跑失败用例，未重跑无关外部服务：`media-recording-results.json` 中录音状态正常结束，随即刷新后录音长度一致（具体字节见 JSON）。本次停止后不额外 sleep；等待标签结束作为提交完成信号。定向单测与持久化测试合计 4 pass / 0 fail，证据 `media-unit.txt`。

按最新证据合并：**9 pass / 10 blocked / 0 未关闭 fail**，见 `media-final-results.json`，每条都有来源字段；这不是一次全套运行的伪造统计。TV 曾有通过轮次，但最终外部播放未在窗口内得到时间推进，仍保留 blocked。未将物理硬件、外部账号或系统镜像认证豁免为通过。

仅重跑录音回归：

```sh
ACCEPTANCE_CASE=recording-persistence node scripts/acceptance/media-services.mjs
```
