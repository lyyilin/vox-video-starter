#!/usr/bin/env python3
"""Volcengine Seed-TTS 2.0 command adapter for paper-collage-video.

The adapter reads the repository's voice asset-request JSON and writes the
requested audio file. It uses Volcengine's V3 unidirectional WebSocket API so
that Seed-TTS 2.0 voice instructions (`context_texts`) are available.

Environment:
    VOLCENGINE_SPEECH_API_KEY  Required.
"""

from __future__ import annotations

import argparse
import asyncio
import gzip
import inspect
import json
import os
import struct
import sys
import uuid
from dataclasses import dataclass
from enum import IntEnum
from pathlib import Path
from typing import Any

import websockets


ENDPOINT = "wss://openspeech.bytedance.com/api/v3/tts/unidirectional/stream"
RESOURCE_ID = "seed-tts-2.0"
DEFAULT_SPEAKER = "zh_male_ruyayichen_uranus_bigtts"
DEFAULT_CONTEXT = (
    "像一位温和、可信、见多识广的内容讲述者。声音沉稳自然，有画面感但不故作深沉；"
    "开头略带悬念，信息解释清晰克制，重点词轻微强调，句间停顿自然，"
    "结尾留一点余味。不要新闻播音腔，不要广告腔，不要夸张表演。"
)

SPEAKER_ALIASES = {
    "ruyayichen": DEFAULT_SPEAKER,
    "儒雅逸辰": DEFAULT_SPEAKER,
    "儒雅逸辰 2.0": DEFAULT_SPEAKER,
    DEFAULT_SPEAKER: DEFAULT_SPEAKER,
}
SUPPORTED_FORMATS = {"mp3", "pcm", "ogg_opus", "wav"}
SUPPORTED_SAMPLE_RATES = {8000, 16000, 22050, 24000, 32000, 44100, 48000}


class MsgType(IntEnum):
    FULL_CLIENT_REQUEST = 0b0001
    AUDIO_ONLY_CLIENT = 0b0010
    FULL_SERVER_RESPONSE = 0b1001
    AUDIO_ONLY_SERVER = 0b1011
    FRONT_END_RESULT_SERVER = 0b1100
    ERROR = 0b1111


class Flag(IntEnum):
    NO_SEQUENCE = 0b0000
    POSITIVE_SEQUENCE = 0b0001
    LAST_NO_SEQUENCE = 0b0010
    NEGATIVE_SEQUENCE = 0b0011
    WITH_EVENT = 0b0100


class Compression(IntEnum):
    NONE = 0b0000
    GZIP = 0b0001


SESSION_FINISHED = 152
SESSION_FAILED = 153


@dataclass
class ServerMessage:
    msg_type: int
    flag: int
    event: int = 0
    sequence: int = 0
    error_code: int = 0
    payload: bytes = b""


def clamp_int(value: Any, low: int, high: int, name: str) -> int:
    try:
        number = int(round(float(value)))
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} 必须是数字") from exc
    if not low <= number <= high:
        raise ValueError(f"{name} 必须在 [{low}, {high}] 范围内")
    return number


def speed_ratio_to_speech_rate(value: Any) -> int:
    """Map 0.5x..2.0x to Volcengine's -50..100 speech_rate."""
    try:
        ratio = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("settings.speedRatio 必须是数字") from exc
    if not 0.5 <= ratio <= 2.0:
        raise ValueError("settings.speedRatio 必须在 [0.5, 2.0] 范围内")
    return round((ratio - 1.0) * 100)


def _context_texts(settings: dict[str, Any]) -> list[str]:
    supplied = settings.get("contextTexts")
    if supplied is not None:
        if not isinstance(supplied, list) or not all(
            isinstance(item, str) and item.strip() for item in supplied
        ):
            raise ValueError("settings.contextTexts 必须是非空字符串数组")
        return [item.strip() for item in supplied]

    performance_prompt = settings.get("performancePrompt")
    if performance_prompt is not None:
        if not isinstance(performance_prompt, str) or not performance_prompt.strip():
            raise ValueError("settings.performancePrompt 必须是非空字符串")
        return [performance_prompt.strip()]

    if settings.get("useDefaultContext", True):
        return [DEFAULT_CONTEXT]
    return []


def build_payload(request: dict[str, Any]) -> dict[str, Any]:
    if request.get("capability") != "voice":
        raise ValueError("request.capability 必须是 voice")

    text = request.get("text")
    if not isinstance(text, str) or not text.strip():
        raise ValueError("request.text 不能为空")

    model = request.get("model")
    if model not in (None, "", RESOURCE_ID):
        raise ValueError(f"本适配器仅支持 request.model={RESOURCE_ID}")

    voice_id = request.get("voiceId") or DEFAULT_SPEAKER
    speaker = SPEAKER_ALIASES.get(voice_id, voice_id)
    if not isinstance(speaker, str) or not speaker.strip():
        raise ValueError("request.voiceId 必须是非空字符串")

    settings = request.get("settings") or {}
    if not isinstance(settings, dict):
        raise ValueError("request.settings 必须是对象")

    audio_format = settings.get("format", "mp3")
    if audio_format not in SUPPORTED_FORMATS:
        raise ValueError(
            f"settings.format 必须是以下值之一：{', '.join(sorted(SUPPORTED_FORMATS))}"
        )

    sample_rate = clamp_int(
        settings.get("sampleRate", 24000), 8000, 48000, "settings.sampleRate"
    )
    if sample_rate not in SUPPORTED_SAMPLE_RATES:
        allowed = ", ".join(str(rate) for rate in sorted(SUPPORTED_SAMPLE_RATES))
        raise ValueError(f"settings.sampleRate 可选值：{allowed}")

    audio_params: dict[str, Any] = {
        "format": audio_format,
        "sample_rate": sample_rate,
    }

    if "speechRate" in settings:
        audio_params["speech_rate"] = clamp_int(
            settings["speechRate"], -50, 100, "settings.speechRate"
        )
    elif "speedRatio" in settings:
        audio_params["speech_rate"] = speed_ratio_to_speech_rate(
            settings["speedRatio"]
        )

    if "loudnessRate" in settings:
        audio_params["loudness_rate"] = clamp_int(
            settings["loudnessRate"], -50, 100, "settings.loudnessRate"
        )

    if "bitRate" in settings:
        if audio_format != "mp3":
            raise ValueError("settings.bitRate 仅适用于 mp3")
        audio_params["bit_rate"] = clamp_int(
            settings["bitRate"], 64000, 160000, "settings.bitRate"
        )

    if "enableSubtitle" in settings:
        if not isinstance(settings["enableSubtitle"], bool):
            raise ValueError("settings.enableSubtitle 必须是布尔值")
        audio_params["enable_subtitle"] = settings["enableSubtitle"]

    req_params: dict[str, Any] = {
        "speaker": speaker,
        "text": text.strip(),
        "audio_params": audio_params,
    }

    contexts = _context_texts(settings)
    if contexts:
        req_params["context_texts"] = contexts

    if "pitch" in settings:
        req_params["post_process"] = {
            "pitch": clamp_int(settings["pitch"], -12, 12, "settings.pitch")
        }

    if settings.get("sectionId"):
        req_params["section_id"] = str(settings["sectionId"])

    return {"req_params": req_params}


def encode_client_request(payload: dict[str, Any]) -> bytes:
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode(
        "utf-8"
    )
    # Version 1, 4-byte header; FullClientRequest, no sequence; JSON, no compression.
    header = bytes((0x11, 0x10, 0x10, 0x00))
    return header + struct.pack(">I", len(body)) + body


def _read_u32(data: bytes, offset: int) -> tuple[int, int]:
    if offset + 4 > len(data):
        raise ValueError("服务端消息不完整")
    return struct.unpack_from(">I", data, offset)[0], offset + 4


def _read_i32(data: bytes, offset: int) -> tuple[int, int]:
    if offset + 4 > len(data):
        raise ValueError("服务端消息不完整")
    return struct.unpack_from(">i", data, offset)[0], offset + 4


def _skip_string(data: bytes, offset: int) -> int:
    size, offset = _read_u32(data, offset)
    end = offset + size
    if end > len(data):
        raise ValueError("服务端字符串字段不完整")
    return end


def decode_server_message(data: bytes) -> ServerMessage:
    if len(data) < 4:
        raise ValueError("服务端消息短于 4 字节")

    version = data[0] >> 4
    header_words = data[0] & 0x0F
    if version != 1 or header_words < 1:
        raise ValueError(f"不支持的协议头：version={version}, words={header_words}")

    msg_type = data[1] >> 4
    flag = data[1] & 0x0F
    compression = data[2] & 0x0F
    offset = header_words * 4
    if offset > len(data):
        raise ValueError("服务端协议头长度无效")

    message = ServerMessage(msg_type=msg_type, flag=flag)

    if msg_type in {
        MsgType.FULL_CLIENT_REQUEST,
        MsgType.FULL_SERVER_RESPONSE,
        MsgType.FRONT_END_RESULT_SERVER,
        MsgType.AUDIO_ONLY_CLIENT,
        MsgType.AUDIO_ONLY_SERVER,
    } and flag in {Flag.POSITIVE_SEQUENCE, Flag.NEGATIVE_SEQUENCE}:
        message.sequence, offset = _read_i32(data, offset)
    elif msg_type == MsgType.ERROR:
        message.error_code, offset = _read_u32(data, offset)

    if flag == Flag.WITH_EVENT:
        message.event, offset = _read_i32(data, offset)
        if message.event not in {1, 2, 50, 51, 52}:
            offset = _skip_string(data, offset)  # session_id
        if message.event in {50, 51, 52}:
            offset = _skip_string(data, offset)  # connect_id

    payload_size, offset = _read_u32(data, offset)
    end = offset + payload_size
    if end > len(data):
        raise ValueError("服务端 payload 不完整")
    payload = data[offset:end]
    if compression == Compression.GZIP and payload:
        payload = gzip.decompress(payload)
    elif compression not in {Compression.NONE, Compression.GZIP}:
        raise ValueError(f"不支持的压缩类型：{compression}")
    message.payload = payload
    return message


def _payload_text(message: ServerMessage) -> str:
    return message.payload.decode("utf-8", errors="replace").strip()


async def synthesize(
    payload: dict[str, Any], api_key: str
) -> tuple[bytes, str, list[dict[str, Any]]]:
    connect_id = str(uuid.uuid4())
    headers = {
        "X-Api-Key": api_key,
        "X-Api-Resource-Id": RESOURCE_ID,
        "X-Api-Connect-Id": connect_id,
        "X-Control-Require-Usage-Tokens-Return": "*",
    }

    kwargs: dict[str, Any] = {
        "max_size": 16 * 1024 * 1024,
        "open_timeout": 20,
        "close_timeout": 10,
    }
    header_parameter = (
        "additional_headers"
        if "additional_headers" in inspect.signature(websockets.connect).parameters
        else "extra_headers"
    )
    kwargs[header_parameter] = headers

    chunks: list[bytes] = []
    metadata: list[dict[str, Any]] = []
    log_id = ""

    async with websockets.connect(ENDPOINT, **kwargs) as websocket:
        response = getattr(websocket, "response", None)
        response_headers = getattr(response, "headers", None)
        if response_headers is None:
            response_headers = getattr(websocket, "response_headers", None)
        if response_headers:
            log_id = response_headers.get("X-Tt-Logid", "")

        await websocket.send(encode_client_request(payload))

        while True:
            raw = await websocket.recv()
            if isinstance(raw, str):
                raise RuntimeError(f"收到意外的文本帧：{raw[:300]}")

            message = decode_server_message(raw)
            if message.msg_type == MsgType.ERROR:
                detail = _payload_text(message)
                raise RuntimeError(
                    f"火山引擎返回错误 code={message.error_code}: {detail}"
                )

            if message.msg_type == MsgType.AUDIO_ONLY_SERVER and message.payload:
                chunks.append(message.payload)

            if message.msg_type in {
                MsgType.FULL_SERVER_RESPONSE,
                MsgType.FRONT_END_RESULT_SERVER,
            } and message.payload:
                try:
                    metadata.append(json.loads(_payload_text(message)))
                except json.JSONDecodeError:
                    metadata.append({"raw": _payload_text(message)})

            if message.event == SESSION_FAILED:
                raise RuntimeError(
                    f"语音合成会话失败：{_payload_text(message) or '无详细信息'}"
                )
            if message.event == SESSION_FINISHED:
                break
            if (
                message.msg_type == MsgType.AUDIO_ONLY_SERVER
                and message.flag in {Flag.LAST_NO_SEQUENCE, Flag.NEGATIVE_SEQUENCE}
            ):
                break

    audio = b"".join(chunks)
    if not audio:
        raise RuntimeError("服务端未返回音频数据")
    return audio, log_id or connect_id, metadata


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate Seed-TTS 2.0 audio from a voice asset request."
    )
    parser.add_argument("--request", required=True, help="Path to request JSON")
    parser.add_argument("--output", required=True, help="Audio output path")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and print the API payload without making a paid request",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    request_path = Path(args.request).resolve()
    output_path = Path(args.output).resolve()

    try:
        request = json.loads(request_path.read_text(encoding="utf-8-sig"))
        payload = build_payload(request)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"Seed-TTS 2.0 请求无效：{exc}", file=sys.stderr)
        return 2

    if args.dry_run:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0

    api_key = os.environ.get("VOLCENGINE_SPEECH_API_KEY", "").strip()
    if not api_key:
        print(
            "缺少环境变量 VOLCENGINE_SPEECH_API_KEY；请勿把 API Key 写入请求文件。",
            file=sys.stderr,
        )
        return 2

    output_path.parent.mkdir(parents=True, exist_ok=True)
    partial_path = output_path.with_name(f"{output_path.name}.part")

    try:
        audio, request_id, _metadata = asyncio.run(synthesize(payload, api_key))
        partial_path.write_bytes(audio)
        partial_path.replace(output_path)
    except (OSError, RuntimeError, ValueError, websockets.WebSocketException) as exc:
        try:
            partial_path.unlink(missing_ok=True)
        except OSError:
            pass
        print(f"Seed-TTS 2.0 合成失败：{exc}", file=sys.stderr)
        return 1

    text_length = len(payload["req_params"]["text"])
    print(
        f"Seed-TTS 2.0 输出完成：{output_path} "
        f"({len(audio)} bytes, {text_length} chars, request={request_id})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
