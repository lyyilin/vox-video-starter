# Asset orchestration

After storyboard approval:

1. Build `prompts/asset-manifest.json` with one stable cell and output path per asset.
2. The main task generates exactly one overview grid containing every planned asset plus a palette/style cell.
3. Delegate exactly one individual asset per worker assignment. The main task does not generate formal individual assets.
4. A worker uses one built-in Imagegen call, retries one transient network failure once with the identical prompt, saves the exact prompt record, copies the selected result to the requested path, and inspects it at 100%.
5. The main task validates returned files and alone updates the manifest.
6. Reject dirt, grain, accidental text, cropped anatomy, broken edges, nonuniform chroma backgrounds, or excessive fragments.
7. After all items are accepted, assemble a contact sheet from the real individual files.

Workers must not edit `episode.json`, `storyboard.md`, the shared manifest, shared code, or another worker's files.
