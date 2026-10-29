# Codex 浅色与暗色

保留原有 `codex-ui` 浅色主题，新增 `codex-ui-dark`，以 Trilium 原生 `next-dark` 为基础。暗色版本包含侧栏、标签栏、正文编辑器、菜单和现有插件页面的配色。

独立插件「Codex 日夜切换」在左侧栏底部、设置附近放置太阳/月亮滑块。滑块使用原生 launcher 随侧边栏一起显示，CSS 跟随原生样式加载；不再依赖 `frontendStartup` 创建按钮。首次安装后重新加载 Trilium；点击时才执行切换脚本，保存原生 `theme` 设置。也可以在外观设置中选择「Codex 暗色」。插件市场可关闭快捷按钮，两个主题仍可通过原生设置选择。

视觉参考：[Xiumuzaidiao/Day-night-toggle-button](https://github.com/Xiumuzaidiao/Day-night-toggle-button)。动画用独立、限定作用域的 CSS 绘制，没有引入示例的全局样式或页面背景。支持键盘操作与减少动态效果偏好。

切换器从运行中的 Trilium 入口发现带哈希的原生 options/theme 模块，调用原生保存和样式加载逻辑，保持主题事件、编辑器和窗口颜色同步。界面变化由原生样式加载成功后确认；保存失败或加载失败会恢复原有设置。原生模块接口变更时会显示错误提示。

源码：`trilium-codex-dark.css`、`customizations/frontend/codex-theme-toggle.js`、`customizations/frontend/codex-theme-toggle.css`。

安装：`tools/install_codex_theme.py` 提供 `install_live(api)` 和 `install(database_path)`；写入前备份，同步插件市场清单，保留已有插件关闭状态及个人委托数据。

实际桌面验证：在独立测试副本运行 `node tools/test_home_theme_sync.cjs`，检查滑块出现时机、样式就绪、按需加载和 Home 同步；`node tools/test_trilium_render_recovery.cjs` 检查插件页面及原生入口。

浏览器验证：`node tools/test_commission_ui_browser.cjs --codex-dark` 使用当前 Trilium 原生主题加载器，验证真实样式切换、保存选择、连续点击、保存失败、外部主题变化以及窄屏布局。
