# Security

## Secrets

API Key 只能保存在 `studio/.env` 或系统环境变量中。`.env` 已被 Git 忽略，但提交者仍应在每次 push 前检查暂存区。

如果密钥曾被提交、粘贴到 Issue 或写入日志，请立即在服务商控制台撤销并重新创建；仅从 Git 历史中删除并不能让已泄漏的密钥恢复安全。

## Reporting

请通过仓库维护者在 GitHub 中启用的私密漏洞报告渠道提交安全问题，不要在公开 Issue 中附带密钥、个人路径或未公开素材。
