import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

export const TITLE_FONT = "Noto Serif SC";
export const CAPTION_FONT = "Noto Sans SC";

void Promise.all([
  loadFont({
    family: TITLE_FONT,
    url: staticFile("fonts/NotoSerifSC-Bold.otf"),
    format: "opentype",
    weight: "700",
  }),
  loadFont({
    family: CAPTION_FONT,
    url: staticFile("fonts/NotoSansSC-Bold.otf"),
    format: "opentype",
    weight: "700",
  }),
]);
