# 阳光出行 Web Portal Design 2.0

## Style Prompt

高级橙色出行门户，像一块透明的车载中控屏悬浮在暖光城市地图上。画面第一眼必须是“正在调度车辆”的产品体验，而不是普通宣传页。Figma 负责组件一致性和设计 token，Canva 负责品牌版式与展示张力，HyperFrames 负责镜头级入场、节奏、层次和流动动效，React Bits 负责鼠标磁吸、液态背景、光晕跟随和交互反馈。整体必须是网页产品，不复刻小程序。

## Colors

- Brand orange: `#ff7a00`
- Deep orange: `#f05a00`
- Amber light: `#ffd08a`
- Ink: `#1f2937`
- Night ink: `#111827`
- Teal accent: `#00a896`
- Cyan signal: `#5eead4`
- Warm canvas: `#fff7ed`
- Glass surface: `rgba(255,255,255,0.66)`
- Route shadow: `rgba(255,122,0,0.28)`

## Typography

- UI font stack: `Inter`, `HarmonyOS Sans SC`, `Microsoft YaHei`, system sans-serif.
- Hero: strong weight, compact line-height, no negative letter spacing.
- Panels: smaller operational text, clear hierarchy, dense but breathable.
- Operational HUD text: 11-13px uppercase labels, high contrast, never decorative-only.

## Motion

- Primary easing: `cubic-bezier(.2,.9,.2,1)`.
- Hero stage loops slowly like a video composition, not a fast banner.
- Interactive elements respond to cursor with magnetic translation, glare, moving water rings, and a tiny taxi cursor follower.
- Liquid refraction is implemented as moving highlights and canvas ripples layered over glass, not by distorting readable text.
- Map route uses moving vehicles, signal rings, route glow, and floating HUD chips.
- Respect `prefers-reduced-motion` by pausing loop-heavy effects.

## Interaction Level

- L3 immersive for the portal hero: pointer-reactive water, dynamic route map, active dispatch HUD.
- L2 for workbenches: smooth hover, active tab transitions, dynamic status chips.
- No scroll hijacking. Native scroll stays clean.

## What Not To Do

- Do not copy miniapp layout.
- Do not use a flat orange-only palette.
- Do not place panels inside panels.
- Do not use marketing-only sections instead of usable login/workbench flows.
- Do not let liquid effects make text fuzzy or unreadable.
- Do not modify files outside `D:\xiaochengxu\html`.
