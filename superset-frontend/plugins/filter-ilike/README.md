# filter-ilike

A custom Superset native filter plugin that provides a **case-insensitive text search** input. The user types a search term and the filter applies `WHERE column ILIKE '%term%'` to all charts in scope. Useful for searching string columns without knowing exact values.

## Files

```
plugins/filter-ilike/
├── index.ts               # ChartPlugin class registration
├── IlikeFilterPlugin.tsx  # React component (debounced text input)
├── controlPanel.ts        # Filter config modal settings (column picker)
├── buildQuery.ts          # Minimal query required by framework
├── transformProps.ts      # Bridges ChartProps to component props
├── types.ts               # TypeScript interfaces
└── README.md
```

## How it works

| User action | SQL generated |
|---|---|
| Types `smith` | `WHERE column ILIKE '%smith%'` |
| Clears input | Filter removed |

Input is debounced 300 ms to avoid excessive queries while typing.

---

## How to wire it into a Superset instance

All paths are relative to `superset-frontend/`.

### 1. `tsconfig.json`

Add to the `include` array:

```json
"./plugins/filter-ilike/**/*"
```

### 2. `src/constants.ts`

Add to the `FilterPlugins` enum:

```ts
Ilike = 'filter_ilike',
```

### 3. `src/filters/components/index.ts`

```ts
export { default as IlikeFilterPlugin } from '../../../plugins/filter-ilike';
```

### 4. `src/visualizations/presets/MainPreset.js`

Import and register:

```js
import { ..., IlikeFilterPlugin } from 'src/filters/components';

// In the plugins array:
new IlikeFilterPlugin().configure({ key: FilterPlugins.Ilike }),
```

### 5. `src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigForm/constants.ts`

```ts
filter_ilike: [GenericDataType.String],
```

### 6. `src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigModal.tsx`

Add to `ALLOW_DEPENDENCIES`:

```ts
'filter_ilike',
```

---

## Configuration

When adding the filter to a dashboard, the config modal will ask you to:
1. Select a **dataset**
2. Select the **column** to search against

The filter will appear as a text input in the filter bar.
