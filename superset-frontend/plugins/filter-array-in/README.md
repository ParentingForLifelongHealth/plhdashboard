# filter-array-in

A custom Superset native filter plugin that provides a **multi-value tag input**. The user types values (separated by commas or Enter) and the filter applies `WHERE column IN (v1, v2, v3, ...)` to all charts in scope. Useful when you know the exact values you want to filter by without needing to browse a dropdown list.

## Files

```
plugins/filter-array-in/
├── index.ts                  # ChartPlugin class registration
├── ArrayInFilterPlugin.tsx   # React component (tags input)
├── controlPanel.ts           # Filter config modal settings (column picker)
├── buildQuery.ts             # Minimal query required by framework
├── transformProps.ts         # Bridges ChartProps to component props
├── types.ts                  # TypeScript interfaces
└── README.md
```

## How it works

| User action | SQL generated |
|---|---|
| Types `foo`, `bar`, `baz` | `WHERE column IN ('foo', 'bar', 'baz')` |
| Clears all tags | Filter removed |

Values are added by pressing **Enter** or **comma**. The filter updates immediately on each change.

---

## How to wire it into a Superset instance

All paths are relative to `superset-frontend/`.

### 1. `tsconfig.json`

Add to the `include` array:

```json
"./plugins/filter-array-in/**/*"
```

### 2. `src/constants.ts`

Add to the `FilterPlugins` enum:

```ts
ArrayIn = 'filter_array_in',
```

### 3. `src/filters/components/index.ts`

```ts
export { default as ArrayInFilterPlugin } from '../../../plugins/filter-array-in';
```

### 4. `src/visualizations/presets/MainPreset.js`

Import and register:

```js
import { ..., ArrayInFilterPlugin } from 'src/filters/components';

// In the plugins array:
new ArrayInFilterPlugin().configure({ key: FilterPlugins.ArrayIn }),
```

### 5. `src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigForm/constants.ts`

```ts
filter_array_in: [
  GenericDataType.Boolean,
  GenericDataType.String,
  GenericDataType.Numeric,
  GenericDataType.Temporal,
],
```

### 6. `src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigModal.tsx`

Add to `ALLOW_DEPENDENCIES`:

```ts
'filter_array_in',
```

---

## Configuration

When adding the filter to a dashboard, the config modal will ask you to:
1. Select a **dataset**
2. Select the **column** to filter against

The filter will appear as a tag input in the filter bar. Values are strings — numeric values will be coerced by the database.
