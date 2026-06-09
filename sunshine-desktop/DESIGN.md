# Sunshine Desktop Design

## Overview

Sunshine Desktop is a restrained Windows desktop product UI inspired by Apple platform smoothness: quiet surfaces, soft spatial transitions, precise controls, and a single warm brand accent. It is not a marketing page. The first screen is the usable cockpit.

## Color

- Background: neutral cool gray `#f5f7fb` with a slight top warmth only near the title surface.
- Surface: `#ffffff`, secondary surface `#f8fafc`, elevated surface `rgba(255,255,255,0.86)`.
- Text: primary `#162033`, secondary `#647083`, tertiary `#8a94a6`.
- Brand accent: Sunshine orange `#ff7a18`, strong orange `#f15a24`, soft orange `rgba(255,122,24,0.12)`.
- Supporting states: success `#16a34a`, warning `#d97706`, danger `#dc2626`, info `#2563eb`, map green `#0f9f6e`.

## Typography

Use the native stack: `Inter`, `Segoe UI`, `PingFang SC`, `Microsoft YaHei`, `system-ui`, sans-serif. Keep product UI type stable and non-fluid. Use 12/13/14/16/18/22/28/34 px steps. Data uses tabular numbers.

## Layout

- App shell: custom title bar, left rail, main workspace, right contextual rail when helpful.
- Role switcher: segmented control for Passenger, Driver, Operations.
- Surface radius: 16px for panels, 12px for inputs and compact cards, full pill only for chips and segmented controls.
- Desktop target: 1440x900. Minimum supported app window: 1180x760. Responsive behavior collapses dense grids before text overflows.
- Dispatch status: when the right rail is hidden at the 1180px and narrow breakpoints, the main workspace status strip must keep dispatch confidence, next action, and service write mode visible above the primary workspace content.

## Components

- Buttons: icon plus label for primary commands; icon-only only for window controls and utility commands with labels.
- Tables: compact, plain, zebra-free with hover and sticky-ish headers where needed.
- Cards: only for individual objects such as order, coupon, message, driver, and system health. No cards inside cards.
- Timeline: order and audit states use a horizontal/vertical timeline with text labels and non-color cues.
- Forms: visible labels, helper text, inline validation text, disabled/loading states.
- Visual asset: `src/assets/dispatch-city-visual.png` is the shared dispatch-city image. It is used behind hero panels and route maps with low opacity so controls and text remain dominant.
- Context rail: live activity should explain the current order, dispatch confidence, SLA, rule reason, queue status, and next recommended action. It must feel like an operations instrument, not a decorative sidebar. The compact workspace strip reuses the same dispatch decision source so responsive and wide layouts stay consistent.

## Motion

Motion duration is 150-260 ms. Use opacity and transform only. Role and view changes slide 8-12 px with ease-out. Button press scales to 0.985. Respect `prefers-reduced-motion`.

## Interaction

Primary flows should work with mouse and keyboard. The command/search field filters visible features and opens an executable command center for role switching, view jumps, and high-frequency business actions. Switching roles keeps the previous role state in memory. Offline mode is explicit and reversible. Recent actions stay visible in the contextual rail so a toast is not the only feedback channel.

## QA Targets

- Desktop primary viewport: 1440x920.
- Electron minimum viewport: 1180x760.
- Narrow responsive fallback: 760px wide with no page-level horizontal scrolling and no clipped button text.
