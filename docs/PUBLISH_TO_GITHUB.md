# GitHub 发布清单

这个目录已经按独立仓库准备。发布前不要复制原有私有账号目录，也不要把本机生成的模型、依赖、视频或密钥加入版本控制。

## 发布前检查

在仓库根目录运行：

```bash
cd studio
pnpm run doctor
pnpm run lint
pnpm test
cd ..
git status --short
git diff --cached
```

确认待提交文件中不包含：

- `studio/.env` 或任何真实 API Key；
- `.venv/`、`node_modules/`、Whisper/rembg 模型；
- 未授权的音乐、字体、参考视频或生成成片；
- 个人账号定位、逐字稿、选题库和私有素材。

## 新建仓库

如果当前目录还不是 Git 仓库：

```bash
git init
git add .
git status --short
git commit -m "Initial open-source VOX video starter"
git branch -M main
git remote add origin <YOUR_GITHUB_REPOSITORY_URL>
git push -u origin main
```

先在 GitHub 创建一个空仓库，再把占位地址替换成你自己的仓库地址。提交前务必人工查看 `git status` 和暂存区差异。

## 发布后验证

在另一个空目录重新克隆公开仓库，并只按照 `README.md` 操作一次。至少验证：

1. setup 脚本可以完成依赖安装；
2. Skill 可以安装到 `.agents/skills/`；
3. `pnpm run doctor`、`pnpm run lint`、`pnpm test` 通过；
4. 打开 Remotion 时会显示 Setup Guide；
5. Agent 会先采集内容方向，并在“方向确认”前停止；
6. 未配置 API Key 时只给出明确提示，不泄漏或伪造密钥。
