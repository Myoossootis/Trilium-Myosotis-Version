# DeepSeek 右侧面板

Trilium 0.105 原生右侧面板中的聊天组件，连接本机官方 DeepSeek Harness 的同一份会话。点击顶部侧栏开关旁的 **DeepSeek** 按钮打开或收起；也可从右侧面板的“组件”页签进入。与大纲、属性和链接共用一个面板，使用原生分隔线调宽，不再显示右下角浮窗。支持历史选择、文字和图片聊天、模型选择、连续追问、停止生成、加载更早消息和新建对话。

不读取笔记或题目，不附带题目，不提供快捷提问或联想。新建按钮只清空入口状态，发送第一条消息时才在 DSH 建立会话。消息和图片由 DSH 保存，Trilium 只持久保存所选会话 ID；旧浮窗的尺寸偏好会忽略。切换笔记、切换右侧页签或收起面板，当前窗口的草稿和待发送图片保留在内存中，刷新窗口会清空未发送内容。隐藏时暂停消息轮询，重新打开后同步回复。窄窗口使用原生临时面板；亮暗主题沿用 Trilium 配色。回答支持 Markdown 和 LaTeX 公式排版；通用文件和工具交互请在 DSH 桌面端查看。

## 回答排版

机器人历史回答与正在生成的回答共用本地 Markdown / KaTeX 渲染器。支持标题、加粗、列表、表格、代码块，以及 `$...$`、`$$...$$`、`\(...\)`、`\[...\]` 公式。未闭合的流式公式暂保留文字，闭合后重新排版；不支持的公式保留原文，不使整个消息出错。用户消息按输入原样展示。

KaTeX 输出由 Trilium 当前 Chromium 原生显示的 MathML，无须联网下载字体或脚本。Markdown 原始 HTML 禁用；公式使用 `trust:false`，限制宏展开和尺寸。代码块里的美元符号不会被当作公式，Markdown 中的远程图片也不自动加载。已完成回答的排版结果按当前消息缓存，避免每次轮询都重复计算公式。

渲染器程序笔记为 `DsChatFmt01`。源码为 `customizations/frontend/dsh-chat-format.js`，固定版本依赖与完整 MIT 许可在 `customizations/vendor/dsh-chat-markdown/`；更新源码后运行 `python tools/build_dsh_chat_formatter.py` 离线重建，再重新安装。只有显式加 `--vendor` 时构建工具才会下载固定版本依赖，并校验包完整性。

## 图片、模型和缓存

- 输入区左侧图片按钮选择图片，也可粘贴剪贴板中的图片。发送前显示缩略图并支持移除；没有文字时也可发送图片。支持 PNG、JPEG、WebP、GIF，每次最多 4 张，单张最多 4 MB，合计最多 8 MB。图片识别能力取决于所选 DSH 模型；发送校验失败时保留草稿和图片。
- 历史图片通过 DSH 的会话授权接口按需读取，刷新后仍可显示，不依赖临时预览。超过 8 MB 的旧历史图片请在 DSH 中查看。
- 模型下拉列表直接读取 DSH 当前可用目录，按提供方分组。切换已有会话会恢复其模型；正在回复时禁止切换。手动选择沿用 DSH 官方 `selectModel` 行为，也会更新 DSH 的默认模型。新对话的选择在首次发送时生效。
- 底部“会话缓存命中”来自 DSH `tokenUsage` 全会话累计统计，而非单次回复或界面估算。计算为 `cacheReadTokens / (uncachedInputTokens + cacheReadTokens + cacheWriteTokens)`，鼠标悬停可看明细。没有统计或总输入为零时显示“—”，不假设为零。翻页、压缩及刷新不会以当前可见消息重新计算累计值。

## 组成

- `customizations/assets/deepseek/whale.svg` / `DsChatIcon01`：官方鲸鱼图标；顶部入口、聊天标记和插件目录统一使用该 SVG，保留上游许可证。
- `customizations/dsh-bridge/`：独立的 DSH Cordis 插件，复用 Session Controller，不读取或改写原始历史文件，不复制 DSH API Key。
- `customizations/backend/dsh-chat-service.js`：Trilium 已认证脚本入口，只向固定的本机地址转发白名单操作。
- `customizations/frontend/dsh-chat.js`：原生 `RightPanelWidget`，聊天内容封装于 Shadow DOM。
- `customizations/frontend/dsh-chat-entry.js`：顶部紧凑入口，调用原生 `selectRightPaneTab` 命令，不另建侧栏。原生模态对话框打开时由原生层级管理面板，不再把聊天搬进弹窗。
- 连接凭据仅在本机用户目录 `.trilium-dsh-bridge/connection.json` 中。桥接只监听 `127.0.0.1:37846`，每次请求校验独立随机密钥、拒绝浏览器 Origin，不开放跨域。

## 安装与恢复

先运行官方 DSH 一次，然后：

```powershell
python tools/install_dsh_bridge.py
python tools/install_dsh_chat.py --token-file "<Trilium ETAPI token 文件>"
```

DSH 插件通过用户 profile 的 overlay 加载，不修改安装目录、ASAR、模型配置或其他插件。Trilium 安装前创建完整数据库备份；程序组件为 `DsChatRoot1`、`DsChatBoot1`、`DsChatEntry1`、`DsChatSvc01`、`DsChatFmt01` 和 `DsChatIcon01`，并刷新现有插件目录。保留旧笔记 ID 以兼容已有安装；`DsChatBoot1` 从启动脚本迁移为原生组件。刷新 Trilium 窗口后加载入口。DSH 未加载新代码时重启 DSH。

停用：在插件管理器关闭“DeepSeek 助手”并刷新，两个界面组件同时停用，桥接入口也拒绝调用。重新安装会保留关闭状态。要停用 DSH 侧桥接，可移除 DSH profile overlay 中 ID 为 `trilium-chat-bridge` 的 insert 项后重启 DSH。历史仍保留在 DSH 中。不要用整份旧 profile 覆盖更新后的其他个人设置。

## 更新兼容与稳定性

已验证 DSH `0.2.1-rc.2`。不承诺未来所有预览版均兼容。Trilium 和 DSH 之间使用自有协议 1，DSH 变化集中适配桥接层。

桥接检查必要方法、列表和历史/消息结构；发送前先验证该会话可通过历史接口读取。发现不兼容时停止发送、显示错误，不尝试改写原始历史或自动降级到另一套会话。正常断线可重新连接；请求 ID 沿用 DSH 的消息去重机制，避免同一次不确定发送被重试成两条。

DSH 更新后可运行只读检查（不发送模型请求）：

```powershell
python tools/check_dsh_chat.py
```

如果更新移除了用户 overlay，应重新运行桥接安装器。若接口格式有变化，需适配桥接后再恢复发送，不要为了继续使用而强行打开历史文件写入。

## 验证

`tools/test_dsh_sidebar_native.cjs` 在隔离的原生 Trilium 中验证右侧面板、公式排版、模型和图片控件、缓存统计、原生页签切换、草稿保留、隐藏时停止轮询、桌面/窄窗、亮暗主题及插件开关。桥接响应使用确定性夹具，**不会发送真实模型请求**。该测试会单独记录知识库返回组件在启动阶段已有的 `check/getActiveContext` 异常，不将它计为 DeepSeek 的验证结果。

`tools/test_dsh_sidebar_history_native.cjs` 只读打开此前报告公式问题的真实 DSH 会话，验证 12 个公式（含 3 个独立公式）、模型目录、图片入口和用量状态，不发送消息或切换模型。

下列浮窗脚本保留作为旧版本回归记录，含旧浮窗尺寸或模态窗口断言，不能代替当前右侧面板验收；其中涉及真实模型的脚本会产生 API 用量。

`tools/test_dsh_chat_native.cjs` 仅连接隔离 Trilium 的 37841/37842 端口，使用 `tmp/dsh-chat-test-session.json` 标识的独立 DSH 测试会话，验证实际模型回答、同会话追问、重载恢复、最小化、缩放及原生模态窗口的输入。测试消息只写入专门测试会话。

`tools/test_dsh_chat_media_native.cjs` 验证实际模型切换、图片选取和移除、模拟剪贴板事件、校验失败保留草稿、真实图片识别、历史缩略图和缓存数据重载。测试使用生成的随机验证码图片，超过 64 KB，用于覆盖旧桥接请求上限；测试结束恢复原 DSH 默认模型及思考强度。`tools/test_dsh_chat_media.mjs` 覆盖图片格式、体积限制、纯图片消息和缓存比例的缺失/零值语义。

`tools/test_dsh_chat_format.cjs` 覆盖 CTAT/PTAT 公式、四类定界符、Markdown、代码字面量、逐字生成前缀和 HTML/链接/宏边界。`tools/test_dsh_chat_format_native.cjs` 只读打开用户报告的同一段 DSH 历史，验证原生公式、排版、亮暗主题、窄窗和刷新恢复，不发送新的模型请求。

接口参考为 DeepSeek 官方 MIT 项目 `deepseek-ai/deepseek-harness` 的 Session Controller、SDK 和 Connection 文档。桥接实现为本项目独立代码，没有复制或捆绑整个 DSH 运行时。
