# RogOS 第一阶段基线

日期：2026-11-15（Asia/Shanghai）。本阶段建立独立前端开发基线，未部署生产服务。

## 来源与开发

- Fork：https://github.com/my-purpose/RogOS（公开）
- upstream：https://github.com/ryokun6/ryos
- 固定基线：`0d572edacd287538bd731efd3d5b757b07da16cc`；开工时远程 main 与其一致。
- 本地：`/Users/david/Documents/RogOS`；分支：`codex/phase-one`。
- 保留上游 AGPL-3.0-only 许可证和版权声明。当前保留原版 UI 和内容；名称、个人内容与权限边界在后续阶段处理。
- 博客和房间工作树不参与本项目。

使用 Bun 1.4.4（与上游 CI 一致，`.bun-version` 已固定）。上游说明的 1.3.5 无法读取版本 3 锁文件。

```sh
bun install --frozen-lockfile
bun run dev:rogos
```

本机 Bun 安装在 `/Users/david/.local/share/rogos-tools/node_modules/.bin`；如果 shell 找不到 bun，先执行：

```sh
export PATH="/Users/david/.local/share/rogos-tools/node_modules/.bin:$PATH"
```

访问 http://127.0.0.1:5174 。固定端口，避免无意切换浏览器数据来源。命令只启动 Vite，绑定回环地址，并把实时提供方设为 local；未启动 API、Redis 或 WebSocket 服务，未配置付费密钥。不要把前端模式当作离线模式，预置媒体、外部链接等仍可能联网。

GitHub 已显示 Fork Actions 默认禁用；本地工作流另将 image 和 deploy 两个任务固定为 false，防止启用 Actions 后沿用作者 GHCR / Coolify 目标。未来上线前需重新配置，不能直接开启。

## 运行验证清单

Chrome，未登录本地 OS，前端开发模式：

| 状态 | 应用/能力 | 实际证据与边界 |
| --- | --- | --- |
| 可用 | 桌面、Finder | 桌面加载、Dock 打开应用程序目录，显示 30 项，双击启动应用 |
| 可用 | 计算器基本运算 | 实际按钮输入 2 + 3 =，结果 5 |
| 可用 | 便笺基本保存 | 输入测试文字，重新加载页面后文字保留 |
| 受限验收 | Paint、扫雷 | 各自窗口/画布、棋盘界面启动；绘画导出、完整游戏过程尚未验证 |
| 受限验收 | Preview | 打开文稿入口正常；未导入各类真实文件 |
| 受限验收 | TextEdit | 编辑器启动；未完成命名保存、导入导出回归 |
| 待验证 | 系统偏好设置及其他应用 | 不将源码审计等同于运行通过 |
| 未配置 | AI、账号、同步、聊天室及其他后端能力 | 没有启动后端或接入凭据，不承诺可用 |
| 失败（已解决） | Bun 1.3.5 安装依赖 | UnknownLockfileVersion；改用 1.4.4 后 frozen-lockfile 安装成功 |

上述为第一版候选清单，不是最终应用裁剪决策。本轮没有发现已测试基本操作失败；未测试部分不算通过。

## 数据保存位置

实际浏览器检查：当前 origin `http://127.0.0.1:5174` 创建 IndexedDB `ryOS`，版本 18。源码显示 documents/images/books、persisted_state、vfs_items 等对象仓库承载文稿、图片和应用状态；另有 localStorage 保存部分配置/缓存。Finder 是浏览器虚拟文件系统，不是 Mac 硬盘目录。端口、协议、主机名改变会改变 origin；清理站点数据会删除本地记录，嵌入与独立站点共享数据尚未测试。测试便笺只存在此本地浏览器，不写入仓库。

## 自动检查

- `bun install --frozen-lockfile`：成功，1223 packages。
- `bun run typecheck`：通过。
- `bun run test:registration`：通过，499 unit / 31 API / 1 opt-in。
- 计算器引擎、便笺 reducer、Preview wiring 三个既有测试文件：25 pass / 0 fail。
- `git diff --check`：通过。
- 未运行生产构建、全量单测、API 集成或付费测试；上游 AGENTS 对本地构建有明确限制，本阶段使用开发运行验证。

下一步：补齐核心应用文件读写/导出与设置交互回归，再进入阶段二配置边界。上线、AI 及博客嵌入尚未实施。

## 后续排查

2026-11-15 完成 32 个注册模块启动检查及部分本地操作回归，修复开发 API 响应、图标依赖预打包竞态与全量测试环境问题。详细范围和未完成验收见 [应用排查报告](audit/README.md)。

## 本地后端阶段（2026-11-18）

已进入阶段二的本地基础设施部分：独立 Redis + Bun API + Vite 同源代理已运行验证，浏览器备份恢复与停止/重启回归通过。个人权限与外部数据源仍未完成，详见 [本地后端说明](local-backend.md)。

## 全面验收门槛（2026-11-19）

本轮 32 模块启动检查及关键工作流验收发现：联系人 Done 后立即刷新丢数据（重复 5/5）、Books 全量单测高亮颜色失败但隔离运行通过。因此第一阶段**未全面验收通过**；不得将阶段二基础设施已建立等同于全部应用完成验收。完整步骤与未覆盖项见 [验收报告](acceptance-2026-11-19/README.md)。

2026-11-19 后续修复：Contacts 增加同步恢复检查点与提交确认，Books 高亮测试等待异步 hydration 后初始化。复验结果见验收报告末节；其余尚未覆盖的应用工作流仍需补齐。


## 核心流程补验（2026-11-20 至 21）

已补齐联系人保存失败/恢复、Books 实际 EPUB 阅读标注、日历跨日 ICS、健身训练记录、Stuff Shelf、Applet HTML 及本地编辑类应用的核心流程；修复 Books 返回按钮被缩放热区遮挡、Preview 损坏图片无提示及录音/摄像头错误反馈。全量单测 4255 pass / 4 skip / 0 fail、类型检查通过。模块级证据和外部依赖限制见 [补验报告](acceptance-2026-11-20/README.md)。Terminal mkdir 仍为未实现占位，真实设备、授权服务与复杂格式边界仍未全部覆盖，不宣称第一阶段全部应用全面可用。
