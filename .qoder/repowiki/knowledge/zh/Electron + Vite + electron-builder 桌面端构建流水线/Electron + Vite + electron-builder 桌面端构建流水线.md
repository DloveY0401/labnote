---
kind: build_system
name: Electron + Vite + electron-builder 桌面端构建流水线
category: build_system
scope:
    - '**'
source_files:
    - package.json
    - vite.config.ts
    - electron-builder.yml
    - tsconfig.node.json
    - tsconfig.json
    - scripts/strip-locales.js
    - scripts/launch-electron.js
---

## 构建系统概览

LabNote 采用 **Electron + Vite + React + TypeScript** 的桌面应用架构，通过 npm scripts 串联 Vite 渲染进程打包与 Electron 主进程编译，再由 electron-builder 生成 Windows NSIS 安装包。

## 核心构建流程

### 1. 双通道编译
- **渲染进程（Vite）**：`vite build` 将 `src/` 下的 React 代码打包到 `dist/`，使用 esbuild 压缩、按模块拆分 vendor chunk，base 设为相对路径 `./` 适配 Electron 本地加载。
- **主进程（TypeScript）**：`tsc -p tsconfig.node.json` 将 `electron/` 目录编译为 CommonJS 输出到 `dist-electron/`，独立于前端 TS 配置（tsconfig.json 仅做类型检查不输出）。

### 2. 开发模式
`npm run dev` 通过 concurrently 并行启动 Vite 热更新服务器与 Electron，wait-on 等待 Vite 就绪后再 launch Electron。自定义 `scripts/launch-electron.js` 绕过 npm 的 electron wrapper，直接调用原生二进制以支持 `--dev-server` 参数。

### 3. 打包与分发
- `npm run pack`：仅打包不签名，输出未压缩目录用于调试。
- `npm run dist`：完整打包流程，生成 `release/LabNote-Setup-${version}.exe`。
- electron-builder 配置在 `electron-builder.yml`，目标平台仅限 Windows x64，产物使用 asar 归档但排除 better-sqlite3 和 ketcher 静态资源。

## 关键约定与约束

- **入口文件**：`package.json#main` 指向 `dist-electron/main.js`，必须确保先执行 `build:electron`。
- **资源管理**：`public/ketcher/` 等静态资源由 Vite 原样复制到 `dist/`，无需 import。
- **语言包裁剪**：`afterPack` 钩子 `scripts/strip-locales.js` 在打包后删除除 zh-CN/en-US/en 外的所有 Electron locale 文件，减小安装包体积。
- **依赖清理**：electron-builder 显式排除构建工具链（typescript/vite/rollup/esbuild/drizzle-kit/postcss/tailwindcss 等），避免打入最终产物。
- **镜像加速**：通过 `electronDownload.mirror` 指定 npmmirror，解决国内下载 Electron 二进制缓慢问题。
- **TypeScript 工程引用**：根 tsconfig.json 通过 `references` 引用 tsconfig.node.json，实现前后端类型检查分离。

## 开发者注意事项

- 修改 Electron 主进程代码后需重新运行 `build:electron` 或 `build`。
- 开发时如需调试主进程，建议使用 `scripts/launch-electron.js` 而非直接 `electron .`。
- 新增 native addon 需在 `asarUnpack` 中声明，否则 asar 模式下无法加载。
- 版本号来自 package.json，安装程序文件名自动包含 version 字段。