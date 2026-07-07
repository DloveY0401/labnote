# LabNote 项目记忆

## 架构决策
- 2026-06-12: 实验编辑页面采用模块化架构。标准模块(9个)继续使用原有关联表(reactants/catalysts/solvents)，自定义模块使用 JSON 存储(experiment_module_data)。模块布局按实验保存在 experiments.module_layout 列中。
- 预置的自定义模块模板通过 is_preset=1 标记，不可删除。用户可通过 UI 创建自己的模块模板。

## 技术约定
- 数据库: 所有SQL通过Electron主进程的IPC handler执行，渲染进程通过preload暴露的window.labnote.* API访问。
- 图片: 使用labnote://images/协议，通过主进程的protocol.handle处理。
- 构建: renderer用Vite，electron main用tsc，两个build步骤。
- 依赖: 不添加外部UI/状态管理库，使用React内置hooks + Tailwind CSS。

## 已实现功能
- 化学实验全生命周期记录 (反应物/催化剂/溶剂/条件/步骤/后处理/结果)
- MW-用量-摩尔量联动换算 (g/mg/mL/mol/mmol)
- ChemDraw结构式粘贴
- 期刊格式导出 (ACS/JACS/Angewandte + 自定义模板)
- 实验模板系统
- 试剂库
- 课题管理 (含进度跟踪)
- 模块化实验编辑 (显示/隐藏/新增/排序/自定义)
