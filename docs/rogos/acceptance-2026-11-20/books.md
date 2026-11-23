# Books 实际操作验收（2026-11-20）

环境：本机 127.0.0.1:5174，隔离 Chrome headless 上下文，英文 UI。脚本现场生成原创两章 EPUB，无第三方书籍下载、无账号或付费模型调用。仅启动 Books 使用开发环境应用入口；导入用文件输入，选择文字用鼠标拖动，颜色/书签/章节等通过 UI 操作，状态检查只读。

## 结果

`books-results.json` 保存逐项断言，`books-reader.png` 为最终已恢复的蓝色高亮及列表截图。

- 导入 EPUB，书架出现标题/作者，点击后真实 EPUB iframe 渲染正文。
- 第一章添加书签，鼠标拖选自动高亮，点击蓝色色块修改高亮。
- Go → Chapters → Second Chapter，阅读进度变为约 67%。
- 刷新后自动恢复第二章、进度、蓝色高亮、第一章书签。
- 返回第一章，移除书签。
- Shelf 返回书架并重开该书，再刷新，已删除书签不复活，蓝色高亮仍存在。
- 打开 Highlights，恢复的记录及蓝色色点在实际 UI 中可见。
- 窗口宽度和视口变化后，Shelf 按钮中心仍真实命中按钮；实际角落拖拽缩放仍正常。

## 本轮发现与修复

Shelf 按钮被缩放热区遮挡：默认窗口右上角 Shelf 按钮中心落在东北角 resize-handle 内，普通点击命中缩放手柄，Playwright 不使用 force 点击时持续失败。`books-failure.png` 是修复前截图；失败日志明确报告 resize-handle intercepts pointer events。

在 BooksAppComponent.tsx 的右侧标题栏按钮组增加 pr-2（8px 右内边距），让按钮退让窗口角落的缩放区域，不改全局窗口行为。修复后使用 elementFromPoint 验证按钮中心命中，并以真实鼠标点击返回书架；同时保留真实拖拽缩放测试。

## 复跑

运行 `node scripts/acceptance/books.mjs`。需要本地开发服务；可通过 CHROME_PATH 指定 Chromium，默认使用本机 Google Chrome。脚本拒绝非 localhost/127.0.0.1 地址，结束关闭独立浏览器，不接触日常存储。断言失败退出非零。

Books 单测：`bun test tests/unit/books`，229 pass / 0 fail（28 文件）。

## 范围限制

本轮为两章标准 EPUB 核心路径，不覆盖 DRM、损坏 EPUB、复杂排版、超大书籍、所有语言及云端同步。刷新检查发生在常规保存等待后（700–1000ms），没有宣称 Books 立即刷新或浏览器崩溃下的所有操作都已认证。朗读、Ask Ryo 与翻译的模型能力不在本轮通过项中。
