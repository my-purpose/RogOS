# 本地应用核心工作流验收

执行日期：2026-11-20；2026-11-21 恢复任务后核对完整运行结果。基线为 `7384006` 加本轮 Preview 修复。结果来自真实 Chrome headless / Playwright UI 操作，每个应用使用独立浏览器上下文，未修改日常数据。启动通过开发版应用管理入口，其余输入、菜单、拖动、导入导出通过 UI。测试本地 `127.0.0.1:5174`，未调用付费 AI。

## 结果

| 应用 | 实际验证 | 结果及边界 |
| --- | --- | --- |
| Journal | 选择当天，输入中文日页及第二段；等待 1 秒后刷新；切换 Freeform，悬停展开工具条，添加并双击编辑便笺，刷新 | 通过：日页中文、画布便笺保留。没有把自动保存后一秒刷新等同于立即关闭零丢失保证 |
| Stickies | 编辑中文便笺，菜单新建第二便笺，刷新；Clear All Notes 后再次刷新 | 通过：两张便笺均保留；清空后两段内容均不存在，应用保留一个空便笺 |
| Terminal | help、cd Documents、touch、ls、echo、未知命令、rm | 部分通过：目录切换、创建文件输出、中文输出、未知命令错误、移入废纸篓输出均验证。`mkdir` 明确返回 `command not implemented: mkdir requires filesystem write access`，不计创建目录通过 |
| Paint | 真正鼠标画笔拖动；菜单 Undo、Redo；读取 canvas 像素编码比较 | 通过：画笔改变图像，Undo 精确恢复原图，Redo 精确恢复笔画 |
| Finder | Documents 内新建文件夹；重复同名创建；将 README.md 拖进该目录并进入；刷新 | 通过：重复名明确拒绝；移动后在目标目录可见，刷新仍在。未认证文件夹整体移动、复杂冲突覆盖及永久删除 |
| TextEdit | HTML 标题、粗体、两项列表与中文导入；导出 HTML，检查下载字节并重新导入；导入两段 RTF | 通过：HTML 标题/粗体/列表结构与中文在所测往返保留；RTF 正文两段显示。未认证 DOCX/DOC 或复杂样式、嵌入资源全格式往返 |
| Preview | 导入伪 PNG；随后导入合法 40×30 SVG | 修复后通过：伪 PNG 明确显示 `Couldn’t open this file.`，随后合法 SVG 正常解码为 40×30。未认证 PDF、多页或其他所有解码失败类型 |

完整机器证据：`local-results.json`。共 6 个应用测试通过，Terminal 为部分通过，未将其未实现的 `mkdir` 自动豁免。

## 修复

Preview 原本仅处理文件读取错误，没有处理浏览器 `<img>` 解码失败。伪造 `broken.png` 文件可以进入 VFS 并触发 `File imported`，但图片显示损坏，无解释。

本轮在 `PreviewAppComponent.tsx` 记录解码失败的 object URL，由 `<img onError>` 触发既有错误界面。错误绑定到当次 URL，新文件不会沿用旧错误。测试还导入合法 SVG 证明错误后可以继续使用。导入文件本身仍可成功，因此原导入通知保留；预览解码结果在窗口中明确显示。

## 运行

```sh
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  node scripts/acceptance/local-workflows.mjs
```

脚本遇到断言失败退出码为 1，`partial` 保留已知未实现功能并在 JSON 写明限制。脚本不通过强制点击掩盖遮挡：Journal 先悬停展开工具条；Finder 先等待目录切换再创建，避免测试误在两个目录建立同名文件夹。启动以外未通过直接修改 store 制造通过结果。
