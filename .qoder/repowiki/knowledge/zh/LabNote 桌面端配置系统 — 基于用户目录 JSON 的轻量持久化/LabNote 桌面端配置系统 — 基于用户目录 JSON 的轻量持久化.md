---
kind: configuration_system
name: LabNote 桌面端配置系统 — 基于用户目录 JSON 的轻量持久化
category: configuration_system
scope:
    - '**'
source_files:
    - electron/main.ts
    - config.json
    - electron-builder.yml
    - vite.config.ts
    - package.json
---

## 系统概述
LabNote 采用极简的「用户目录 JSON 文件」作为运行时配置方案，由 Electron 主进程在启动时加载并维护，用于存储应用级设置（当前仅 `dataPath`）。该方案不依赖第三方配置库，全部逻辑内联于 `electron/main.ts`。

## 核心机制
- **配置文件路径**：`app.getPath('userData') + '/config.json'`，即 Windows 下通常为 `%APPDATA%/LabNote/config.json`。
- **加载流程**：`loadConfig()` 尝试读取并解析 JSON；若不存在或解析失败则返回空对象 `{}`。
- **保存流程**：`saveConfig()` 使用 `fs.writeFileSync` 写入，自动创建父目录。
- **数据目录决策**：`ensureDataPath()` 优先使用已保存的 `dataPath`，首次启动时回退到 `~/Documents/LabNoteData` 并立即持久化。
- **热更新**：通过菜单「选择数据库位置...」可动态切换 `dataPath`，随后重新初始化 SQLite 并通过 IPC 通知渲染进程。

## 关键文件与职责
| 文件 | 角色 |
|---|---|
| `electron/main.ts` | 配置读写、数据目录管理、菜单触发迁移的核心实现 |
| `config.json` | 仓库根目录的默认/示例配置（仅含 `dataPath: "LabNoteData"`，实际运行中位于 userData） |
| `electron-builder.yml` | 打包阶段排除开发依赖、asar 打包策略、NSIS 安装器行为等构建期配置 |
| `vite.config.ts` | 前端构建配置（别名 `@` → `src`、分包策略），不参与运行时配置 |
| `package.json` | 脚本入口 `dist-electron/main.js`，定义 dev/build/pack/dist 生命周期 |

## 架构约定与设计决策
1. **单源配置**：所有应用级设置集中在一个 JSON 文件中，避免多来源合并复杂度。
2. **惰性初始化**：首次启动不阻塞用户，直接创建默认目录并静默保存。
3. **安全隔离**：自定义协议 `labnote://` 对 `dataPath` 下的资源访问做路径穿越校验（`resolved.startsWith(dataPath)`）。
4. **前后端解耦**：配置变更通过 `ipcMain.handle('app:getDataPath')` 和 `app:dataPathChanged` 事件桥接至渲染层。
5. **构建期 vs 运行期分离**：`electron-builder.yml` 控制产物打包，`config.json` 控制运行时行为，互不干扰。

## 开发者应遵循的规则
- 新增应用级设置时，应在 `AppConfig` 接口扩展字段，并在 `loadConfig`/`saveConfig` 中保持向后兼容（缺失字段视为 undefined）。
- 修改 `dataPath` 后必须调用 `initDatabase(newPath)` 并重新注册 IPC 处理器，同时广播 `app:dataPathChanged` 事件。
- 不要在前端直接读写 `config.json`，所有配置操作必须经由主进程 IPC。
- 生产环境 `config.json` 随应用数据存放于用户目录，不应纳入版本控制。