---
kind: dependency_management
name: npm 依赖管理与锁定策略
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - package-lock.json
    - electron-builder.yml
---

本仓库采用标准的 npm 包管理方案，基于 Node.js 生态的 npm + package-lock.json 锁定机制来管理 Electron + Vite + React 桌面应用的第三方依赖。

**使用的系统与工具**
- 包管理器：npm（由 package-lock.json lockfileVersion: 3 确认）
- 构建与打包：Vite（渲染进程）、electron-builder（主进程打包为 Windows NSIS 安装包）
- 脚本编排：concurrently + wait-on 并行启动开发服务器与 Electron 主进程

**关键文件**
- `package.json`：声明项目元信息、scripts、dependencies 与 devDependencies
- `package-lock.json`：npm v3 锁文件，记录所有依赖的精确版本与 integrity hash
- `node_modules/`：本地安装的依赖树（未提交到版本控制）
- `dist-electron/`：编译后的 Electron 主进程产物（由 tsc 生成）
- `electron-builder.yml`：electron-builder 打包配置，决定最终分发产物

**架构与约定**
1. **依赖分层清晰**：运行期依赖（react、better-sqlite3、drizzle-orm、smiles-drawer、ketcher-* 等）与开发期依赖（typescript、vite、electron、tailwindcss、@types/* 等）严格分离。
2. **Electron 双端依赖**：`main` 字段指向 `dist-electron/main.js`，表明主进程代码经 TypeScript 编译后输出到独立目录，与 Vite 构建的前端资源解耦。
3. **化学结构绘制依赖集中**：通过 ketcher-core/react/standalone 与 smiles-drawer 组合实现分子式编辑与展示，属于领域核心依赖。
4. **数据库层**：better-sqlite3（原生模块）+ drizzle-orm（类型安全 ORM），二者在 electron 主进程中协同工作。
5. **无私有源或 vendoring**：未发现 `.npmrc`、`pnpm-workspace.yaml`、`yarn.lock` 或 vendor 目录，全部依赖从公共 npm registry 拉取。
6. **无 engines 约束**：`package.json` 中未声明 `engines.node` 等运行时要求，环境差异风险由 CI 或开发者自行把控。
7. **lockfile 已提交**：`package-lock.json` 随源码入库，保证团队与 CI 安装结果一致。

**开发者应遵循的规则**
- 新增依赖时区分 `--save` / `--save-dev`，避免将构建工具误入生产依赖。
- 升级依赖后务必检查并更新 `package-lock.json`，禁止手动修改锁文件内容。
- 涉及原生模块（如 better-sqlite3）的升级需关注 node-gyp 重建与 Electron 版本兼容性。
- 使用 `npm run build` 统一触发渲染与主进程构建，不要跳过任一阶段直接运行 `electron .`。
- 若引入私有 npm 包，应在仓库根添加 `.npmrc` 并同步到版本库，确保可复现安装。