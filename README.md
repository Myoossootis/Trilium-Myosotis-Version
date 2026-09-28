# Trilium Myosotis Version

这是一个包含 Windows x64 Trilium 0.105.0 程序本体和 Myosotis 修改的便携版仓库。无需另外下载 Trilium：获取仓库后双击根目录的 `run-myosotis-trilium.bat` 即可启动。

## 下载与启动

仓库包含约 509 MB 的程序运行时。程序二进制通过 Git LFS 保存，因此用 Git 获取时先安装 Git LFS 并执行：

```powershell
git lfs install
git clone https://github.com/Myoossootis/Trilium-Myosotis-Version.git
cd Trilium-Myosotis-Version
.\run-myosotis-trilium.bat
```

也可以在 GitHub 网页中下载仓库归档；如果归档中显示为 LFS 指针文件，请使用上面的 Git LFS clone 方式。

首次启动时，根目录启动脚本会把仓库中的 `trilium-seed-data\document.db` 复制到 `trilium-portable\trilium-data`。这个种子数据库只含 Home、ToDo、公式、排版、字数统计和图标包等程序组件，不含个人笔记、附件历史或密码。之后产生的 `trilium-data` 和 `trilium-electron-data` 都是本机运行时目录，未提交到仓库。

## 在另一台机器恢复修改

本仓库包含源代码、图标/字体资源，以及 `customizations-manifest.json`。从种子数据库启动时这些程序组件已经存在；如果要把修改安装到另一份已有数据库，启动 Trilium 后生成 ETAPI token，再运行：

```powershell
$env:TRILIUM_ETAPI_TOKEN = '<你的 ETAPI token>'
python .\tools\apply_customizations.py
```

该安装器只创建或更新程序代码/渲染笔记，不导入用户笔记、附件、历史版本或 Home 数据。笔记文件按计划放入单独的笔记仓库。

电路符号字体已随种子库启用；对已有数据库可用 `install_electronic_symbols_pack.py --db <document.db>` 更新图标包，所有路径均可通过参数覆盖。

## 版本范围

当前内置的是 Windows x64、Trilium 0.105.0 运行时。程序本体及其上游许可证文件随运行时保留；本仓库新增的脚本和样式按仓库许可证/上游 Trilium AGPL 条款使用。
