import type { Caption, TikTokPage } from "@remotion/captions";
import { Audio } from "@remotion/media";
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type {
  ResolvedAnnotation,
  ResolvedEpisode,
  ResolvedLayer,
  ResolvedRoute,
  ResolvedScene,
} from "./episode-schema";
import { createChineseCaptionPages } from "./caption-pages";
import { CAPTION_FONT, TITLE_FONT } from "./fonts";

const COLORS = {
  indigo: "#071826",
  ricePaper: "#E8D6B8",
  bronze: "#A6723F",
  cinnabar: "#A33A2B",
  mistBlue: "#7EA7B8",
  warmWhite: "#F7F2E8",
};

const hashString = (value: string): number =>
  Array.from(value).reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    7,
  );

const toneColor = (
  tone: "paper" | "bronze" | "cinnabar" | "mist",
): string => {
  if (tone === "bronze") return COLORS.bronze;
  if (tone === "cinnabar") return COLORS.cinnabar;
  if (tone === "mist") return COLORS.mistBlue;
  return COLORS.ricePaper;
};

type CameraState = {
  scale: number;
  x: number;
  y: number;
  rotation: number;
};

const getCameraState = (
  scene: ResolvedScene,
  frame: number,
  fps: number,
): CameraState => {
  const duration = scene.endFrame - scene.startFrame;
  const intensity = scene.motionIntensity;
  let scale = interpolate(
    frame,
    [0, Math.max(1, duration)],
    [1.025, 1.052],
    {
      easing: Easing.bezier(0.45, 0, 0.55, 1),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  let x = 0;
  let y = 0;
  let rotation = 0;

  for (const beat of scene.cameraBeats) {
    const local = Math.max(0, beat.cueFrame - scene.startFrame);
    const progress = interpolate(
      frame,
      [local, local + Math.round(fps * 1.1)],
      [0, 1],
      {
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      },
    );
    const transient = Math.sin(progress * Math.PI);
    const strength = beat.strength * intensity;
    if (beat.motion === "push-in") scale += progress * 0.024 * strength;
    if (beat.motion === "pull-out") scale -= progress * 0.018 * strength;
    if (beat.motion === "pan-left") x -= progress * 32 * strength;
    if (beat.motion === "pan-right") x += progress * 32 * strength;
    if (beat.motion === "whip-left") x -= transient * 48 * strength;
    if (beat.motion === "whip-right") x += transient * 48 * strength;
    if (beat.motion === "lift") y -= progress * 24 * strength;
    if (beat.motion === "drop") y += progress * 24 * strength;
    if (beat.motion === "tilt-left") rotation -= transient * 0.65 * strength;
    if (beat.motion === "tilt-right") rotation += transient * 0.65 * strength;
  }

  return { scale, x, y, rotation };
};

const CollageLayer: React.FC<{
  layer: ResolvedLayer;
  sceneStartFrame: number;
  sceneDuration: number;
  camera: CameraState;
  motionIntensity: number;
}> = ({
  layer,
  sceneStartFrame,
  sceneDuration,
  camera,
  motionIntensity,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const cueLocalFrame = Math.max(0, layer.cueFrame - sceneStartFrame);
  const entranceEnd = cueLocalFrame + Math.round(fps * 0.52);
  const entrance = interpolate(frame, [cueLocalFrame, entranceEnd], [0, 1], {
    easing:
      layer.motion === "stamp"
        ? Easing.bezier(0.34, 1.5, 0.64, 1)
        : Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitStart = Math.max(entranceEnd + 1, sceneDuration - Math.round(fps * 0.4));
  const exit = interpolate(frame, [exitStart, sceneDuration], [0, 1], {
    easing: Easing.in(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  let beatX = 0;
  let beatY = 0;
  let beatScale = 0;
  let beatRotation = 0;
  let beatOpacity = 0;
  let beatBrightness = 1;
  for (const beat of layer.beats) {
    const beatLocalFrame = Math.max(0, beat.cueFrame - sceneStartFrame);
    const progress = interpolate(
      frame,
      [beatLocalFrame, beatLocalFrame + Math.round(fps * 0.86)],
      [0, 1],
      {
        easing: Easing.bezier(0.45, 0, 0.55, 1),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      },
    );
    const accent = Math.sin(progress * Math.PI) * beat.strength * motionIntensity;
    if (beat.effect === "pulse") beatScale += accent * 0.075;
    if (beat.effect === "focus") {
      beatScale += accent * 0.045;
      beatBrightness += accent * 0.18;
    }
    if (beat.effect === "tilt") beatRotation += accent * 3.5;
    if (beat.effect === "lift") beatY -= accent * 26;
    if (beat.effect === "nudge-left") beatX -= accent * 38;
    if (beat.effect === "nudge-right") beatX += accent * 38;
    if (beat.effect === "shake") {
      beatX += Math.sin(progress * Math.PI * 6) * accent * 5;
      beatRotation += Math.sin(progress * Math.PI * 4) * accent * 0.8;
    }
    if (beat.effect === "bounce") beatY -= Math.abs(Math.sin(progress * Math.PI * 2)) * accent * 20;
    if (beat.effect === "swing") beatRotation += Math.sin(progress * Math.PI * 3) * accent * 3;
    if (beat.effect === "flash") beatBrightness += accent * 0.35;
    if (beat.effect === "dim") beatOpacity -= accent * 0.24;
  }

  const seed = hashString(layer.id);
  const phase = ((seed % 360) / 180) * Math.PI;
  const elapsed = Math.max(0, frame - cueLocalFrame);
  const ambientWave =
    Math.sin((elapsed / (fps * (1.65 + (seed % 70) / 100))) * Math.PI * 2 + phase) *
    entrance *
    motionIntensity;
  let ambientX = 0;
  let ambientY = 0;
  let ambientScale = 0;
  let ambientRotation = 0;
  if (layer.ambient === "breathe") ambientScale = ambientWave * 0.012;
  if (layer.ambient === "sway") {
    ambientX = ambientWave * 7;
    ambientRotation = ambientWave * 0.9;
  }
  if (layer.ambient === "float") ambientY = ambientWave * 8;
  if (layer.ambient === "pendulum") {
    ambientX = ambientWave * 5;
    ambientRotation = ambientWave * 2;
  }

  const offX =
    layer.motion === "slide-left"
      ? -260
      : layer.motion === "slide-right"
        ? 260
        : layer.motion === "drift"
          ? seed % 2 === 0
            ? -120
            : 120
          : 0;
  const offY = layer.motion === "rise" ? 210 : 0;
  const scaleFrom =
    layer.motion === "pop" || layer.motion === "stamp" ? 0.64 : 0.93;
  const exitX =
    layer.exit === "slide-left" ? -220 : layer.exit === "slide-right" ? 220 : 0;
  const exitY = layer.exit === "drop" ? 170 : 0;
  const exitScale = layer.exit === "shrink" ? -0.24 * exit : 0;
  const depthFactor = layer.layout.depth * motionIntensity;
  const parallaxX = camera.x * (0.25 + depthFactor * 0.42);
  const parallaxY = camera.y * (0.25 + depthFactor * 0.42);
  const zoomDrift = (camera.scale - 1) * 45 * depthFactor;
  const pxWidth = layer.layout.width * width;
  const left = layer.layout.x * width;
  const top = layer.layout.y * height;
  const anchorTranslate =
    layer.layout.anchor === "bottom" ? "-50% -100%" : "-50% -50%";
  const [anchorX, anchorY] = anchorTranslate.split(" ");

  return (
    <Img
      src={staticFile(layer.asset)}
      style={{
        position: "absolute",
        width: pxWidth,
        height: "auto",
        left,
        top,
        zIndex: layer.z,
        opacity:
          entrance *
          (1 - (layer.exit === "fade" ? exit : exit * 0.28)) *
          Math.max(0.15, 1 + beatOpacity),
        translate: `calc(${anchorX} + ${offX * (1 - entrance) + exitX * exit + beatX + ambientX + parallaxX}px) calc(${anchorY} + ${offY * (1 - entrance) + exitY * exit + beatY + ambientY + parallaxY - zoomDrift}px)`,
        scale:
          interpolate(entrance, [0, 1], [scaleFrom, 1]) +
          beatScale +
          ambientScale +
          exitScale +
          (camera.scale - 1) * depthFactor * 0.32,
        rotate: `${
          layer.layout.rotation +
          (1 - entrance) * (layer.motion === "stamp" ? -9 : 3) +
          beatRotation +
          ambientRotation +
          camera.rotation * depthFactor * 0.4
        }deg`,
        filter: `brightness(${beatBrightness}) drop-shadow(0 16px 9px rgba(31, 18, 14, 0.2))`,
      }}
    />
  );
};

const AnimatedRoute: React.FC<{
  route: ResolvedRoute;
  sceneStartFrame: number;
}> = ({ route, sceneStartFrame }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const local = Math.max(0, route.cueFrame - sceneStartFrame);
  const progress = interpolate(frame, [local, local + fps * 0.9], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [local + fps * 2.1, local + fps * 2.6],
    [0, 1],
    {
      easing: Easing.inOut(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const points =
    route.direction === "reverse" ? [...route.points].reverse() : route.points;
  const pathData = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x * width} ${point.y * height}`,
    )
    .join(" ");
  const color = toneColor(route.tone);
  const finalPoint = points.at(-1) ?? points[0];
  const lineWidth = Math.min(6, route.width * 0.72);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        overflow: "visible",
        zIndex: Math.min(route.z, 24),
        opacity: progress * (1 - fadeOut),
        pointerEvents: "none",
      }}
    >
      <path
        d={pathData}
        pathLength={1}
        fill="none"
        stroke="rgba(7,24,38,.2)"
        strokeWidth={lineWidth + 4}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={route.style === "dashed" ? "0.055 0.035" : "1"}
        strokeDashoffset={1 - progress}
      />
      <path
        d={pathData}
        pathLength={1}
        fill="none"
        stroke={color}
        strokeWidth={lineWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={route.style === "dashed" ? "0.055 0.035" : "1"}
        strokeDashoffset={1 - progress}
      />
      {points.map((point, index) => {
        const nodeProgress = interpolate(
          progress,
          [index / points.length, Math.min(1, index / points.length + 0.16)],
          [0, 1],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          },
        );
        return (
          <g
            key={`${point.x}-${point.y}-${index}`}
            opacity={nodeProgress}
            transform={`translate(${point.x * width} ${point.y * height}) scale(${nodeProgress})`}
          >
            <circle r={12} fill={COLORS.warmWhite} stroke={COLORS.indigo} strokeWidth={4} />
            <circle r={4} fill={color} />
          </g>
        );
      })}
      <circle
        cx={finalPoint.x * width}
        cy={finalPoint.y * height}
        r={interpolate(progress, [0.82, 1], [0, 20], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}
        fill="none"
        stroke={color}
        strokeWidth={3}
        opacity={1 - progress}
      />
    </svg>
  );
};

const Annotation: React.FC<{
  annotation: ResolvedAnnotation;
  sceneStartFrame: number;
}> = ({ annotation, sceneStartFrame }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const local = Math.max(0, annotation.cueFrame - sceneStartFrame);
  const progress = interpolate(frame, [local, local + fps * 0.42], [0, 1], {
    easing:
      annotation.motion === "stamp"
        ? Easing.bezier(0.34, 1.55, 0.64, 1)
        : Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pulse = Math.sin(
    interpolate(frame, [local, local + fps * 0.8], [0, Math.PI], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const accent = toneColor(annotation.tone);
  const isWarning = annotation.type === "warning";
  const isStamp = annotation.type === "stamp";
  const fontSize = annotation.type === "counter" ? 62 : isStamp ? 40 : 34;
  const offX =
    annotation.motion === "slide-left"
      ? -120
      : annotation.motion === "slide-right"
        ? 120
        : 0;

  return (
    <div
      style={{
        position: "absolute",
        left: annotation.x * width,
        top: annotation.y * height,
        zIndex: annotation.z,
        opacity: progress,
        translate: `calc(-50% + ${offX * (1 - progress)}px) -50%`,
        scale:
          interpolate(progress, [0, 1], [isStamp ? 1.45 : 0.72, 1]) +
          pulse * 0.025,
        rotate: `${isStamp ? (1 - progress) * -11 + 3 : 0}deg`,
        padding: isStamp ? "16px 24px" : "12px 20px",
        color: isWarning || isStamp ? COLORS.warmWhite : COLORS.indigo,
        backgroundColor:
          isWarning || isStamp ? COLORS.cinnabar : COLORS.warmWhite,
        border: `5px solid ${accent}`,
        boxShadow: `9px 9px 0 rgba(7,24,38,.24)`,
        fontFamily: annotation.type === "counter" ? TITLE_FONT : CAPTION_FONT,
        fontSize,
        fontWeight: 800,
        lineHeight: 1.05,
        whiteSpace: "nowrap",
      }}
    >
      {annotation.text}
    </div>
  );
};

const Scene: React.FC<{
  scene: ResolvedScene;
}> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = scene.endFrame - scene.startFrame;
  const camera = getCameraState(scene, frame, fps);
  const sceneOpacity =
    scene.sceneTransition === "hard-cut"
      ? 1
      : interpolate(frame, [0, Math.max(5, Math.round(fps * 0.23))], [0, 1], {
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  const titleIn = interpolate(frame, [4, 22], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleOutStart = Math.min(
    Math.max(28, Math.round(fps * 2.2)),
    Math.max(28, duration - Math.round(fps * 0.8)),
  );
  const titleOut = interpolate(
    frame,
    [titleOutStart, titleOutStart + Math.round(fps * 0.35)],
    [0, 1],
    {
      easing: Easing.in(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const titleProgress = titleIn * (1 - titleOut);
  const titleOnDark = scene.titleTone === "paper";
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.ricePaper,
        overflow: "hidden",
        opacity: sceneOpacity,
      }}
    >
      <Img
        src={staticFile(scene.background)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          scale: camera.scale,
          translate: `${camera.x}px ${camera.y}px`,
          rotate: `${camera.rotation}deg`,
          filter: "saturate(.96) contrast(1.03)",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(90deg, rgba(7,24,38,.27), transparent 30%, transparent 74%, rgba(7,24,38,.2))",
        }}
      />
      {scene.routes.map((route) => (
        <AnimatedRoute
          key={route.id}
          route={route}
          sceneStartFrame={scene.startFrame}
        />
      ))}
      {scene.layers.map((layer) => (
        <CollageLayer
          key={layer.id}
          layer={layer}
          sceneStartFrame={scene.startFrame}
          sceneDuration={duration}
          camera={camera}
          motionIntensity={scene.motionIntensity}
        />
      ))}
      {scene.annotations.map((annotation) => (
        <Annotation
          key={annotation.id}
          annotation={annotation}
          sceneStartFrame={scene.startFrame}
        />
      ))}
      <div
        style={{
          position: "absolute",
          left: 96,
          top: 76,
          zIndex: 200,
          color: COLORS.ricePaper,
          opacity: titleProgress,
          translate: `${interpolate(titleProgress, [0, 1], [-52, 0])}px ${-titleOut * 22}px`,
        }}
      >
        {scene.kicker ? (
          <div
            style={{
              display: "inline-block",
              padding: "9px 16px",
              backgroundColor: COLORS.cinnabar,
              fontFamily: CAPTION_FONT,
              fontSize: 28,
              letterSpacing: 4,
            }}
          >
            {scene.kicker}
          </div>
        ) : null}
        <div
          style={{
            marginTop: 12,
            color: titleOnDark ? COLORS.ricePaper : COLORS.indigo,
            fontFamily: TITLE_FONT,
            fontSize: 80,
            fontWeight: 700,
            lineHeight: 1.05,
            textShadow: titleOnDark
              ? "0 3px 0 rgba(7,24,38,.82)"
              : "0 2px 0 rgba(239,225,195,.75)",
          }}
        >
          {scene.title}
        </div>
        <div
          style={{
            marginTop: 12,
            width: interpolate(titleIn, [0, 1], [0, 132]),
            height: 9,
            background: COLORS.bronze,
            rotate: "-2deg",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

const CaptionPage: React.FC<{
  page: TikTokPage;
  bottomSafeArea: number;
}> = ({ page, bottomSafeArea }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const absoluteTimeMs = page.startMs + (frame / fps) * 1000;
  const entrance = interpolate(frame, [0, Math.round(fps * 0.22)], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: bottomSafeArea,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: 1480,
          padding: "20px 34px 23px",
          background: "rgba(7, 24, 38, 0.91)",
          boxShadow: `10px 10px 0 ${COLORS.cinnabar}`,
          color: COLORS.ricePaper,
          fontFamily: CAPTION_FONT,
          fontSize: 52,
          fontWeight: 700,
          lineHeight: 1.28,
          letterSpacing: 1,
          textAlign: "center",
          whiteSpace: "pre-wrap",
          opacity: entrance,
          translate: `0 ${interpolate(entrance, [0, 1], [22, 0])}px`,
          scale: interpolate(entrance, [0, 1], [0.97, 1]),
        }}
      >
        {page.tokens.map((token) => {
          const active =
            token.fromMs <= absoluteTimeMs && token.toMs > absoluteTimeMs;
          return (
            <span
              key={`${token.fromMs}-${token.toMs}-${token.text}`}
              style={{ color: active ? COLORS.bronze : COLORS.ricePaper }}
            >
              {token.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Captions: React.FC<{
  captions: Caption[];
  combineWithinMs: number;
  maxCharsPerPage: number;
  bottomSafeArea: number;
}> = ({
  captions,
  combineWithinMs,
  maxCharsPerPage,
  bottomSafeArea,
}) => {
  const { fps } = useVideoConfig();
  const pages = useMemo(
    () =>
      createChineseCaptionPages({
        captions,
        combineWithinMs,
        maxCharsPerPage,
      }),
    [captions, combineWithinMs, maxCharsPerPage],
  );

  return (
    <AbsoluteFill style={{ zIndex: 400 }}>
      {pages.map((page, index) => {
        const next = pages[index + 1];
        const startFrame = Math.floor((page.startMs / 1000) * fps);
        const endFrame = Math.ceil(
          ((next?.startMs ?? page.startMs + page.durationMs) / 1000) * fps,
        );
        return (
          <Sequence
            key={`${page.startMs}-${index}`}
            from={startFrame}
            durationInFrames={Math.max(1, endFrame - startFrame)}
            premountFor={fps}
          >
            <CaptionPage page={page} bottomSafeArea={bottomSafeArea} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export const VoxVideo: React.FC<{
  episodeId: string;
  episode: ResolvedEpisode;
}> = ({ episodeId, episode }) => {
  const { fps } = useVideoConfig();
  const episodeBase = `episodes/${episodeId}`;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.indigo }}>
      {episode.scenes.map((scene) => (
        <Sequence
          key={scene.id}
          from={scene.startFrame}
          durationInFrames={Math.max(1, scene.endFrame - scene.startFrame)}
          premountFor={fps}
        >
          <Scene scene={scene} />
        </Sequence>
      ))}
      <Audio src={staticFile(`${episodeBase}/audio/voice.wav`)} volume={1} />
      <Audio
        src={staticFile(episode.audio.bgm.asset)}
        volume={() => episode.audio.bgm.volume}
        loop
      />
      {episode.audio.sfx.map((sfx) => {
        const cue = episode.cueMap[sfx.cue];
        return (
          <Sequence
            key={sfx.id}
            from={cue.frame}
            durationInFrames={fps * 2}
            premountFor={fps}
          >
            <Audio
              src={staticFile(`${episodeBase}/audio/sfx/${sfx.type}.wav`)}
              volume={() => sfx.volume}
            />
          </Sequence>
        );
      })}
      <Captions
        captions={episode.captionsData}
        combineWithinMs={episode.captions.combineWithinMs}
        maxCharsPerPage={episode.captions.maxCharsPerPage}
        bottomSafeArea={episode.captions.bottomSafeArea}
      />
      <div
        style={{
          position: "absolute",
          right: 54,
          top: 52,
          zIndex: 500,
          width: 68,
          height: 68,
          display: "grid",
          placeItems: "center",
          color: COLORS.ricePaper,
          backgroundColor: COLORS.cinnabar,
          border: `3px solid ${COLORS.ricePaper}`,
          fontFamily: TITLE_FONT,
          fontSize: 24,
          fontWeight: 700,
          rotate: "3deg",
        }}
      >
        {episode.brand.shortMark}
      </div>
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          boxShadow: "inset 0 0 150px rgba(7,24,38,.24)",
          border: "20px solid rgba(239,225,195,.22)",
          zIndex: 600,
        }}
      />
    </AbsoluteFill>
  );
};
