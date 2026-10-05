# AI 图像生成与媒体分享平台

Social AI 是一个在起始项目基础上迭代的全栈作品，支持注册登录、AI 图像生成、图片与视频上传、媒体搜索和本人作品删除。项目将原有界面适配至 React 19 与 Cloudflare Workers，并保留原有接口调用方式。

[English README](README.md) · [测试方法与原始数据](docs/benchmarks/README.md)

## 项目实现

- **前端适配：** React 19、React Router、Ant Design 和 Material UI，通过依赖兼容层、ES 模块映射及 REST 适配器衔接原有页面。
- **后端与存储：** TypeScript / Vinext 路由运行于 Workers，D1 保存用户与媒体元数据，R2 保存图片和视频。
- **认证与权限：** 加盐 PBKDF2-SHA256 密码哈希、24 小时有效的 HMAC 签名令牌，以及服务端媒体所有权校验。
- **媒体与检索：** 登录后上传最大 25 MiB 的文件；支持作者筛选和多关键词子串匹配；作者列表使用联合索引。
- **AI 接口：** 服务端代理调用 OpenAI Images API，密钥不传入浏览器；未配置密钥时，生成功能返回 503。

## 已验证的数据

以下为 **2026-09-08 本地测试**，使用生产构建与 Miniflare/workerd，不代表线上用户量或云端性能。

| 验证内容 | 结果 |
| --- | --- |
| 集成测试 | 50 组检查通过；5 个旧版 REST 接口行为通过验证 |
| 上传边界 | 有效 PNG/MP4 各测试 25 MiB − 1 字节、25 MiB、25 MiB + 1 字节，共 6 个用例；成功上传后校验 SHA-256 |
| 上传失败清理 | 注入 50 次数据库写入失败，测试中未遗留媒体对象或记录 |
| 索引性能 | 10 万条合成数据、500 组配对查询；作者查询 P95 从 16.49 ms 降至 6.98 ms，降低约 57.7% |
| 查询读取行数 | 同一作者查询从 100,100 行降至 100 行 |
| 认证与权限 | 27 次负向请求按预期被拒绝 |
| AI 代理 | 8 个场景通过，外部提供方响应使用模拟数据 |

## 本地运行

需要 Node.js 22.13 或更新版本及 pnpm。

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
```

在 `.env.local` 设置随机的 `TOKEN_SECRET`；如需 AI 生成功能，填写 `OPENAI_API_KEY`。不要把真实密钥放入 `REACT_APP_OPENAI_KEY`。

```bash
pnpm dev
```

打开终端显示的地址，注册账号后即可使用本地 D1/R2。上传、搜索和删除不需要付费 AI 调用。生产构建使用 `pnpm build`。

```bash
pnpm test:bench
# 额外需要 Python 3、Pillow，以及支持 libx264 的 ffmpeg：
pnpm test:media
```

临时构建、数据库、媒体样本和新结果保存在被 Git 忽略的 `.bench/` 下。详细方法见[测试说明](docs/benchmarks/README.md)。

## 阅读代码

| 位置 | 用途 |
| --- | --- |
| `app/SocialApp.tsx`、`src/components/` | 当前实际挂载的界面 |
| `app/api/`、`lib/server.ts` | API、认证、D1/R2 操作 |
| `app/compat/` 及 `/signin` 等路由 | 原有调用方式的兼容适配 |
| `db/`、`drizzle/` | 数据库结构和迁移文件 |
| `scripts/bench/` | 可复现的本地验证脚本 |
| Go 源文件及 `handler/`、`service/`、`backend/` 等 | 保留的早期 Go 后端参考，不是当前运行服务 |
| 顶层 `components/` | 早期界面实现，不是当前挂载的前端 |

## 实现边界

媒体 URL 公开；上传校验尚不检查文件签名或执行安全扫描。关键词搜索最多处理 8 个词、返回 100 条记录，不属于全文检索。缓存响应头已设置，但尚未实现条件请求 304。存储清理为尽力执行。服务端保留开发用令牌密钥默认值，对外运行前必须配置独立密钥；限流、账号找回和防滥用功能尚未实现。AI 测试没有调用真实付费接口。

本仓库展示在起始项目上完成的迁移、后端实现和验证工作；部署到云端仍需自行配置 D1、R2 与服务端密钥。
