---
kind: logging_system
name: 基于 console 的原生日志输出（无结构化日志系统）
category: logging_system
scope:
    - '**'
source_files:
    - electron/main.ts
    - electron/database.ts
---

本仓库未引入任何第三方日志框架或统一的日志子系统。日志输出完全依赖 Node/Electron 原生的 `console.log`、`console.error`、`console.warn`，且仅集中在 Electron 主进程代码中：

- `electron/main.ts`：IPC 路由、数据库初始化、项目/实验创建等关键路径使用 `console.log`/`console.error`/`console.warn` 打印带 `[LabNote]` 前缀的调试信息。
- `electron/database.ts`：数据库打开、迁移、种子数据填充等操作同样以 `console.log` 输出。

渲染进程（`src/**/*`）中未发现任何 `console.*` 调用，说明前端层未直接输出日志。

该方式不具备以下能力：
- 无日志级别管理（info/warn/error/debug 区分仅靠不同方法名）
- 无结构化字段（纯字符串拼接，无法按字段检索）
- 无多 sink 路由（全部输出到标准输出/错误流）
- 无持久化文件落盘配置
- 无跨进程统一入口

因此，本项目在当前分支下不存在成型的 logging_system。