# 排错

## `pnpm run doctor` 报缺少命令

重新打开终端，确认 Node、pnpm、FFmpeg 和 Python 已加入 `PATH`。Windows 可以运行：

```powershell
Get-Command node,pnpm,python,ffmpeg,ffprobe
```

## Python 环境不存在

在仓库根目录重新运行对应的 `setup` 脚本。不要使用全局 rembg 覆盖项目固定环境。

## rembg 模型下载失败

检查网络和磁盘空间后重试：

```bash
cd studio
pnpm run assets:matte -- --episode <slug> --resume
```

主模型无法启动时脚本会退回 `u2net`。

## Seed-TTS 2 返回 401/403

检查：

- `.env` 是否位于 `studio/.env`；
- Key 是否属于已开通 Seed-TTS 2 的项目；
- 账户是否有额度或计费方式；
- `voiceId` 是否属于可用音色。

不要把 Key 粘贴进聊天来排错。

## Whisper 对齐超过 10%

查看本期的 `alignment-report.json` 和 `alignment-manual.json`。优先检查配音是否完整、逐字稿是否与配音一致、是否存在读错或漏读。不要绕过阻断直接渲染高清。

## Remotion 渲染占满系统盘

把 `TEMP`、`TMP` 和 `TMPDIR` 指向空间充足的项目临时目录后再渲染。不要删除其他项目的缓存或用户文件。

## 字幕或路线遮挡人物

调整 `episode.json` 中 annotation 的归一化位置或 route 点位，确保路线位于人物图层以下、标签位于边缘安全区，然后重新运行 `timeline:build` 和低清渲染。
