from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageChops, ImageFilter
from rembg import new_session, remove


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Matte VOX collage cutouts with rembg and add a paper edge."
    )
    parser.add_argument("--episode", required=True)
    parser.add_argument("--model", default="birefnet-general")
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Reuse already-valid RGBA outputs and process only missing assets.",
    )
    return parser.parse_args()


def load_episode(root: Path, episode_id: str) -> tuple[dict[str, Any], Path]:
    episode_dir = root / "public" / "episodes" / episode_id
    episode_file = episode_dir / "episode.json"
    if not episode_file.exists():
        raise FileNotFoundError(f"Episode not found: {episode_file}")
    return json.loads(episode_file.read_text(encoding="utf-8")), episode_dir


def make_session(primary: str):
    try:
        print(f"Loading rembg model: {primary}")
        return new_session(primary), primary
    except Exception as exc:
        print(f"Primary model failed ({exc}). Falling back to u2net.", file=sys.stderr)
        return new_session("u2net"), "u2net"


def despill_green(image: Image.Image) -> tuple[Image.Image, float, float]:
    rgba = np.asarray(image.convert("RGBA")).copy()
    rgb = rgba[..., :3].astype(np.float32)
    alpha = rgba[..., 3]
    edge = (alpha > 8) & (alpha < 250)
    green_dominant = edge & (rgb[..., 1] > rgb[..., 0] * 1.12) & (
        rgb[..., 1] > rgb[..., 2] * 1.12
    )
    edge_pixels = max(1, int(edge.sum()))
    fringe_ratio = float(green_dominant.sum() / edge_pixels)
    neutral_green = np.maximum(rgb[..., 0], rgb[..., 2]) * 0.94
    rgb[..., 1] = np.where(green_dominant, neutral_green, rgb[..., 1])
    rgba[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    output_rgb = rgba[..., :3].astype(np.float32)
    residual_green = edge & (output_rgb[..., 1] > output_rgb[..., 0] * 1.12) & (
        output_rgb[..., 1] > output_rgb[..., 2] * 1.12
    )
    residual_ratio = float(residual_green.sum() / edge_pixels)
    return Image.fromarray(rgba, "RGBA"), fringe_ratio, residual_ratio


def refine_chroma_alpha(
    source: Image.Image, cutout: Image.Image, restore_thin_lines: bool = False
) -> Image.Image:
    source_rgba = np.asarray(source.convert("RGBA")).copy()
    rgb = source_rgba[..., :3].astype(np.float32)
    border = np.concatenate(
        [rgb[:6, :, :].reshape(-1, 3), rgb[-6:, :, :].reshape(-1, 3),
         rgb[:, :6, :].reshape(-1, 3), rgb[:, -6:, :].reshape(-1, 3)],
        axis=0,
    )
    key_color = np.median(border, axis=0)
    distance = np.linalg.norm(rgb - key_color, axis=2)
    key_alpha = np.clip((distance - 8.0) / (70.0 - 8.0), 0.0, 1.0) * 255.0

    result = np.asarray(cutout.convert("RGBA")).copy()
    rembg_alpha = result[..., 3].astype(np.float32)
    if restore_thin_lines:
        result = source_rgba.copy()
        key_alpha[:16, :] = 0
        key_alpha[-16:, :] = 0
        key_alpha[:, :16] = 0
        key_alpha[:, -16:] = 0
        combined_alpha = key_alpha
    else:
        combined_alpha = np.minimum(rembg_alpha, key_alpha)
    result[..., 3] = combined_alpha.astype(np.uint8)
    return Image.fromarray(result, "RGBA")


def crop_and_outline(image: Image.Image) -> tuple[Image.Image, dict[str, float]]:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    bbox = alpha.point(lambda value: 255 if value > 8 else 0).getbbox()
    if bbox is None:
        raise ValueError("No foreground detected.")

    left, top, right, bottom = bbox
    subject_width = right - left
    subject_height = bottom - top
    crop_pad = max(20, round(max(subject_width, subject_height) * 0.035))
    left = max(0, left - crop_pad)
    top = max(0, top - crop_pad)
    right = min(rgba.width, right + crop_pad)
    bottom = min(rgba.height, bottom + crop_pad)
    cropped = rgba.crop((left, top, right, bottom))

    outline_radius = max(5, int(max(cropped.size) * 0.012))
    if outline_radius % 2 == 0:
        outline_radius += 1
    outline_alpha = cropped.getchannel("A").filter(ImageFilter.MaxFilter(outline_radius))
    outline_alpha = ImageChops.subtract(outline_alpha, cropped.getchannel("A"))
    paper = Image.new("RGBA", cropped.size, (239, 225, 195, 0))
    paper.putalpha(outline_alpha)
    composed = Image.alpha_composite(paper, cropped)

    final_pad = max(28, round(max(composed.size) * 0.025))
    output = Image.new(
        "RGBA",
        (composed.width + final_pad * 2, composed.height + final_pad * 2),
        (0, 0, 0, 0),
    )
    output.alpha_composite(composed, (final_pad, final_pad))

    output_alpha = np.asarray(output.getchannel("A"))
    coverage = float((output_alpha > 8).mean())
    transparent_corners = sum(
        int(output_alpha[y, x] < 8)
        for x, y in [
            (0, 0),
            (output.width - 1, 0),
            (0, output.height - 1),
            (output.width - 1, output.height - 1),
        ]
    )
    return output, {
        "coverage": coverage,
        "transparentCorners": float(transparent_corners),
    }


def process_asset(source: Path, target: Path, session) -> dict[str, Any]:
    input_image = Image.open(source).convert("RGBA")
    cutout = remove(
        input_image,
        session=session,
        alpha_matting=False,
        post_process_mask=True,
    )
    if not isinstance(cutout, Image.Image):
        raise TypeError("rembg returned an unexpected result.")
    cutout = refine_chroma_alpha(
        input_image,
        cutout,
        restore_thin_lines=(
            source.stem.endswith("-routes")
        ),
    )
    despilled, fringe_ratio, residual_fringe_ratio = despill_green(cutout)
    final, metrics = crop_and_outline(despilled)
    target.parent.mkdir(parents=True, exist_ok=True)
    final.save(target, "PNG", optimize=True)

    if final.mode != "RGBA":
        raise ValueError("Output is missing an alpha channel.")
    if metrics["transparentCorners"] < 4:
        raise ValueError("Output does not have four transparent corners.")
    # Thin graphical overlays (for example route lines) legitimately occupy
    # much less canvas area than people and props.
    if not 0.02 <= metrics["coverage"] <= 0.88:
        raise ValueError(
            f"Subject coverage {metrics['coverage']:.3f} is outside the expected range."
        )

    return {
        "source": source.name,
        "output": target.name,
        "width": final.width,
        "height": final.height,
        "greenFringeRatioBeforeDespill": fringe_ratio,
        "greenFringeRatioAfterDespill": residual_fringe_ratio,
        **metrics,
        "ok": residual_fringe_ratio <= 0.05,
    }


def inspect_existing(source: Path, target: Path) -> dict[str, Any]:
    image = Image.open(target).convert("RGBA")
    alpha = np.asarray(image.getchannel("A"))
    coverage = float((alpha > 8).mean())
    transparent_corners = sum(
        int(alpha[y, x] < 8)
        for x, y in [
            (0, 0),
            (image.width - 1, 0),
            (0, image.height - 1),
            (image.width - 1, image.height - 1),
        ]
    )
    ok = transparent_corners == 4 and 0.02 <= coverage <= 0.88
    return {
        "source": source.name,
        "output": target.name,
        "width": image.width,
        "height": image.height,
        "greenFringeRatioBeforeDespill": None,
        "greenFringeRatioAfterDespill": None,
        "coverage": coverage,
        "transparentCorners": float(transparent_corners),
        "reused": True,
        "ok": ok,
    }


def main() -> None:
    args = parse_args()
    root = Path.cwd()
    episode, episode_dir = load_episode(root, args.episode)
    source_dir = episode_dir / "assets" / "source"
    output_dir = episode_dir / "assets" / "matted"
    source_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    expected = {
        Path(layer["asset"]).name
        for scene in episode["scenes"]
        for layer in scene["layers"]
    }
    missing = [name for name in sorted(expected) if not (source_dir / name).exists()]
    if missing:
        raise FileNotFoundError(
            "Missing generated chroma-key sources: " + ", ".join(missing)
        )

    os.environ.setdefault("U2NET_HOME", str(Path.home() / ".u2net"))
    names = sorted(expected)
    reusable = {
        name
        for name in names
        if args.resume and (output_dir / name).exists()
    }
    session = None
    model_used = args.model
    if len(reusable) < len(names):
        session, model_used = make_session(args.model)
    results = []
    for name in names:
        if name in reusable:
            print(f"Reusing {name}")
            results.append(inspect_existing(source_dir / name, output_dir / name))
        else:
            print(f"Matting {name}")
            results.append(
                process_asset(source_dir / name, output_dir / name, session)
            )

    report = {
        "episode": args.episode,
        "requestedModel": args.model,
        "modelUsed": model_used,
        "assets": results,
        "passed": all(item["ok"] for item in results),
    }
    report_file = episode_dir / "assets" / "matte-report.json"
    report_file.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {report_file}")
    if not report["passed"]:
        raise RuntimeError("One or more assets have excessive green fringe.")


if __name__ == "__main__":
    main()
