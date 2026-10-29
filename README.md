# Trilium Myosotis Version

Windows x64 整合版，基于 Trilium 0.105.0，包含现有全部 14 个功能插件和独立插件管理器。默认纸墨暖色主题，知识库、工作台、笔记增强与 DeepSeek 侧栏已整合。

## 下载与启动

在 [Releases](https://github.com/Myoossootis/Trilium-Myosotis-Version/releases/latest) 下载名称含 `windows-x64.zip` 的整合包，完整解压到可写目录，双击 `run-myosotis-trilium.bat`。**无需安装 Node、Python、Git 或另外下载 Trilium。**

首次启动会建立独立数据库身份，并把初始库复制到 `trilium-portable/trilium-data/document.db`；已有数据库不会被覆盖。笔记、界面缓存与同步配置都保存在本机。更新整合包时先备份自己的数据目录，保留该目录后替换程序文件。

初始库包含可直接运行的插件、原创演示笔记和一道示例题，不包含作者的个人笔记、导入题库、聊天记录、API key 或登录凭据。整合包为预装插件启用后端脚本，原生安全设置中可以调整。

## 内置功能

| 分类 | 插件 |
| --- | --- |
| 工作空间 | 工作台、知识库与 Wiki、任务管理、界面小工具 |
| 笔记与阅读 | 笔记增强、DeepSeek 助手、拓展视图 |
| 专注与学习 | 人升、番茄钟、通用刷题 |
| 主题与资源 | 外观与主题、图标资源 |
| 数据工具 | 资料导入工具、GitHub 数据库同步 |

左下角「插件」中可逐个关闭、开启与打开功能；关闭插件保留其数据。外观设置提供主题预览卡片和可开关的笔记排版风格。

知识库统一在一个工作区切换硬件/学术子库，支持正文搜索、命中片段、打开对应位置、右键菜单及返回上一级。刷题练习可与原生右侧 DeepSeek 面板并排使用。

## GitHub 笔记备份

双击 `login-github.bat` 完成自己的 GitHub 登录，再打开「插件 → GitHub 数据库同步」。填写自己的私有仓库与数据库位置，手动检查增删改和原文差异，确认后上传或恢复。可开启启动检查，覆盖始终需要确认。完整说明见 [GITHUB_SYNC_PLUGIN_README.md](GITHUB_SYNC_PLUGIN_README.md)。

## DeepSeek

图标采用官方鲸鱼 SVG。聊天依赖用户自行安装并配置的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)，聊天历史、模型和 API key 由自己的 Harness 管理。先启动 Harness 一次，再运行 `setup-deepseek.bat`，重启 Harness 后打开右侧 DeepSeek 按钮。没有配置模型时，其他笔记插件仍可使用。

整合包不附带 Harness 账户或 API 额度。桥接按协议检查本机 Harness 的会话接口；上游接口变化时会提示兼容错误，需要更新桥接。详见 [DSH_CHAT_PLUGIN_README.md](DSH_CHAT_PLUGIN_README.md)。

## 源码与许可

本仓库同时提供插件源代码、可编辑的初始数据库和 Windows 运行时。通过 Git 获取完整运行时时需要 Git LFS；GitHub 的普通源码 ZIP 可能包含 LFS 指针，请优先下载 Releases 整合包。

```powershell
git lfs install
git clone https://github.com/Myoossootis/Trilium-Myosotis-Version.git
```

上游 Trilium 使用 AGPL-3.0-only。对应源代码、运行时补丁、构建方式与第三方许可证见 [SOURCE_INFO.md](SOURCE_INFO.md)、[LICENSE](LICENSE) 和 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
