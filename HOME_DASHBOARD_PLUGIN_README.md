# Trilium Home Dashboard

一个用于 Trilium Notes 0.105+ 的 Home 仪表盘：通过左侧 Launch Bar 的独立 Home 图标打开，在主编辑区全页渲染。

## 文件

- `trilium-home-dashboard.js`：创建为 **代码笔记**，MIME 类型为 `text/jsx`。
- `trilium-home-dashboard.css`：创建为 **代码笔记**，MIME 类型为 `text/css`，并添加 `#appCss` 标签。

## 安装结构

1. 新建一个类型为「渲染 HTML 笔记」的笔记，标题设为 `Home`。
2. 给它添加关系 `~renderNote`，指向 JSX 脚本笔记。
3. 在「菜单 → 配置启动栏」中新建「笔记启动器」：标题 `Home`，图标类 `bx bx-home-heart`，目标选择上述渲染笔记；将它移到可见启动器，即显示在左侧竖栏。
4. 在 JSX 脚本笔记上配置可选标签：
   - `#homeGreetingName=你的名字`
   - `#homeCountdownTitle=年度目标`
   - `#homeCountdownDate=2026-12-31`

不要为 JSX 脚本添加 `#widget`：该标签会把它注册成右侧栏组件，而本项目使用的是主编辑区的渲染笔记。

## 数据与兼容性

仪表盘全部通过 Trilium 前端 API 读取本地笔记；不会上传笔记内容。任务统计使用 `#todoItem` 或 `#todo` 标签；贡献格按笔记修改日期统计。
