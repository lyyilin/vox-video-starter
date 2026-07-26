/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";
import fs from "node:fs";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setCodec("h264");

const windowsChrome =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
if (process.platform === "win32" && fs.existsSync(windowsChrome)) {
  Config.setBrowserExecutable(windowsChrome);
}
