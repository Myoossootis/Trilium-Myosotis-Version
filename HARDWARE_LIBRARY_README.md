# 硬件知识库首页

原笔记 `e3e7d52e13a9` 保留为子库根入口，绑定 `MyoHardwareUI`。知识库插件启用时，该入口定位到唯一知识库工作区并选中硬件；不再展示第二套专题首页。保留原有标题、正文、笔记 ID、所有子笔记及目录位置，仅切换渲染视图。组件放在正常存储的「系统与插件 / 硬件知识库首页」，保证原生 appCss 能加载。

专题卡片可直接进入章节；章节面包屑使用笔记 ID，支持同名章节。搜索覆盖标题、目录路径及前 220 字正文摘要，不是全文搜索。右侧预览显示经过清理的纯文本。锁定的受保护笔记、代码和图标包不进入索引。刷新按钮重新读取目录与内容；超过一万个节点时提示缩小范围。

收藏和最近打开记录保存在本机 localStorage，不修改正文或笔记属性，也不跨设备同步。继续阅读同时读取原有阅读位置插件的记录。页面直接调用原生 `activateNote`，使用同一标签页。根据原生 `body.dark-theme` 自动调整颜色；顶部仅保留简短统计和继续阅读。目录、搜索与视图按子库分别保存。

安装：`tools/install_hardware_library.py` 的 `install_live(api)` 或 `install(database_path)`。安装前备份；重复安装保留已有关闭状态。便携种子只包含组件，不添加个人知识笔记。

验证：在端口 37841/37842 的独立 Trilium 副本运行 `node tools/test_knowledge_workspace_native.cjs`，验证统一工作区、根入口定位、章节与逐级返回、收藏、搜索和状态恢复、双主题与窄窗口。`node tools/test_trilium_render_recovery.cjs` 检查其他插件渲染与原生入口。

恢复旧首页时，使用 `backups/hardware-library-*/before-library.json` 中的原 type/mime/属性快照，移除本安装新增的 renderNote 和 hideChildrenOverview。原正文仍存储在原笔记，无须还原其他知识页。

共享浏览组件保留于 `customizations/frontend/hardware-library.jsx`，可接收任何现有子库 ID；由构建器嵌入统一界面。停用知识库插件时，原硬件入口仍可独立使用该浏览组件。
