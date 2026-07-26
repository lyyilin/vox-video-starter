# 安装

## 1. 系统依赖

必须安装：

- Git
- Node.js 20 或更新版本
- pnpm 9 或更新版本
- Python 3.10
- FFmpeg 与 FFprobe，并加入 `PATH`

推荐至少预留 10GB 空间。第一次运行还会下载 npm 包、Whisper 模型、rembg 模型和 Remotion 渲染浏览器。

官方入口：

- [Node.js](https://nodejs.org/en/download)
- [pnpm 安装](https://pnpm.io/installation)
- [FFmpeg 下载](https://ffmpeg.org/download.html)
- [rembg](https://github.com/danielgatis/rembg)
- [Remotion 文档](https://www.remotion.dev/docs/)

## 2. 初始化项目

Windows PowerShell：

```powershell
.\scripts\setup.ps1
```

macOS / Linux：

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

脚本会：

1. 检查系统命令；
2. 安装 `studio` 的 pnpm 依赖；
3. 创建 `studio/.venv`；
4. 安装固定版本的 rembg 与 Seed-TTS 适配器依赖；
5. 从 `.env.example` 创建本地 `.env`，但不会填写密钥；
6. 运行环境诊断。

## 3. 安装 Skill

### Windows

```powershell
.\scripts\install-skill.ps1
```

### macOS / Linux

```bash
chmod +x scripts/install-skill.sh
./scripts/install-skill.sh
```

脚本会把 `skills/vox-video-studio` 复制到用户级 `.agents/skills/`。安装或更新 Skill 后，请新建一个 Agent 任务，让新的上下文加载它。

仓库本身也包含 `.codex-plugin/plugin.json`，可以作为 Codex 本地插件源码使用。普通用户只安装 Skill 即可，不需要修改个人 marketplace 文件。

## 4. 推荐安装 Remotion 插件

在 Codex 的插件界面搜索并安装 Remotion 插件。它为 Agent 提供编写 Remotion 动画时的最佳实践；项目运行本身依赖的是 `studio/package.json` 中固定版本的 Remotion npm 包。

如果没有该插件，已有模板仍可渲染，但不建议让 Agent 大幅修改动画代码。

## 5. 验证

```bash
cd studio
pnpm run doctor
pnpm run lint
pnpm test
```

`doctor` 只报告 API Key 是否已配置，不会打印密钥值。
