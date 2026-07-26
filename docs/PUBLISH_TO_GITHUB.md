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

## 推荐的仓库信息

- 仓库名称：`vox-video-starter`
- 可见性：`Public`
- Description：`A reusable caption-driven VOX paper-collage video workflow for Codex, Imagegen, rembg, Seed-TTS 2, Whisper, and Remotion.`
- Topics：`remotion`、`codex`、`video-generation`、`imagegen`、`whisper`、`tts`、`paper-collage`

## 在 GitHub 新建空仓库

1. 登录 GitHub，点击右上角 `+`，选择 `New repository`。
2. 在 `Owner` 中选择准备发布这个项目的账号或组织。
3. `Repository name` 填写 `vox-video-starter`。
4. 填写上面的 Description，并选择 `Public`。
5. 保持仓库为空：
   - 不勾选 `Add a README file`；
   - `.gitignore template` 保持 `None`；
   - `License` 保持 `None`。
6. 点击 `Create repository`。

本地项目已经包含 README、`.gitignore`、MIT License 和首个 commit。如果在 GitHub 端再次初始化这些文件，会多出一套远程提交历史，首次推送时容易发生冲突。

## 推送当前本地仓库

当前分享版已经初始化为 `main` 分支，并包含首个提交。创建 GitHub 空仓库后，在 PowerShell 中运行：

```powershell
cd "E:\codex项目\自媒体\VOX讲故事\vox-video-starter"
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/vox-video-starter.git
git remote -v
git push -u origin main
```

把 `<YOUR_GITHUB_USERNAME>` 替换为你的 GitHub 用户名。如果仓库建在组织下，则替换为组织名。

使用 SSH 的用户可以改为：

```powershell
git remote add origin git@github.com:<YOUR_GITHUB_USERNAME>/vox-video-starter.git
git push -u origin main
```

如果 GitHub 网页在创建仓库后给出了专属命令，以页面显示的仓库地址为准。

## 仅在尚未初始化 Git 时使用

其他用户复制了项目文件、但目录里没有 `.git` 时，才需要运行：

```bash
git init
git add .
git status --short
git commit -m "Initial open-source VOX video starter"
git branch -M main
```

完成本地提交后，再按照上一节添加 remote 并推送。提交前务必人工查看 `git status` 和暂存区差异。

## 发布后验证

在另一个空目录重新克隆公开仓库，并只按照 `README.md` 操作一次。至少验证：

1. setup 脚本可以完成依赖安装；
2. Skill 可以安装到 `.agents/skills/`；
3. `pnpm run doctor`、`pnpm run lint`、`pnpm test` 通过；
4. 打开 Remotion 时会显示 Setup Guide；
5. Agent 会先采集内容方向，并在“方向确认”前停止；
6. 未配置 API Key 时只给出明确提示，不泄漏或伪造密钥。
