# LabNote - 化学实验室电子记录本

LabNote 是一款专为化学实验室设计的电子实验笔记本（ELN），基于 Electron 架构，支持完全离线使用。提供模块化的实验记录、分子结构编辑、试剂库管理、任务日程等功能。

## ✨ 核心功能

- **项目与实验管理**：组织项目、关联实验、支持多维度查询
- **模块化实验记录**：包含 9 个标准模块 + 自定义模块支持
  - 反应条件、试剂、溶剂、催化剂等标准模块
  - 支持拖拽排序和自定义字段
- **分子结构编辑**：集成 Ketcher 编辑器，支持结构绘制和 SMILES 解析
- **试剂库管理**：维护可复用的试剂、溶剂等物质数据
- **实验模板系统**：快速创建标准化实验记录
- **任务与日程管理**：支持任务创建、子任务、循环任务、关联实验
- **桌面小组件**：Windows 桌面底层嵌入，快速记录和查看任务
- **纯本地离线**：所有数据存储在本地 SQLite 数据库，无需网络连接

## 🚀 快速开始

### 系统要求

- Node.js >= 18.0
- npm >= 9.0
- Windows 10 或更高版本（桌面小组件功能需要）

### 安装与开发

```bash
# 克隆仓库
git clone https://github.com/DloveY0401/labnote.git
cd labnote

# 安装依赖
npm install

# 启动开发模式
npm run dev

# 构建生产版本
npm run build

# 打包成安装程序
npm run dist
```

### 开发模式验证

启动 `npm run dev` 后，检查控制台日志中是否出现：
```
[widget] Embedded into desktop successfully
```
此日志确认桌面小组件已成功嵌入到 Windows 桌面底层。

## 📦 项目结构

```
labnote/
├── electron/              # Electron 主进程
│   ├── main.ts           # 主窗口和小组件初始化
│   ├── database.ts       # 数据库操作
│   ├── export.ts         # 导出功能
│   └── preload.ts        # 预加载脚本
├── src/                   # React 前端代码
│   ├── pages/            # 页面组件
│   │   ├── ProjectManager.tsx     # 项目管理
│   │   ├── ExperimentEdit.tsx     # 实验编辑
│   │   ├── WidgetPage.tsx         # 小组件页面
│   │   ├── StructureDraw.tsx      # 结构编辑
│   │   └── ...
│   ├── components/       # 通用组件
│   ├── modules/          # 模块化表单系统
│   ├── db/               # 数据库 schema 和查询
│   ├── utils/            # 工具函数
│   └── styles/           # 样式文件
├── public/               # 静态资源
│   └── ketcher/          # Ketcher 编辑器
├── package.json          # 项目配置
├── electron-builder.yml  # 打包配置
├── vite.config.ts        # Vite 构建配置
└── tsconfig.json         # TypeScript 配置
```

## 🔧 技术栈

- **前端框架**：React 18 + TypeScript
- **构建工具**：Vite 5 + Electron Builder
- **样式**：Tailwind CSS
- **数据库**：SQLite + better-sqlite3 + Drizzle ORM
- **化学编辑器**：Ketcher
- **分子解析**：SMILES Parser
- **路由**：React Router
- **UI 组件**：原生 HTML + Tailwind CSS

## 📝 主要特性

### 模块化表单系统

实验记录支持 9 个标准模块，可自定义添加：

| 模块名 | 说明 |
|------|------|
| 反应条件 | 温度、压力、时间等基本反应参数 |
| 试剂 | 起始物、试剂、添加剂等 |
| 溶剂 | 反应溶剂、用量等 |
| 催化剂 | 催化剂类型、用量、性质 |
| 产物 | 产物信息、产率、物理性质 |
| 备注 | 自由文本备注 |
| 图片 | 支持图片上传和粘贴 |
| 特殊字段 | 自定义字段 |

### 分子结构支持

- 集成 Ketcher 编辑器，支持分子结构绘制
- 支持 SMILES 字符串解析和转换
- 支持结构图片导出

### 数据持久化

- 所有数据存储在本地 SQLite 数据库
- 支持自定义数据存储路径（设置 → 选择数据库位置）
- 自动数据库迁移和备份

### 桌面小组件

- 原生 Windows 集成，嵌入桌面底层
- 支持快速任务记录和查看
- 透明窗口，圆角设计
- 可调整窗口大小（最小 200x200，最大 800x900）

## 🔐 数据安全

- 完全离线，无云同步或数据上传
- 所有数据存储在本地用户目录
- 支持自定义数据存储路径

## 📦 构建与发布

### 开发构建

```bash
npm run dev
```

### 生产构建

```bash
npm run build        # 仅编译
npm run build:renderer  # 前端构建
npm run build:electron  # Electron 主进程编译
```

### 打包

```bash
npm run pack         # 创建未打包版本
npm run dist         # 生成 NSIS 安装程序
```

生成的安装程序位于 `release/LabNote-Setup-1.0.0.exe`

## 🛠️ 常见问题

### Q: 数据存储在哪里？
A: 默认存储在 `C:\Users\<用户名>\Documents\LabNoteData` 目录。可通过菜单"设置 → 选择数据库位置"更改。

### Q: 如何导出数据？
A: 点击菜单中的导出功能，支持导出为 JSON、CSV 等格式。

### Q: 小组件嵌入失败？
A: 
1. 确保使用的是 Windows 10 或更高版本
2. 重启应用
3. 检查控制台日志中是否有错误信息

### Q: 支持离线使用吗？
A: 是的，LabNote 完全离线使用，无需网络连接。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 👨‍💻 开发者

LabNote 由化学实验室开发者精心打造，旨在提高实验记录的效率和规范化。

## 📞 支持

如有问题或建议，请在 GitHub 中提交 Issue。

---

**最后更新**: 2026-07-06
**版本**: 1.0.0
