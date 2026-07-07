---
kind: frontend_style
name: Tailwind CSS 原子化样式体系与桌面端主题规范
category: frontend_style
scope:
    - '**'
source_files:
    - tailwind.config.js
    - src/styles/index.css
    - postcss.config.js
    - index.html
    - src/components/Layout.tsx
    - src/components/TaskForm.tsx
    - src/pages/ExperimentList.tsx
---

## 1. 系统与方法论
- 基于 **Tailwind CSS** 的原子化（utility-first）样式方案，通过 `postcss.config.js` 启用 Tailwind + Autoprefixer。
- 采用 Tailwind 的 `@layer base / components / utilities` 分层组织：全局基础样式、可复用组件类、以及直接使用 utility class 的页面/组件代码。
- 无 SCSS/Less 预处理器，所有自定义样式集中在 `src/styles/index.css`，组件内以 JSX `className` 直接拼接 Tailwind utility 字符串。

## 2. 关键文件与包
- `tailwind.config.js` — 设计令牌集中地：颜色、字体族、字号、间距、圆角、阴影等全部在此扩展。
- `src/styles/index.css` — 注入 Tailwind 指令、定义全局 base 层（字体、滚动条、box-sizing）、以及一组高层组件类（`.btn-*`、`.input-field`、`.card`、`.section-title`）。
- `postcss.config.js` — 构建期 PostCSS 插件配置。
- `index.html` — 入口 HTML，body 上设置默认文字色与字体族。
- 各 `src/components/*.tsx`、`src/pages/*.tsx` — 大量直接使用 Tailwind utility 组合实现布局与交互态。

## 3. 架构与设计约定
### 设计令牌（Design Tokens）
- **色彩**：仅扩展了 `primary` 色系（50/100/500/700），其余使用 Tailwind 内置 gray/red/blue 等语义色；组件内部也直接使用 `#ef4444`、`#3b82f6` 等十六进制值作为标签预设色。
- **字体**：`fontFamily.sans` 覆盖为系统栈（-apple-system / Segoe UI / Microsoft YaHei），并额外定义 `h1/h2/body/label/caption` 四级字号，统一在 `fontSize` 中声明。
- **间距**：自定义 `xs/sm/md/lg/xl/2xl` 映射到 4–24px，组件普遍使用这些 token 而非任意像素值。
- **圆角/阴影**：`sm/md/lg` 圆角与 `shadow-card` 卡片阴影构成统一的视觉深度层级。

### 组件级样式约定
- 按钮家族：`.btn-primary`（主操作）、`.btn-secondary`（次级）、`.btn-danger`（危险）、`.btn-ghost`（幽灵按钮）在 `@layer components` 中统一定义，并在 JSX 中以 `className="btn-primary"` 复用。
- 表单控件：`.input-field` / `.select-field` 提供一致的边框、聚焦环、禁用态；但实际组件中也广泛使用 `className="input w-full"` 这类更短别名，说明存在未纳入 index.css 的输入样式来源（可能由 Vite/Tailwind 扫描到的其他 CSS 或第三方库注入）。
- 容器：`.card` 封装白底+边框+阴影，配合 `p-xl`、`rounded-lg` 等 utility 形成标准卡片模式。
- 动画：仅定义了 `fade-in` 关键帧及 `.animate-fade-in` 工具类，用于轻量入场动效。

### 布局策略
- 整体采用 Flex 布局：`Layout.tsx` 用 `flex h-screen overflow-hidden` 固定侧边栏+主内容区，主区域 `flex-1 overflow-y-auto bg-gray-50` 承载页面内容。
- 响应式：未见 `@media` 断言，主要依赖 Tailwind 默认的移动端优先策略与弹性布局自适应；窗口尺寸变化通过 Electron 渲染进程自行处理。

## 4. 开发者应遵循的规则
1. **优先使用 Tailwind utility**：布局、间距、颜色、字号一律通过 `className` 中的 utility 组合完成，避免新增独立 CSS 类。
2. **新增设计令牌走 `tailwind.config.js`**：任何新颜色、字号、间距都应先扩展 theme，再在组件中使用对应 utility（如 `text-h1`、`bg-primary-500`）。
3. **复用已有组件类**：按钮、卡片、输入框优先使用 `.btn-primary`、`.card`、`.input-field` 等已定义类，保持视觉一致性。
4. **禁止硬编码像素间距**：使用 `spacing.*` 定义的 `xs/sm/md/lg/xl/2xl` 代替 `px-12`、`mt-4` 等原始数值。
5. **全局样式只放在 `src/styles/index.css`**：不得在组件文件中引入独立 CSS 模块或 style tag。
6. **交互态通过 utility 修饰符表达**：hover/focus/disabled 等状态使用 `hover:xxx`、`focus:ring-1 focus:ring-primary-100`、`disabled:opacity-50` 等写法，不在 JS 中切换 className。