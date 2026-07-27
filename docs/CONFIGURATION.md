# 配置

## Imagegen

图片使用 Codex 内置 Imagegen 工具生成，不需要在项目中配置 `OPENAI_API_KEY`。如果你的 Agent 没有内置 Imagegen，正式素材生成阶段无法按本流程执行。

主任务只生成一张总宫格图。每张正式背景、人物和道具都由独立 Worker 单独生成。

## Seed-TTS 2

默认配音使用火山引擎 Seed-TTS 2，完整逐字稿只发送一次。

如果还没有音色 ID 或 API Key，请先查看 [Seed-TTS 2 图文配置教程](SEED_TTS2_SETUP.md)。

1. 在火山引擎语音控制台开通语音合成，并创建 API Key。
2. 把 `studio/.env.example` 复制为 `studio/.env`。
3. 只在本地填写：

```dotenv
VOLCENGINE_SPEECH_API_KEY=<YOUR_API_KEY>
```

不要把 `.env` 提交到 Git。仅在你信任的本地 Codex 任务中提供密钥，并要求 Agent 直接写入 `.env`，不得回显、记录或提交密钥。

在每期 `episode.json` 中配置：

```json
{
  "voice": {
    "provider": "seed-tts2",
    "seedTts2": {
      "apiKeyEnv": "VOLCENGINE_SPEECH_API_KEY",
      "model": "seed-tts-2.0",
      "voiceId": "替换为你有权使用的音色 ID",
      "settings": {
        "speedRatio": 0.94,
        "pitch": -1,
        "performancePrompt": "描述希望旁白如何表达"
      }
    }
  }
}
```

官方入口：

- [火山引擎语音控制台](https://console.volcengine.com/speech/new/experience/tts?projectName=default)
- [API Key 管理](https://console.volcengine.com/speech/new/setting/apikeys?projectName=default)
- [Seed-TTS 2 音色列表](https://docs.volcengine.com/docs/6561/1257544?lang=zh)
- [V3 单向 WebSocket](https://docs.volcengine.com/docs/6561/2534913?lang=zh)
- [语音指令](https://docs.volcengine.com/docs/6561/1871062?lang=zh)

`scripts/local/volcengine_tts_adapter.py` 使用环境变量读取密钥，不把密钥写入请求 JSON 或日志。

## GPT-SoVITS（可选旧分支）

如果你已有本地 GPT-SoVITS API，可以在 `episode.json` 中显式选择 `gpt-sovits`，并在 `.env` 中设置：

```dotenv
GPT_SOVITS_URL=http://127.0.0.1:9880
```

该分支不会自动替换 Seed-TTS 2。必须由用户明确选择，并确保本地 `/health` 和 `/tts` 接口与项目兼容。

## rembg

安装脚本创建 Python 3.10 环境并固定：

```text
rembg==2.0.69
onnxruntime==1.21.0
pillow==11.1.0
numpy==2.2.3
```

首次抠图会尝试下载 `birefnet-general` 模型；无法启动时自动退回 `u2net`。模型不提交到 Git。

## Whisper

`pnpm run timeline:build` 会通过 `@remotion/install-whisper-cpp` 下载 whisper.cpp 和 `large-v3-turbo` 模型，并在本地生成中文字幕时间戳。无需额外 API Key。

## BGM 与音效

默认模板使用 CC BY 4.0 曲目 “Ripples”；当对应 `audio/bgm.mp3` 不存在且本期仍保留默认曲目信息时，项目会自动下载它并生成 `credits.md`。如果你修改了 BGM 信息，必须自行把拥有合法使用权的文件放到该路径；脚本不会用默认音乐冒充你的自定义曲目。

音效由 FFmpeg 程序化生成，不依赖额外音效网站。
