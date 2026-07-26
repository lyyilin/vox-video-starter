# 复制下面这段给你的 Agent

```text
请接管当前 VOX Video Starter 仓库，但先不要制作视频。

第一步，请完整读取：
1. README.md
2. docs/INSTALL.md
3. docs/CONFIGURATION.md
4. skills/vox-video-studio/SKILL.md，以及该 Skill 指示的必要 references

然后按下面顺序执行：

1. 只读检查当前操作系统、Node.js、pnpm、Python、FFmpeg、FFprobe、Git 和剩余磁盘空间。
2. 在不删除、不覆盖用户现有文件的前提下，运行适合当前系统的 setup 脚本；若某个系统级工具缺失，给我准确的安装命令并继续完成所有不依赖它的步骤。
3. 进入 studio，运行 pnpm run doctor、pnpm run lint 和 pnpm test。
4. 检查 studio/.env 是否存在以及所需变量是否已配置，但绝对不要读取、回显或记录任何 API Key 的值。API 未配置时，让我按照 docs/CONFIGURATION.md 自己完成。
5. 检查 Codex 是否具有内置 Imagegen、Worker/Subagent 能力，以及 Remotion best-practices Skill/插件。缺少可选能力时说明影响，不要伪造可用性。
6. 如果 studio/config/content-profile.md 不存在或没有确认记录，使用 $vox-video-studio 的首次配置流程，每轮最多问我三个简短问题，收集我的账号定位、受众、内容领域、证据标准、口播语气、视觉风格、禁区、平台和时长。
7. 把整理后的完整方向写入 studio/config/content-profile.md，展示给我并停下，等待我回复“方向确认”或我指定的确认短语。

在方向确认前，不要研究选题、写最终逐字稿、生成图片、调用 TTS 或渲染视频。

方向确认后，后续每条视频必须遵守：研究与逐字稿 → 分镜确认 → 主任务只生成一张总宫格图 → 每张正式图片由独立 Worker 单独生成 → rembg → 完整逐字稿一次 TTS → Whisper 对齐 → 字幕驱动动画 → 低清确认 → 高清渲染与 QA。

任何密钥都只能保存在被 Git 忽略的 studio/.env 中；不要把密钥写入聊天、代码、JSON、日志或交付物。
```
