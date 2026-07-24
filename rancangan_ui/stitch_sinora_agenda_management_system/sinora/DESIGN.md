---
name: SINORA
colors:
  surface: '#f8f9ff'
  surface-dim: '#ccdbf3'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d5e3fc'
  on-surface: '#0d1c2e'
  on-surface-variant: '#434655'
  inverse-surface: '#233144'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#4059aa'
  on-secondary: '#ffffff'
  secondary-container: '#8fa7fe'
  on-secondary-container: '#1d3989'
  tertiary: '#943700'
  on-tertiary: '#ffffff'
  tertiary-container: '#bc4800'
  on-tertiary-container: '#ffede6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#dce1ff'
  secondary-fixed-dim: '#b6c4ff'
  on-secondary-fixed: '#00164e'
  on-secondary-fixed-variant: '#264191'
  tertiary-fixed: '#ffdbcd'
  tertiary-fixed-dim: '#ffb596'
  on-tertiary-fixed: '#360f00'
  on-tertiary-fixed-variant: '#7d2d00'
  background: '#f8f9ff'
  on-background: '#0d1c2e'
  surface-variant: '#d5e3fc'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-bold:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.2'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  sidebar_width: 280px
  grid_gutter: 20px
---

## Brand & Style
The design system for this agenda management application is rooted in the "Solid Creative Professional" aesthetic. It targets a high-stakes institutional environment where clarity, authority, and efficiency are paramount. The visual language rejects ephemeral trends like glassmorphism and heavy gradients in favor of a **Clean Modern Flat UI**.

The brand personality is disciplined yet forward-thinking. It uses an asymmetric structural layout to break the monotony of traditional administrative tools, creating a sense of dynamic organization. The UI evokes a sense of "structured creativity"—where the rigidity of the grid meets a modern, asymmetric composition to prioritize information hierarchy and ease of use.

## Colors
This design system utilizes a high-contrast, professional palette designed for long-form reading and rapid scanning. 

- **Primary & Secondary:** Corporate Royal Blue and Deep Navy form the backbone of the identity, used for navigational elements and primary actions to establish trust.
- **Accent:** Electric Sky Blue is used sparingly for interactive highlights and focus states to guide the eye without overwhelming the content.
- **Surface Strategy:** The UI primarily uses Clean Crisp White (#FFFFFF) for content cards, set against a Soft Cool Slate (#F8FAFC) canvas to provide clear separation without the need for shadows.
- **Status Indicators:** Solid, high-saturation fills are used for status badges to ensure immediate recognition of task priority and completion.

## Typography
The typography strategy relies on the interplay between the geometric friendliness of **Plus Jakarta Sans** for headings and the clinical precision of **Inter** for UI elements and body text.

- **Headlines:** Use Plus Jakarta Sans with heavy weights (700+) to create a strong editorial feel.
- **Body & Data:** Use Inter for all data-heavy sections and labels. The high x-height and neutral character ensure legibility at small sizes.
- **Contrast:** High contrast is maintained by pairing Deep Navy headings against White or Soft Slate backgrounds.

## Layout & Spacing
The layout follows an asymmetric card grid system. Unlike traditional uniform grids, cards are allowed to span varying heights and widths based on priority, creating a "dashboard-as-a-canvas" feel.

- **Sidebar:** A fixed 280px sidebar on the left. Active states are indicated by sharp "block" indicators (solid 4px vertical lines) in Royal Blue.
- **Main Canvas:** Uses a fluid layout with maximum-width containers for readability.
- **Rhythm:** An 8px base grid governs all padding and margins. 
- **Asymmetry:** Key information blocks (like "Today's Agenda") should occupy larger, non-standard column spans (e.g., 7 columns of a 12-column grid) to visually emphasize the current focus.

## Elevation & Depth
In alignment with the "Modern Flat UI" requirement, this design system **eschews shadows** for depth. Instead, hierarchy is established through:

- **Tonal Layering:** Using the difference between White (#FFFFFF) and Soft Cool Slate (#F8FAFC) to indicate surface levels.
- **Geometric Borders:** 1px solid borders in Subtle Gray (#E2E8F0) define card boundaries.
- **Sharp Overlays:** Modal windows and popovers use crisp, solid borders and high-contrast backdrops rather than blurs.
- **Active States:** Interactive depth is signaled by solid color changes (e.g., a button shifting from Royal Blue to Deep Navy on hover) rather than a lifting effect.

## Shapes
The shape language is "Soft" yet geometric. We use a consistent 0.25rem (4px) radius for standard components to maintain a modern feel without appearing overly "bubbly" or consumer-grade.

- **Standard Elements:** 4px radius (buttons, inputs, small cards).
- **Large Containers:** 8px radius (main dashboard cards).
- **Status Badges:** Completely square or 2px radius to emphasize their "solid" and functional nature.

## Components
- **Buttons:** Solid fills using Royal Blue. Sharp corners with a subtle 4px radius. No gradients. Text is Inter SemiBold in White.
- **Sidebar Navigation:** Navigation items use a clear Slate text. The active state features a background tint of #F1F5F9 and a solid 4px Royal Blue vertical block on the extreme left edge.
- **Asymmetric Cards:** White background, 1px Gray border, no shadow. Headers within cards use a subtle bottom border and Plus Jakarta Sans Bold.
- **Status Badges:** Small, rectangular blocks with solid color fills (Emerald, Amber, Rose). Text is white or high-contrast dark depending on the shade, always in "Label-Bold" typography.
- **Input Fields:** Solid White background with a 1px Slate border. On focus, the border thickens to 2px in Royal Blue.
- **Lists:** Data lists use alternating row colors (White and Off-White) rather than divider lines for a cleaner look.
- **Agenda Timeline:** A vertical 2px solid line in Slate with circular node indicators to represent the sequence of events in the agenda.