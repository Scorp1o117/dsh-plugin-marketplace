# dsh-plugin-marketplace

浏览 GitHub 的 dsh-plugin 插件，同时管理当前 DSH Web / Desktop Profile 的插件。0.5.2 需要 DSH 0.2.0-rc.2 或后续 0.2.x。

```sh
dsh plugin --profile desktop add dsh-plugin-marketplace@0.5.2
```

使用 Desktop 提供的 dsh 命令（应用 → 管理 dsh 命令）；Web 改用 --profile web。重启后打开 **插件 → 已安装 → dsh-plugin-marketplace** 配置页。

## 插件管理

展示当前 Profile 的直接依赖与内置 bundle。输入 npm 包名（支持 @scope/name）即可安装；每个已安装插件可以更新到最新版或二次确认卸载，还可刷新列表。更新明确安装 package@latest，能跨过旧版本锁定。内置 bundle 标明由 DSH 自身管理，不能在此覆盖或卸载。间接依赖库不作为独立插件显示。

Desktop 使用当前宿主携带的 Electron CLI、包管理器与 Desktop Profile。套件和市场的操作按 Profile 串行执行；操作后重新读取真实安装状态，失败时展示错误与部分完成的状态。安装、更新、卸载后需要重启 DSH；市场自身更新或卸载也适用。

DSH 负责 bundle 的挂载与移除；卸载旧式插件时会结构化清理手动挂载及其配置补丁，保留其它 YAML 配置和注释。设置请求在 HMR 事务外消费，并在卸载插件后取消待处理工作。

保留关键词搜索、Star / 更新时间排序、README 预览和使用当前模型的 AI 解释。仓库名未必等于 npm 包名，请核对作者说明；也可直接在管理表单输入实际包名。中英文跟随 DSH。

运行 npm test 验证 Desktop 路径、HMR、版本更新、卸载清理、内置保护、失败行为与串行执行。
