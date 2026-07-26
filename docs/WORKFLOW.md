# 制作流程

## 第一次使用

1. Agent 读取 Skill 和项目文档。
2. 运行环境诊断。
3. 每轮最多询问三个问题，采集用户自己的内容方向。
4. 写入 `studio/config/content-profile.md`。
5. 展示完整配置并等待“方向确认”。

没有方向确认，不进入视频生产。

## 每期视频

1. 选题与范围锁定。
2. 研究和事实清单。
3. 最终逐字稿与分镜。
4. 等待“分镜确认”。
5. 创建、验证 `episode.json`。
6. 主任务生成一张总宫格图。
7. 每张正式素材交给一个独立 Worker。
8. `assets:matte` 抠图和 Alpha QA。
9. `audio:build` 整段 TTS、BGM 和 SFX。
10. `timeline:build` Whisper 对齐和 Cue 解析。
11. `render:preview` 生成 960×540 样片和场景关键帧。
12. `qa` 检查字幕、素材、画幅、音轨和响度。
13. 等待“低清确认”。
14. `render:final` 输出 1920×1080 成片。
15. 再次 `qa`，交付视频、联系表、素材、提示词、时间轴和版权信息。

## Skill 与工具调用顺序

| 阶段 | Skill / 能力 | 本地工具或命令 | 产物 |
| --- | --- | --- | --- |
| 首次配置 | `$vox-video-studio` | 文件读写 | `content-profile.md` |
| 研究与脚本 | `$vox-video-studio` + Agent 的检索能力 | 浏览器/网页检索（按选题需要） | 研究账本、逐字稿、分镜 |
| 视觉规划 | `$vox-video-studio` | 内置 Imagegen | 唯一一张总宫格图 |
| 独立素材 | Imagegen + Worker/Subagent | 每个 Worker 一次正式图片调用 | 背景、人物、道具、提示词记录 |
| 抠图 | `$vox-video-studio` | Python 3.10、rembg、Pillow | 带 Alpha 的干净素材 |
| 配音 | `$vox-video-studio` | Seed-TTS 2 适配器、FFmpeg | 整段旁白 `voice.wav` |
| 字幕 | `$vox-video-studio` | whisper.cpp `large-v3-turbo` | `captions.json` 与对齐报告 |
| 动画 | `$vox-video-studio` + 推荐的 Remotion best-practices Skill | React、TypeScript、Remotion | 字幕 Cue 驱动的时间线 |
| 审片 | `$vox-video-studio` | Remotion、FFmpeg、FFprobe | 低清样片、关键帧、QA |
| 交付 | `$vox-video-studio` | Remotion、FFmpeg、FFprobe | 1080p MP4 与版权说明 |

内置 Imagegen 与 Worker/Subagent 属于 Agent 能力，不通过项目里的 OpenAI API 调用。Remotion best-practices Skill 用于约束代码实现；实际预览和渲染由 `studio/package.json` 中的 Remotion 依赖执行。

## 不可改变的顺序

- 逐字稿在配音之前完成；
- 配音在字幕对齐之前完成；
- 字幕时间轴驱动动画；
- 低清确认在高清渲染之前完成；
- `resolved-episode.json` 只能生成，不能手改。
