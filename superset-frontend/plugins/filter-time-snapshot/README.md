# filter-time-snapshot

A custom Superset native filter plugin that provides a **single date picker** for viewing daily snapshot data. Selecting a date filters all charts to show only data for that day by generating a 24-hour `time_range` internally (e.g. `"2025-01-15 00:00:00 : 2025-01-16 00:00:00"`). No backend changes are required.

## Files

```
plugins/filter-time-snapshot/
├── index.ts                      # ChartPlugin class registration
├── TimeSnapshotFilterPlugin.tsx  # React component (the date picker UI)
├── controlPanel.ts               # Filter config modal settings
├── transformProps.ts             # Bridges ChartProps to component props
├── types.ts                      # TypeScript interfaces
└── README.md
```

## How to wire it into a Superset instance

Make the following changes to integrate this plugin. All paths are relative to `superset-frontend/`.

---

### 1. `tsconfig.json`

Add the plugin directory to the `include` array so TypeScript picks it up:

```json
"include": [
  ...existing entries...,
  "./plugins/filter-time-snapshot/**/*"
]
```

---

### 2. `src/constants.ts`

Add `TimeSnapshot` to the `FilterPlugins` enum:

```ts
export enum FilterPlugins {
  Select = 'filter_select',
  Range = 'filter_range',
  Time = 'filter_time',
  TimeSnapshot = 'filter_time_snapshot',   // add this
  TimeColumn = 'filter_timecolumn',
  TimeGrain = 'filter_timegrain',
}
```

---

### 3. `src/filters/components/index.ts`

Export the plugin so it is available alongside the built-in filters:

```ts
export { default as TimeSnapshotFilterPlugin } from '../../../plugins/filter-time-snapshot';
```

---

### 4. `src/visualizations/presets/MainPreset.js`

Import and register the plugin:

```js
import {
  // ...existing imports...
  TimeSnapshotFilterPlugin,
} from 'src/filters/components';

// Inside the plugins array:
new TimeSnapshotFilterPlugin().configure({ key: FilterPlugins.TimeSnapshot }),
```

---

### 5. `src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigForm/constants.ts`

Add the filter type to `FILTER_SUPPORTED_TYPES` so it appears in the filter config modal for temporal columns:

```ts
export const FILTER_SUPPORTED_TYPES = {
  filter_time: [GenericDataType.Temporal],
  filter_time_snapshot: [GenericDataType.Temporal],   // add this
  ...
};
```

---

### 6. `src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigForm/FiltersConfigForm.tsx`

Three small changes to give the snapshot filter the same behaviour as `filter_time` in the config UI:

**a) Time dependency detection (~line 675):**
```ts
.filter(
  filter =>
    filter.type === 'filter_time' ||
    filter.type === 'filter_time_snapshot',  // add
)
```

**b) Info message (~line 897):**
```tsx
{(formFilter?.filterType === 'filter_time' ||
  formFilter?.filterType === 'filter_time_snapshot') && (   // add
  <FilterTypeInfo ...>
```

**c) Scope panel suppression (~line 969):**
```tsx
{formFilter?.filterType !== 'filter_time' &&
  formFilter?.filterType !== 'filter_time_snapshot' && (   // add
  <Collapse.Panel ...>
```

---

### 7. `src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigModal.tsx`

Add `'filter_time_snapshot'` to `ALLOW_DEPENDENCIES` so other filters can cascade from it:

```ts
export const ALLOW_DEPENDENCIES = [
  'filter_range',
  'filter_select',
  'filter_time',
  'filter_time_snapshot',   // add this
];
```

---

## How it works

| User action | Result |
|---|---|
| Picks a date (e.g. `2025-01-15`) | `time_range = "2025-01-15 00:00:00 : 2025-01-16 00:00:00"` applied to all charts in scope |
| Clears the picker | Filter removed, charts show unfiltered data |
| Dashboard reloaded via permalink | Selected date is restored from filter state |

The filter operates via Superset's standard `time_range` mechanism — the same as the built-in Time filter — so it works with all chart types that respect the temporal axis without any SQL or backend changes.
