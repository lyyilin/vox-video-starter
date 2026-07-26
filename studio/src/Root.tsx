import "./index.css";
import type { CalculateMetadataFunction } from "remotion";
import { AbsoluteFill, Composition, Folder, staticFile } from "remotion";
import { z } from "zod";
import { VoxVideo } from "./VoxVideo";
import { resolvedEpisodeSchema } from "./episode-schema";

const compositionSchema = z.object({
  episodeId: z.string(),
  resolved: resolvedEpisodeSchema.nullable(),
});

type CompositionProps = z.infer<typeof compositionSchema>;

const SETUP_EPISODE_ID = "setup-guide";

const calculateMetadata: CalculateMetadataFunction<CompositionProps> = async ({
  props,
  abortSignal,
}) => {
  if (props.episodeId === SETUP_EPISODE_ID && !props.resolved) {
    return {
      durationInFrames: 150,
      fps: 30,
      width: 1920,
      height: 1080,
      defaultOutName: "setup-guide.mp4",
      props,
    };
  }

  const response = await fetch(
    staticFile(`episodes/${props.episodeId}/resolved-episode.json`),
    { signal: abortSignal },
  );

  if (!response.ok) {
    throw new Error(
      `Cannot load resolved timeline for "${props.episodeId}". Run pnpm run timeline:build -- --episode ${props.episodeId}.`,
    );
  }

  const resolved = resolvedEpisodeSchema.parse(await response.json());

  return {
    durationInFrames: resolved.durationInFrames,
    fps: resolved.format.fps,
    width: resolved.format.width,
    height: resolved.format.height,
    defaultOutName: `${props.episodeId}.mp4`,
    props: { ...props, resolved },
  };
};

const VoxCollageComposition: React.FC<CompositionProps> = ({
  episodeId,
  resolved,
}) => {
  if (!resolved) {
    return (
      <AbsoluteFill
        style={{
          alignItems: "center",
          background: "#efe5cf",
          color: "#171512",
          fontFamily: "Georgia, serif",
          justifyContent: "center",
          padding: 120,
          textAlign: "center",
        }}
      >
        <div style={{ color: "#9e2f26", fontSize: 34, letterSpacing: 8 }}>
          VOX VIDEO STARTER
        </div>
        <div style={{ fontSize: 72, fontWeight: 700, marginTop: 28 }}>
          环境已就绪，先创建你的第一期视频
        </div>
        <div style={{ fontFamily: "sans-serif", fontSize: 30, lineHeight: 1.7, marginTop: 34 }}>
          pnpm run episode:new -- --id my-first-episode
          <br />
          完成配音与字幕后，再运行 timeline:build
        </div>
      </AbsoluteFill>
    );
  }

  return <VoxVideo episodeId={episodeId} episode={resolved} />;
};

export const RemotionRoot: React.FC = () => {
  return (
    <Folder name="VOX-Collage">
      <Composition
        id="VoxCollage"
        component={VoxCollageComposition}
        durationInFrames={780}
        fps={30}
        width={1920}
        height={1080}
        schema={compositionSchema}
        defaultProps={{ episodeId: SETUP_EPISODE_ID, resolved: null }}
        calculateMetadata={calculateMetadata}
      />
    </Folder>
  );
};
