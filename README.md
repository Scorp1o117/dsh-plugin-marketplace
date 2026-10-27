# DSH Plugin Marketplace

简体中文 | [English](README.en.md)

在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 中浏览社区插件，并管理当前 Web 或 Desktop Profile 中安装的插件。

## 功能

- **发现插件**：浏览 GitHub 上的 `dsh-plugin` 项目，按关键词搜索、Star 数或更新时间排序，预览 README。
- **AI 解释**：使用当前配置的模型解释插件；是否可用取决于模型连接。
- **管理插件**：输入 npm 包名安装，查看当前 Profile 的直接依赖，更新到最新版或确认卸载。内置 bundle 标记为由 DSH 管理，不能在这里覆盖或卸载；间接依赖不会显示为独立插件。
- **查看真实结果**：套件与市场的操作按 Profile 串行执行；失败时显示错误及可能已经完成的部分，再刷新实际安装状态。

> GitHub 仓库名不一定等于 npm 包名。安装前请核对插件作者提供的包名和使用说明；插件市场不会替你保证第三方插件的安全性。

## 兼容性与安装

支持 DSH Web / Desktop；仓库声明兼容 `0.2.0-rc.2`、`0.2.1-rc.1` / `rc.2` / `rc.3` 和符合 `>=0.2.0-rc.2 <0.3.0` 的版本，预发布版本范围见 [package.json](package.json)。要求 Node.js `>=20.18`。

Desktop 先在 **应用 → 管理 dsh 命令** 安装桌面版 `dsh`：

```sh
dsh plugin --profile desktop add dsh-plugin-marketplace
```

Web 将 `desktop` 改为 `web`。安装后重启 DSH，打开 **插件 → 已安装 → dsh-plugin-marketplace**。也可通过 [Enhancement Suite](https://github.com/Scorp1o117/dsh-enhancement-suite) 安装。

## 使用

1. 浏览或搜索社区插件，阅读项目介绍和安装说明。
2. 在管理表单输入准确的 npm 包名，例如 `package-name` 或 `@scope/package-name`。
3. 安装、更新或确认卸载；检查返回的状态和错误。
4. 操作完成后重启 DSH。更新或卸载市场自身也需要重启。

Desktop 操作使用当前桌面宿主提供的 CLI 和包管理器，并作用于 Desktop Profile；Web 作用于对应 Web Profile。卸载旧式插件时会清理其手动挂载和配置补丁，保留其他 YAML 配置及注释。界面语言跟随 DSH。

## 开发与反馈

`npm test` 覆盖 Desktop 路径、安装更新、卸载清理、内置保护与失败处理。[npm](https://www.npmjs.com/package/dsh-plugin-marketplace) · [问题反馈](https://github.com/Scorp1o117/dsh-plugin-marketplace/issues) · [MIT License](LICENSE)。
