---
kind: error_handling
name: 错误处理：无统一架构，依赖原生 try/catch 与 Toast 提示
category: error_handling
scope:
    - '**'
source_files:
    - src/components/Toast.tsx
    - electron/main.ts
    - electron/preload.ts
    - electron/database.ts
    - electron/export.ts
    - src/db/queries.ts
---

经对仓库源码进行检索与分析，该工程未发现任何统一的错误处理体系。具体表现如下：

1. **未定义自定义 Error 类型**：全仓未出现 `class.*Error`、`extends Error` 或集中式错误码/枚举定义，所有异常均以裸 `throw new Error(...)` 形式抛出。
2. **无全局捕获机制**：主进程（`electron/main.ts`）与渲染进程入口（`src/main.tsx`）均未注册 `window.onerror`、`unhandledrejection` 等全局兜底处理器；Electron 主进程也未监听 `uncaughtException` / `unhandledRejection` 事件。
3. **UI 层仅用轻量 Toast**：前端通过 `src/components/Toast.tsx` 提供一次性消息气泡，用于展示用户可感知的错误信息，但并未封装为统一的 error boundary 或拦截器。
4. **IPC 层无错误约定**：`electron/preload.ts` 暴露的 IPC 桥接方法未对底层调用做结构化错误包装，上层组件直接 catch 原始 Error。
5. **数据库与导出模块**：`electron/database.ts`、`electron/export.ts` 以及 `src/db/queries.ts` 中的失败路径以 `try/catch` + console 日志为主，未返回统一错误对象。

综上，该项目处于“无系统化错误处理”状态——错误在调用链中自然冒泡至最外层，由 Toast 组件做最小化用户可见反馈，缺乏错误分类、上报、恢复策略与跨进程一致性约定。