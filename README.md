# VOX Video Starter

一个可以交给 Codex/Agent 使用的开源 VOX 纸片拼贴视频流水线。

它不会自带任何账号定位。第一次使用时，Agent 会先询问你的内容方向、受众、口播语气、证据标准、视觉风格和禁区，生成你自己的 `content-profile.md`，等待你确认后才进入视频制作。

## 它能完成什么

完整流程：

```text
内容方向采集 → 方向确认 → 选题与研究 → 逐字稿 → 分镜确认
→ 总宫格图 → 独立素材生成 → rembg 抠图 → 整段 TTS 配音
→ Whisper 字幕对齐 → 字幕驱动 Remotion 动画 → 低清确认
→ 1080p 成片 → QA 与交付
```

核心特点：

- 用户先建立自己的内容方向，不携带作者的私有账号圣经；
- 主任务只生成一张总宫格图，每张正式素材交给独立 Worker；
- Seed-TTS 2 使用完整逐字稿一次合成，不按场景拆开；
- 所有动画、镜头、标签和音效由字幕 Cue 驱动；
- 分镜与低清样片各有一次强制人工确认；
- 交付 1920×1080、30fps、H.264/AAC 成片与完整 QA。

## 快速开始

1. 安装 Git、Node.js 20+、pnpm 9+、Python 3.10、FFmpeg/FFprobe。
2. 克隆仓库，并按 [安装说明](docs/INSTALL.md) 安装 Skill 与依赖。
3. 按 [配置说明](docs/CONFIGURATION.md) 在本地配置 TTS；不要把 API Key 发给 Agent 或提交到 Git。
4. 把 [Agent 启动提示词](AGENT_BOOTSTRAP_PROMPT.md) 复制给你的 Agent。
5. Agent 完成环境检查后，会先向你收集内容方向并等待“方向确认”。

准备推送自己的 GitHub 仓库时，请再看 [GitHub 发布清单](docs/PUBLISH_TO_GITHUB.md)。

Windows：

```powershell
.\scripts\setup.ps1
```

macOS / Linux：

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

环境检查：

```bash
cd studio
pnpm run doctor
```

## 推荐的 Codex 能力

- 内置 Imagegen：生成宫格图、背景、人物和道具；项目脚本不调用 OpenAI 图片 API。
- Worker/Subagent：执行一张素材一个任务的调度协议。
- Remotion 插件：推荐安装，用于 Agent 编写或调整 Remotion 动画；本地渲染仍由项目 npm 依赖完成。

## 目录

```text
.codex-plugin/              Codex 插件清单
skills/vox-video-studio/    可安装的通用 Skill
studio/                     Remotion、字幕、TTS、抠图和 QA 工程
docs/                       安装、配置、流程和排错文档
scripts/                    Windows/macOS/Linux 初始化脚本
AGENT_BOOTSTRAP_PROMPT.md   可直接复制给 Agent 的启动指令
```

## 常用命令

在 `studio/` 中运行：

```bash
pnpm run episode:new -- --id my-first-episode
pnpm run assets:matte -- --episode my-first-episode
pnpm run audio:build -- --episode my-first-episode
pnpm run timeline:build -- --episode my-first-episode
pnpm run render:preview -- --episode my-first-episode
pnpm run qa -- --episode my-first-episode
pnpm run render:final -- --episode my-first-episode
pnpm run qa -- --episode my-first-episode
```

## 许可与第三方组件

项目代码采用 MIT License。Remotion 有自己的许可条款，商业使用前请阅读 [Remotion License](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md)。第三方组件和默认 BGM 说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
