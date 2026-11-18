# RogOS 本地后端与验收记录

更新：2026-11-18。阶段二已开始，当前交付是本机前后端环境；尚未完成站长权限改造、作者默认配置清理或公网部署。

## 启动与停止

先打开 Docker Desktop，等待 Docker Engine 就绪，再运行：

```sh
cd /Users/david/Documents/RogOS
export PATH="/Users/david/.local/share/rogos-tools/node_modules/.bin:$PATH"
bun run dev:rogos:local
```

打开 http://127.0.0.1:5174 。此命令启动独立 Redis、等待 API 健康检查，再启动 Vite。Ctrl+C 停止本次 API、Vite 和独立 Redis；保留数据卷，不删除数据。不要与 `bun run dev:rogos` 同时运行：两者共用 5174，以保持浏览器数据来源不变。端口已占用时启动器拒绝启动，不会杀掉占用端口的其他进程。

| 服务 | 地址 | 用途 |
| --- | --- | --- |
| Vite | 127.0.0.1:5174 | 前端，通过同源代理访问 API / WebSocket |
| Bun API | 127.0.0.1:3004 | 117 个路由的服务入口；不代表所有路由已配置或验收 |
| Redis | 127.0.0.1:6384 | Docker 独立 rogos-local 项目，AOF 持久化 |

Redis 镜像固定版本和摘要，数据卷为 `rogos-local_redis-data`；本地浏览器的 IndexedDB/localStorage 与 Redis 是两套不同的数据。浏览器备份不等于服务器备份。不要执行 `docker compose down -v` 来日常停止，这会删除 Redis 数据卷。

检查命令：

```sh
curl http://127.0.0.1:3004/health
docker compose -f dev/compose.rogos.yml ps
docker compose -f dev/compose.rogos.yml logs --tail 30 redis
```

若启动前提示无法连接 Docker daemon，先启动 Docker Desktop。若终端或主机异常关闭，确认 3004/5174 没有残留服务再重启；需要单独停止 Redis 时可执行 `docker compose -f dev/compose.rogos.yml stop`，该命令不会停止 API/Vite。

## 环境边界

- 所有监听均限制在 127.0.0.1；没有公网部署。
- 启动器固定 Redis URL、本地实时通信、站点来源与 Vite 代理目标，不使用作者的 Pusher。
- 不自动创建站长账号、不配置付费密钥、不修改博客或房间工作树。
- 当前仍继承上游认证和注册机制，以及部分作者专用身份规则。仅适用于本机开发，不能直接作为已完成权限隔离的公开服务。
- Bun 和上游 API 会加载项目环境文件，启动器也继承 shell 环境。当前未配置服务凭据；将来添加 `.env`、`.env.local` 或 shell 密钥时，这些凭据可能启用外部能力。不要提交真实凭据。
- 实时服务的 local 配置已由健康检查确认，但尚未完成多客户端 WebSocket 消息回归。

## 验收结果

2026-11-17 实际执行：

- 浏览器设置页导出 gzip 备份，随后修改测试便笺，导入原备份并自动重启；验证原文字恢复。使用隔离 Chrome 上下文，未覆盖用户日常数据。
- 本地注册返回 201；登录与携带 cookie 的会话请求返回 200。匿名会话返回 `{authenticated:false}`；匿名管理员请求返回 403。
- 连续测试注册触发 429，未绕过限制；Redis 中留有 audit 前缀的临时本地测试账号，未把它们作为站长身份。
- Redis 重启后探针值保留，验证后删除探针。

2026-11-18 中断恢复后复核：

- 两轮完整启动、代理请求、SIGTERM 停止；3004/5174 在每轮退出后均释放。
- 在第一轮写入 Redis 探针，第二轮启动后读回相同值并删除，验证完整停止后数据仍保留。
- 修复初版启动器通过 shell 启动 Vite 留下孤立子进程的问题；现在直接管理 Vite 服务器进程。
- Finder、TextEdit、IndexedDB 手动备份、同步恢复相关 20 个测试文件：114 pass / 0 fail。
- `bun run typecheck` 通过；它不覆盖所有 scripts，启动器另经过上述实际运行验证。

## 尚未通过与下一步

- 健身动作库请求返回 502 `exercise_library_unavailable`，日志为外部公开源 ECONNRESET；词典 WordNet 下载也出现连接重置。后端启动成功不能替代数据源连通性，需要继续定位本机网络、代理或提供可验证的本地数据来源。
- 无付费凭据的 AI、地图、语音、YouTube 搜索仍不可用；没有尝试付费调用。
- 未完成生产构建、全量 API 集成、文件导入导出全格式、备份跨版本兼容、真实媒体设备与多人同步验收。已有单元测试不替代这些操作验收。
- 后续先处理公共数据源连通性与应用真实接口回归，再改造站长权限及个人配置；不能把本记录当作阶段二全部完成。
