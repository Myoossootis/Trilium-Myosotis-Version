# 本地插件市场

已支持将零散组件整理为 13 个功能包，使用明确的组件归属、后台调用边界和可恢复的主题开关。管理器本身保留为系统入口。安装与验证见 [功能插件整理](PLUGIN_PACKAGES_README.md)。

“系统与插件”通过左侧栏的工具箱入口打开，位于 Home 上方。市场页面及程序组件保留在正常存储区，以确保原生启动脚本和 appCss 搜索能发现它们。`cssClass=myo-system-components` 配合仅针对笔记树行的 CSS 隐藏原入口。原有内容、属性与孩子笔记保持，原始页面内容另存于安装备份。市场不包含第三方插件自动下载/更新；“开源资源”链接用于浏览社区源码。

支持已安装、已启用、已关闭视图，名称/说明搜索，分类筛选，组件入口与更新时间。卡片更新时间取代码笔记的最新 utcDateModified，排除 JSON 配置和任务/库存等业务数据；不表示远端发行时间。开关修改原生加载属性，重启 Trilium 后生效。

关闭时将 run/widget/appCss/iconPack 等加载标签及 renderNote/script/事件绑定关系改为 myoDisabled_ 前缀，保存原值、位置、继承属性；开启恢复原名。入站绑定也一起处理，覆盖包外页面、启动栏和事件入口。任务、库存、配置文件内容均不删除。市场本身受保护；主题使用 Trilium 设置切换；没有自动入口的组件为手动组件。启动脚本可能在当前窗口继续运行到重启。

已存在的关闭状态在番茄钟/人升的程序更新工具及通用在线安装器中保留。市场配置保存在 MyoMarketData，包含目录和最近 100 次状态切换日志。安装器可重复运行更新目录，沿用已有日志和版本号，不重置开关。

源码参考：[Trilium Addon Manager](https://github.com/Trilium-Community/trilium-scripts/tree/main/addons/trilium-addon-manager%40beatlink)、[Logseq Marketplace](https://github.com/logseq/marketplace) 和 [Awesome Trilium](https://github.com/Nriver/awesome-trilium)。实现独立编写，没有复制这些项目的代码。

在线安装：设置 TRILIUM_ETAPI_TOKEN 后运行 python tools/install_plugin_market.py --live。离线安装：退出 Trilium 后运行 python tools/install_plugin_market.py --db 数据库路径。安装前自动备份。

安装器同时调用 `tools/install_market_sidebar.py`，创建原生 note launcher，确保程序根笔记位于正常根目录；通过样式隐藏导航树行，保留页面 ID 和全部程序。不要把程序根笔记移到 `_hidden` 下，原生脚本和样式搜索会忽略该区域。重新加载 Trilium 后可见侧栏入口。

真实集成验证：`node tools/test_trilium_render_recovery.cjs` 连接隔离测试实例的 37842 调试端口，验证四个实际渲染页面、主题切换、树行隐藏与根目录新建。
