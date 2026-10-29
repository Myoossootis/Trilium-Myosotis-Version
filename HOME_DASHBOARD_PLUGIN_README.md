# Trilium Home Pages 工作台

基于 Trilium 0.105 的模块化首页。原 Home 和工作台合并为一个“工作台”入口，保留原工作台资料的笔记 ID、正文和全部子笔记。

视觉、12 列网格和指针拖拽参考 Home Pages 0.3.1：
https://peyote.info/plugins/home-pages/
https://github.com/jepicaju862-lab/home-pages

## 使用

- 顶部“编辑布局”进入编排模式，拖动卡片标题排序。
- 右下角拖动手柄调整宽高；宽度按 12 列吸附，高度按 40px 行吸附。窄面板自动单列，缩放只改变高度。
- 缩放手柄支持方向键，Esc 取消当前拖拽或缩放；底部按钮也可前移、后移、调整尺寸、复制和移除。
- “添加组件”打开组件库，“完成”保存到数据库，“取消”恢复进入编辑前的布局。
- “自动整理”将长卡片并排、短卡片上下组合，统一每组的上下边缘；只排列现有组件，保留标题和配置。首次升级会整理当前页一次，之后不会覆盖手动保存的尺寸和顺序。
- 移除组件或页面只删除布局，不删除任何原始笔记。
- 页面“+”新建独立看板，右键标签可重命名或移除页面。布局设置支持 JSON 导入、导出；导入预览后点击“完成”才写入数据库。

## 数据与组件

包含欢迎横幅、待办与日程、原工作台资料、番茄钟、库统计、最近笔记、快捷入口、倒计时、每日一言、贡献图、日历、快速记录及笔记文字预览。

- ToDo 使用原有状态分组和普通任务笔记，勾选完成会移动任务的状态分支。
- 番茄钟连接原 `MyoPomodoro` 服务，切换笔记或离开首页后仍继续计时，不启动第二个计时器。
- 快速记录保存在原“待整理资料”下，文字按普通文本转义，不执行 HTML。
- 字数沿用原有统计范围，仅计入学术和硬件两份知识库；贡献图沿用实际字数改动数据。
- 月历仅供浏览日期，不自动创建日记。
- 布局与配置存于 `HmHomeData01`（首页布局数据），使用版本校验避免另一窗口的新布局被覆盖。统计缓存不替代数据库布局。
- 无网络资源或第三方账号依赖。没有接入的 Obsidian 专属插件组件不显示为可用组件。

## 文件与安装

- `trilium-home-dashboard.js`：Preact / JSX 渲染脚本。
- `trilium-home-dashboard.css`：随原生主题变化的首页样式。
- `trilium-home-layout.js`：从 Home Pages 的 GPL-3.0 指针排序源码转译的布局辅助脚本。
- `trilium-home-service.js`：布局校验、冲突检查、保存与快速记录后端服务。
- `tools/install_home_pages.py`：对现有数据库通过 ETAPI 安装，先创建 SQLite 在线备份，再更新程序组件。

```powershell
python tools/install_home_pages.py --token-file "<ETAPI token 文本文件>" --merge-workbench
```

`--merge-workbench` 把原工作台资料文件夹挂到首页下，再解除旧根分支，并将原 Home 标题改为“工作台”；这不会删除原文件夹或其子笔记。

新数据库的程序组件可通过 `customizations-manifest.json` 安装，布局数据标有 `preserveContent`，重装不会覆盖已经保存的布局。

## 验证

`tools/test_home_pages.cjs` 只连接隔离测试实例的 ETAPI 37841 和 Electron 调试端口 37842，覆盖真实指针拖拽、缩放/Esc、组件增删、数据库保存与重载、任务完成、快速记录、计时器生命周期、多页面、并发冲突和亮暗/窄屏布局。绝不在主实例中创建测试任务或记录。

`tools/test_home_pages_tidy.cjs` 针对移除工作台资料卡片后的十组件快照，检查自动整理、实际卡片边缘对齐、手动尺寸保留、取消与保存、亮暗主题和窄屏；同时枚举全部 1,024 种组件子集，检查整理不遗漏组件、不修改输入且重复执行结果一致。

上游出处、版本和完整 GPL-3.0 文本见 `THIRD_PARTY_NOTICES.md` 与 `customizations/licenses/home-pages-GPL-3.0.txt`。
