---
name: ClaimChain
description: Dark merchant workspace for evidence, recovery, payments, and stock handoffs.
colors:
  operational-black: "#000000"
  operational-surface: "#0c100e"
  operational-sidebar: "#080b09"
  operational-line: "#242b27"
  operational-ink: "#edf3ef"
  operational-muted: "#9aa89f"
  landing-black: "#000000"
  landing-ink: "#f7f7f4"
  landing-accent: "#78b896"
  landing-accent-hover: "#96cbaa"
  ink: "#25332d"
  muted: "#69766f"
  muted-effective: "#617267"
  line: "#e6eae7"
  green: "#167451"
  green-dark: "#105c40"
  surface: "#fff"
  canvas: "#f7f9f8"
  sidebar: "#f3f6f4"
  sidebar-line: "#e1e7e3"
  nav-text: "#617167"
  nav-hover: "#eaf0ec"
  nav-active: "#e0ece4"
  nav-active-text: "#155a3e"
  button-line: "#dce3de"
  button-hover: "#f2f6f3"
  field-line: "#dce4de"
  field-readonly: "#f6f8f6"
  field-readonly-text: "#85918a"
  placeholder: "#697b70"
  focus: "#69aa91"
  selection: "#d5eadf"
  selection-text: "#164b37"
  table-head: "#fafbf9"
  table-row-line: "#edf0ed"
  status-open: "#607085"
  status-open-bg: "#eff3f8"
  status-progress: "#815b19"
  status-progress-bg: "#faf2df"
  status-success: "#326d43"
  status-success-bg: "#e9f4eb"
  status-transit: "#4b6da4"
  status-transit-bg: "#ebf1fc"
  status-cancelled: "#606860"
  status-cancelled-bg: "#f2f2f1"
  overdue: "#ac5632"
  overdue-caption: "#94502c"
  danger: "#9a402b"
  danger-line: "#ddb8ac"
  connection-error: "#9a422c"
  balance-bg: "#f5f8f5"
  balance-line: "#e1e9e1"
  balance-settled: "#eff8f0"
  payment-fill: "#478563"
  inventory-line: "#e0e7e1"
  stock-available: "#3f6e51"
  stock-available-bg: "#eef6ef"
  stock-expired: "#9a452b"
  stock-expired-bg: "#fbefeb"
  identity-olive: "#56632f"
  identity-olive-bg: "#e9ece1"
  identity-blue: "#3f6384"
  identity-blue-bg: "#e4edf4"
  identity-tan: "#80582f"
  identity-tan-bg: "#f2e8de"
  identity-violet: "#6e5687"
  identity-violet-bg: "#ede8f2"
typography:
  landing-display:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "82px"
    fontWeight: 780
    lineHeight: 0.98
    letterSpacing: "0"
  landing-mono:
    fontFamily: '"IBM Plex Mono", monospace'
    fontSize: "11px"
    fontWeight: 500
    letterSpacing: "0"
  body:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "14px"
    fontWeight: 500
    letterSpacing: "0"
  headline:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "27px"
    fontWeight: 750
    lineHeight: 1.35
    letterSpacing: "0"
  title:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "16px"
    fontWeight: 750
    lineHeight: 1.5
    letterSpacing: "0"
  metric:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "29px"
    fontWeight: 750
    lineHeight: 1.3
    letterSpacing: "0"
  label:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0"
  navigation:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "13px"
    fontWeight: 650
    letterSpacing: "0"
  badge:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "10px"
    fontWeight: 700
    letterSpacing: "0"
rounded:
  pill: "999px"
  micro: "3px"
  tag: "4px"
  control: "5px"
  panel: "6px"
  item: "7px"
  dialog: "8px"
  circle: "50%"
spacing:
  gap-4: "4px"
  gap-5: "5px"
  gap-7: "7px"
  gap-8: "8px"
  gap-10: "10px"
  gap-12: "12px"
  gap-15: "15px"
  gap-16: "16px"
  gap-18: "18px"
  gap-20: "20px"
  gap-24: "24px"
  gap-25: "25px"
  gap-28: "28px"
  gap-36: "36px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  button-primary-hover:
    backgroundColor: "{colors.green-dark}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 11px"
  navigation-active:
    backgroundColor: "{colors.nav-active}"
    textColor: "{colors.nav-active-text}"
    typography: "{typography.navigation}"
    rounded: "{rounded.control}"
    padding: "12px 13px"
  badge-progress:
    backgroundColor: "{colors.status-progress-bg}"
    textColor: "{colors.status-progress}"
    typography: "{typography.badge}"
    rounded: "{rounded.tag}"
    padding: "4px 7px"
  inventory-item:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.item}"
    padding: "21px"
  balance-panel:
    backgroundColor: "{colors.balance-bg}"
    rounded: "{rounded.panel}"
    padding: "20px"
---

# Design System: ClaimChain

## Overview

**Creative North Star: "A precise recovery workbench"**

ClaimChain is a dark merchant operations workspace: exact-black page canvases, near-black work surfaces, pale text, green actions, and blue and amber workflow states. Manrope, compact navigation, ruled registers, and restrained panels establish a practical, information-dense environment. The signature case view places evidence beside live payment reconciliation.

The public landing route establishes the brand surface: pure black, white halftone evidence imagery, Manrope display copy, IBM Plex Mono captions, and a softened green. The operational workspace continues the same black canvas with lifted near-black controls and panels.

This is an observed implementation record, not a proposed redesign. Authority is `src/styles.css` including its final dark-theme overrides, followed by the rendered components in `src/App.tsx`, `src/lib.tsx`, `src/CasePage.tsx`, `src/StockPage.tsx`, and `src/main.tsx`. `PRODUCT.md` supplies product context; the direction contract in `index.html` agrees with the implemented dark workspace. Reviewed images: `.impeccable/review/desktop.png`, `mobile.png`, `case-desktop.png`, and `stock-desktop.png`. The requested extension file is `.impeccable/design-system.json`; no alternate sidecar is assumed.

**Key Characteristics:**

- Exact-black canvases, near-black surfaces, and fine dividers organize the workspace.
- Green identifies primary actions and recovery progress.
- Dense registers, explicit status labels, and aligned financial figures support scanning.
- Evidence, balances, and next actions share the case workspace.
- Restrained motion and native controls support repeat operations.

## Colors

The frontmatter records reused source values, including literal colors that are not CSS variables. It is a selected reusable vocabulary, not an exhaustive list of every one-off declaration. Only ink, muted, line, green, green-dark, surface, and ease are declared root custom properties.

### Primary

Green fills primary actions, accents the brand, marks selected views, and colors recovered amounts. Green-dark supplies primary-button and text-link hover feedback. The theme-color metadata uses the same green. Focus and selection use their own lighter greens.

### Secondary

Blue-gray represents open cases; amber represents in-progress cases and reservations; green represents resolved cases and received transfers; blue represents dispatch; gray represents cancellation. Every badge includes text and a current-color dot. Available and expired inventory use separate stock-tag pairs. Overdue amounts and overdue captions intentionally use different warm colors.

The four identity pairs repeat by list index for counterparty initials and product symbols. They are visual differentiation, not status or fixed category mappings.

### Neutral

An exact-black main canvas sits beside a subtly lifted fixed sidebar. Fine dark-neutral borders separate metrics, tables, rails, and form regions. Pale primary text and brighter muted text preserve hierarchy and WCAG AA contrast on black surfaces.

**The Cascade Rule.** Resolve specificity and source order before reusing a value; earlier small, pale labels are not the final defaults. Active-view text remains green because its selector is more specific than the late muted-text override.

## Typography

Manrope Variable is imported locally through `@fontsource-variable/manrope`; the only fallback is sans-serif. The root is 14px/500, with no root line-height declaration. All elements receive zero letter spacing. Font synthesis is disabled, text rendering is optimizeLegibility, and WebKit antialiasing is enabled. There is no separate display or monospaced family and no modular type scale.

| Role             | Implemented treatment                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| Page heading     | Headline token; 23px at <=760px                                                                 |
| Section heading  | Title token; section-title headings become 15px at <=760px                                      |
| Subheading       | 15px, line-height 1.5; no explicit global h3 weight                                             |
| Brand            | 22px/800, reducing to 20px at <=1250px, including the mobile drawer                             |
| Metric           | Metric token; 33px at >=1550px, 26px at <=1250px, 28px at <=760px, 26px at <=470px              |
| Balance          | 30px/750; 26px at <=1250px and 25px at <=760px                                                  |
| Operational text | Most buttons, links, field labels, row titles, and view switches are 12px after final overrides |
| Navigation       | 13px; primary nav weight 650                                                                    |
| Metadata         | Mostly 10px after final overrides; full activity descriptions retain 12px through specificity   |
| Badge            | 10px/700; transfer-header badges remain 8px at <=760px                                          |
| Form control     | 12px/500; field inputs, selects, and textareas become 16px at <=760px                           |
| Paragraph        | Line-height 1.7; selected prose and field textareas use 1.8                                     |
| Letter editor    | 12px, line-height 1.9; 11px at <=760px, independent of the field-control rule                   |

Metrics, monetary table cells, and balances use tabular numerals. Money is formatted with en-IN grouping and INR, with zero decimals for whole rupees and two otherwise. Case descriptions have a 72ch maximum; filenames, titles, and long evidence text wrap with overflow-wrap anywhere. Case subtitles ellipsize within explicit maximum widths.

## Layout

The desktop shell uses a fixed 238px sidebar, matching main offset, and 70px topbar. Main content has a 1700px maximum width, automatic horizontal margins, and padding 33px 36px 0. The sidebar has padding 30px 16px 0. Main sections remain unframed; borders and spacing organize them.

The metric band uses columns 1.2fr 1.1fr 1fr 1fr, vertical padding 24px, and 34px bottom margin. Overview content uses minmax(0, 1fr) plus a 265px action rail with 28px gap; the rail has a left divider and 25px inset. Cases use a 300px rail with 36px gap and 28px inset. Stock uses three equal minmax(0, 1fr) columns with 20px gaps. Settings use 1.1fr 1fr with 70px gap and 1100px maximum width.

Spacing is intentionally mixed, not an inferred 4px or 8px grid. The frontmatter names observed recurring gaps; individual component paddings remain exact. Form pairs stay in two equal columns even on narrow screens (15px gap, 10px at <=470px).

| CSS query         | Effective changes                                                                                                                                                                                                                                                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| min-width: 1550px | Main padding 40px 48px 0; topbar horizontal padding 48px; overview rail 300px with 36px gap and 32px inset; stock four columns. The early 21px table-cell padding is overridden to 18px later.                                                                                                                                                                 |
| max-width: 1250px | Sidebar/main offset 214px; sidebar horizontal padding 12px; main 28px 26px 0; topbar horizontal padding 26px; overview rail 224px/gap 20px; case rail 260px/gap 24px; case facts and stock summary two columns; stock two columns.                                                                                                                             |
| max-width: 1050px | Overview becomes one column; action rail moves below into 1.2fr 1fr columns. Metrics become two columns with 25px row gap. Cases become one column with the two-column action/balance rail visually before the main content; follow-ups span both rail columns. Settings becomes one main column with a two-column aside.                                      |
| max-width: 760px  | Sidebar becomes a 238px off-canvas drawer; main offset 0; topbar 60px with 18px side padding; main 24px 20px 0. Tables retain 555px minimum width inside horizontal scrollers. Search becomes full width, filters wrap, settings aside becomes one column. Inventory remains two columns with 14px gap and 17px item padding. Icon buttons become 34px square. |
| max-width: 470px  | Page heading/actions wrap, actions use full width and align left. Overview action rail becomes block flow. Inventory and case rail become one column. Case main returns visually before its rail. Local-save status hides; form pairs remain two columns.                                                                                                      |

CSS ordering of the case regions changes only their visual order, not DOM or keyboard order. Table and view-switch overflow stays within its own horizontal container. Long page headings wrap; action groups wrap on mobile. The supplied mobile screenshot shows the table's horizontal continuation, not a replacement card view.

## Elevation & Depth

Flat surfaces and 1px dividers carry most depth. Inventory and transfer items have borders without shadows. Only primary buttons (`0 2px 3px #173f2310`) and dialogs (`0 24px 90px #142f2933`) declare box shadows. Dialog backdrop is `#1c30284d`; mobile navigation backdrop is `#1d352949`. No gradients or backdrop blur are implemented.

The sidebar is z-index 30, its mobile backdrop 29; skip-link and connection error are 100. Sticky dialog header and footer use z-index 2 inside the native dialog's top layer.

Motion is functional: buttons transition background and color over 150ms with default CSS ease, and transform over 150ms with `cubic-bezier(0.23, 1, 0.32, 1)`. Pressed enabled buttons translate down 1px. The mobile drawer transforms over 180ms with that curve; the payment meter scales from the left over 200ms. Busy indicators rotate once per second, linearly and infinitely. Skeletons are static. Reduced-motion disables all animations and transitions, including pseudo-elements, and sets scroll-behavior to auto with important declarations; it does not remove the static pressed transform.

## Shapes

Corners stay compact: 3px micro counters/meters, 4px badges/check controls, 5px buttons/inputs/navigation, 6px balance/upload panels, 7px inventory/transfer items and avatars, and 8px dialogs/brand tile. Owner avatars and status dots are circular. The 31px brand tile rotates -5deg and contains the Lucide Link2 icon. Product symbols are 48px square, shrinking to 41px at <=760px. Icons come from lucide-react; the interface has no photographic or illustrated content assets in these views.

## Components

### Buttons and Links

Primary and bordered secondary buttons use the frontmatter variants with a 1px border, 8px icon gap, nowrap text, and 40px minimum height. Primary hover darkens; secondary hover tints. Small buttons remain 32px minimum height, 7px 10px padding, and 10px type because their variant selector outranks the final base override. Header actions use 12px type, becoming 11px with 9px 10px padding at <=760px. Danger buttons retain the secondary treatment with warm text and border.

Icon buttons are 30px square (34px on mobile), radius 5px, with a tinted hover and green icon. Text links turn darker and underline on hover; inventory footer links retain 10px type. Disabled buttons use opacity 0.5 and not-allowed cursor. Submit buttons retain their label and add a 16px spinning icon while disabled.

### Fields and Search

Field labels wrap their controls and optional hints; native input types, required attributes, and min/max constraints supply validation. Labels are 12px/700 with 7px gap. Controls have a 39px minimum height and the frontmatter field treatment; read-only fields have their own pale fill. Textareas resize vertically. Form-field mobile type increases to 16px, while search/filter controls stay 12px.

Search is a 37px-minimum-height outline container, radius 5px, 1px `#e0e6e1` border, 10px horizontal inset, and 370px maximum width on desktop. Its input removes the individual outline; focus-within outlines the whole search container with 2px focus color at 1px offset. There is no separate implemented inline invalid-field style; API failures use error toasts.

### Navigation and View Switches

Primary navigation combines a 19px Lucide icon with text, minimum height 44px, and the active/hover palette. React Router NavLink provides active state and aria-current. Small counts and overdue dots supplement labels. View switches are ordinary buttons with bottom padding 13px, a transparent 2px bottom border that turns green when active, and small count chips. Some containers use role group and an accessible name; there is no ARIA tablist, roving focus, or arrow-key tab behavior.

### Registers, Badges, and Stock Items

Tables use collapsed borders and horizontal overflow. Header cells are 10px/650 with 13px padding and a tinted fill. Case body cells use 18px vertical padding, 17px at <=760px; <=1250px reduces horizontal padding to 8px. First/last cells have edge-specific overrides. Rows contain explicit case links and named open buttons rather than clickable-row semantics.

Status badges have 4px 7px padding, 4px corners, 5px gap, and a 4px circular marker. Inventory items have a 1px border, 7px corners, and 21px padding (17px at <=760px). Their quantities share a divided two-column band; transfer actions disable when stock is unavailable or expired. Transfer items use 22px padding (18px mobile), 1000px maximum width, and an action footer that stacks on mobile.

### Case Workspace

The balance panel uses a tinted 6px-corner surface, fine border, tabular amount, 5px-high meter, and full-width payment action. Meter fill is width 100%, left-origin scaleX of paid/total capped at 1. Evidence upload is a native button opening a file picker, with a dashed border, 6px corners, and 28px 20px padding; no drag-and-drop handler is implemented. Evidence rows pair previews/downloads with metadata and a fingerprint note. Checklists use native labeled checkboxes; task completion uses named buttons. Full task check controls are 20px square, 24px mobile; mini-task controls remain 16px through their more specific selector.

### Dialogs, Keyboard, and Feedback

Shared Modal uses native dialog.showModal(), aria-labelledby, native modal focus containment, and body scroll locking. Escape routes through the supplied close callback after preventing default cancellation. A click outside the dialog bounds also requests close. Closing restores body overflow and focuses the previously active element. The close icon has an accessible name and title; forms commonly autofocus their first editable field.

Dialogs are min(510px, calc(100% - 32px)) wide, or 760px for wide dialogs, with max-height calc(100dvh - 48px), reduced to calc(100dvh - 24px) at <=470px. Header/body/footer paddings are 21px 24px, 23px 24px, and 17px 24px; at <=760px they become 18px, 20px 18px, and 15px 18px. Header and footer stick while content scrolls. The draft editor intercepts close while dirty, announces an inline discard prompt, and focuses Keep editing. While saving it ignores close requests; dirty drafts remove the download href and tab stop and set aria-disabled. This discard guard is specific to drafts, not all forms.

Keyboard focus on buttons, anchors, inputs, selects, and textareas uses a 3px focus-color outline offset 3px. A skip link targets main and appears at top 12px when focused. The mobile menu exposes aria-expanded/aria-controls; its closed sidebar is inert and aria-hidden. Opening focuses the first sidebar control, locks body scroll, makes main inert, and wraps Tab/Shift+Tab between sidebar controls. Escape, backdrop, or navigation closes it and restores focus to the menu button. Resizing above 760px closes it. No global keyboard shortcuts are implemented.

Sonner renders rich-color, dismissible toasts at bottom-right using library styling. Workspace actions emit success after mutation and refresh complete; failures emit error toasts. Connection failures use a role-alert banner with Reconnect. Empty states show a folder icon, short title, optional detail and action; boot placeholders are static bars. These observations do not constitute an accessibility conformance audit.

## Do's and Don'ts

- Do preserve Manrope, zero letter spacing, black surfaces, and compact operational hierarchy.
- Do resolve final CSS overrides and selector specificity before extending a component.
- Do pair status colors with readable labels and use tabular figures for money.
- Do preserve horizontal table scrolling and the exact responsive layout transitions.
- Do preserve native dialog behavior, visible focus, focus restoration, and reduced-motion overrides.
- Don't introduce light page canvases into operational routes; use near-black lift for controls and framed content.
- Don't infer a uniform spacing scale, synthesized palette ramp, or new typography family.
- Don't describe button groups as keyboard-managed tabs or the evidence picker as drag-and-drop.
- Don't generalize the draft discard guard to every form or claim unverified accessibility compliance.
