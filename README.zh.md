# dsh-plugin-marketplace

**GitHub**: [Scorp1o117/dsh-plugin-marketplace](https://github.com/Scorp1o117/dsh-plugin-marketplace) · **npm**: [dsh-plugin-marketplace](https://www.npmjs.com/package/dsh-plugin-marketplace) · [English](README.md)

[![Enhancement Suite](https://img.shields.io/badge/part%20of-Enhancement%20Suite-3964fe)](https://github.com/Scorp1o117/dsh-enhancement-suite) [![npm](https://img.shields.io/npm/v/dsh-enhancement-suite)](https://www.npmjs.com/package/dsh-enhancement-suite)

属于 [DeepSeek Harness Enhancement Suite](https://github.com/Scorp1o117/dsh-enhancement-suite) —— Vision · Soul/Persona · 长期记忆 · 插件市场。

在 DeepSeek Harness **Web UI 里内置的插件市场**：直接在设置页浏览
[github.com/topics/dsh-plugin](https://github.com/topics/dsh-plugin)，无需打开终端。

- **搜索**：按关键词搜索主题下的插件，按 Star 或更新时间**排序**
- **插件卡片**：名称、简介、Star 数、语言、更新时间一目了然
- **详情面板**：GitHub README 摘要、安装命令、仓库 / npm 链接
- **AI 解释**：一键调用已配置的默认模型，用中文直接告诉你这个插件大概是干嘛的，不用自己啃 README
- 基于 GitHub 公开搜索 API（浏览器 CORS 直连，无需密钥；未认证限流 60 次/小时）
- 零客户端依赖（只用 React），无构建步骤 —— 手写 ModuleLoader bundle

## 安装

作为 profile bundle 安装（推荐）：

```
dsh plugin --profile web add dsh-plugin-marketplace
```

或通过包的 `dsh.bundle.patch` 层：把 `dsh-plugin-marketplace` 加进
`$DSH_HOME/profiles/web/package.json` 的 `dsh.profile.bundles`。

手动挂载（`$DSH_HOME/profiles/web/cordis.patch.yml`）：

```yaml
- insert:
    - id: plugin-marketplace
      name: 'dsh-plugin-marketplace'
```

> **从 ≤ 0.2.2 升级？** 如果你之前是手动挂载的，切到 bundle 安装前**先删掉
> `cordis.patch.yml` 里那一行**——bundle 层自己会插入条目，两行同 id 会让启动
> 直接报 `duplicate loader entry id: plugin-marketplace`。两种方式二选一，别同时用。

然后重启 `dsh web`（新客户端插件需要重启进程才会被扫描进浏览器清单），打开 **设置 → 插件市场**。

**如果点安装按钮报 `settings namespace "plugin-marketplace" is not exposed to
configuration clients`**：宿主 apiproxy 只放行硬编码白名单里的命名空间，本插件会在
首次启动时自动把命名空间补进白名单——但当前进程要到**重启 `dsh web`** 之后才会放行。
重启一次即可；若重启后仍报错，看启动日志里的 `[settings-expose]` 提示（它会指出要手动
编辑的文件：`dsh-host-apiproxy/lib/index.js` 的 `WEB_SETTINGS_NAMESPACES`）。

## 实现方式

| 层 | 文件 | 作用 |
|---|---|---|
| 服务端壳 | `index.js` | settings 通道的安装 + AI 解释流程；`dsh.bundle.patch` 让包成为标准 profile bundle |
| 浏览器端 | `client.js` | 注册 `settings.section` 的 "marketplace" 分区；调用 GitHub 搜索 API；渲染卡片 + 详情；"AI 解释"按钮 |
| 清单 | `package.json` | `dsh.bundle: { patch: "./cordis.patch.yml" }` + `dsh.client: { platform: "web" }` + `exports["./client"]` —— 被 `dsh-client-modules` 扫描发现 |

浏览器端不需要任何 `dsh.client.inject` 依赖包：只用 `react`（web 运行时自带）和 `slots` / `locale` 客户端服务。

## 备注

- GitHub 搜索 API 最多返回 1000 条；该主题目前有 280+ 仓库，翻页可以覆盖全部。
- README 按需按插件拉取，截断到约 1200 字符。
- 遇到 "rate-limited"：等一小时，或让 web 走带 GitHub token 的代理。

## License

MIT
