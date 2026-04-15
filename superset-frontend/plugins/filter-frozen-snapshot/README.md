# filter-frozen-snapshot

A native dashboard filter that applies conditional snapshot-date filtering across datasets that include "frozen" deployments — deployments that are no longer being snapshotted and therefore have a fixed last-available date.

---

## The Problem

A standard date filter applies the same snapshot date to every row in every chart. This breaks when some deployments have stopped receiving new snapshots. If a user selects `2026-04-09` but deployment `SouthAfrica` was last snapshotted on `2026-03-31`, filtering on `2026-04-09` returns no rows for that deployment.

This filter solves that by reading a **frozen deployments table** and automatically capping the snapshot date for each frozen deployment at its last available snapshot.

---

## How It Works

### Data sources

| Source | Purpose |
|--------|---------|
| **Frozen deployments dataset** | Configured when adding the filter. Contains one row per frozen deployment with its last snapshot date. Queried at dashboard load. |
| **Main datasets** (charts) | The datasets the filter applies to. Must have a deployment column and a snapshot date column. |

### Logic

```
for each row in a chart query:
  if deployment NOT IN frozen list:
      snapshot_date = selected_date          ← normal behaviour
  else:
      snapshot_date = MIN(selected_date, last_snapshot)
```

If the user selects a date **earlier** than a frozen deployment's last snapshot, the selected date is used as-is (no data loss). The cap only activates when the selected date would go past the last available snapshot.

### Generated SQL

For a selected date of `2026-04-09` with two frozen deployments (`SouthAfrica` → `2026-03-31`, `SouthAfricaRCT` → `2026-03-31`):

```sql
AND (
  (
    "fields.deployment" NOT IN ('SouthAfrica', 'SouthAfricaRCT')
    AND snapshot_date >= '2026-04-09'
    AND snapshot_date <  '2026-04-10'
  )
  OR
  (
    "fields.deployment" = 'SouthAfrica'
    AND snapshot_date >= '2026-03-31'
    AND snapshot_date <  '2026-04-01'
  )
  OR
  (
    "fields.deployment" = 'SouthAfricaRCT'
    AND snapshot_date >= '2026-03-31'
    AND snapshot_date <  '2026-04-01'
  )
)
```

If the user selects a date **before** all last-snapshots (e.g. `2026-03-15`), frozen deployments behave identically to non-frozen ones — the selected date is used for everyone:

```sql
AND (
  (
    "fields.deployment" NOT IN ('SouthAfrica', 'SouthAfricaRCT')
    AND snapshot_date >= '2026-03-15'
    AND snapshot_date <  '2026-03-16'
  )
  OR
  (
    "fields.deployment" = 'SouthAfrica'
    AND snapshot_date >= '2026-03-15'
    AND snapshot_date <  '2026-03-16'
  )
  OR ...
)
```

If the frozen deployments dataset returns **no rows** (empty or not yet loaded), the filter falls back to a simple range:

```sql
AND snapshot_date >= '2026-04-09' AND snapshot_date < '2026-04-10'
```

---

## Setup

### Step 1 — Prepare the frozen deployments table

Create a table (or view) in your database with at least two columns:

| Column | Type | Description |
|--------|------|-------------|
| `deployment` | String | Deployment identifier matching the main datasets |
| `last_snapshot_date` | Date | Last date this deployment was snapshotted |

Example:

```
deployment       | last_snapshot_date
-----------------+-------------------
SouthAfrica      | 2026-03-31
SouthAfricaRCT   | 2026-03-31
SouthAfricaScale | 2026-03-31
WashTextSA       | 2026-03-31
```

### Step 2 — Register the dataset in Superset

1. Go to **Data → Datasets → + Dataset**
2. Select the frozen deployments table
3. Open the dataset for editing and click **"Sync columns from source"**
   - This is required — the column names must be registered in Superset's metadata or queries will fail with *"Columns missing in dataset"*
4. Save

### Step 3 — Add the filter to a dashboard

1. Open a dashboard in edit mode
2. Click **Filters → + Filter → Frozen snapshot filter**
3. Under **Dataset**, select the frozen deployments dataset created in Step 2
4. Configure the control panel fields (see below)
5. Connect the filter to the relevant charts via the **Scoping** tab
6. Save

---

## Control Panel Reference

### Frozen Deployments Dataset Columns

These refer to columns in the **frozen deployments dataset**.

| Field | Default | Description |
|-------|---------|-------------|
| Deployment column | `deployment` | Column containing the deployment identifier |
| Last snapshot column | `last_snapshot_date` | Column containing the last available snapshot date |

### Main Dataset Columns

These refer to columns in the **chart datasets** the filter is applied to.

| Field | Default | Description |
|-------|---------|-------------|
| Deployment column | `"fields.deployment"` | Column reference for deployment. Include double-quotes if the column name contains dots or special characters (e.g. `"fields.deployment"`). |
| Snapshot date column | `snapshot_date` | Column storing the snapshot date |

### UI Configuration

| Field | Default | Description |
|-------|---------|-------------|
| Default to today | Off | When enabled, defaults to the current date on dashboard load. Accounts for pipeline cutoff: before 05:00 UTC, "today" resolves to yesterday to avoid showing incomplete data. |
| Filter value is required | Off | When enabled, charts receive a `1 = 0` filter (returning no rows) until a date is explicitly selected. |

---

## Pipeline Cutoff

When **Default to today** is enabled, the filter uses a UTC cutoff of **05:00** to determine "today":

- Before 05:00 UTC → resolves to **yesterday** (pipeline not yet complete)
- At or after 05:00 UTC → resolves to **today**

This constant is defined in [FrozenSnapshotFilterPlugin.tsx](./FrozenSnapshotFilterPlugin.tsx):

```typescript
const PIPELINE_CUTOFF_HOUR_UTC = 5;
```

---

## Database Compatibility

Date values in the generated SQL use `YYYY-MM-DD` format (no time component), which is compatible with:

| Database | Date type | DateTime type |
|----------|-----------|---------------|
| ClickHouse | `Date` ✓ | `DateTime` ✓ |
| PostgreSQL | `date` ✓ | `timestamp` ✓ |
| MySQL | `DATE` ✓ | `DATETIME` ✓ |

ClickHouse `Date` columns return values as either ISO strings (`"2026-03-31"`) or numeric day-offsets depending on the connector. Both are handled.

---

## Files

```
filter-frozen-snapshot/
├── index.ts                       Plugin class, metadata, registration
├── types.ts                       TypeScript types and DEFAULT_FORM_DATA
├── controlPanel.ts                Filter settings UI definition
├── buildQuery.ts                  Queries the frozen deployments dataset
├── transformProps.ts              Passes data + hooks to the component
└── FrozenSnapshotFilterPlugin.tsx Main component and SQL generation logic
```

### Registration

The plugin is registered in three places:

| File | Change |
|------|--------|
| `src/constants.ts` | `FrozenSnapshot = 'filter_frozen_snapshot'` added to `FilterPlugins` enum |
| `src/filters/components/index.ts` | Re-exports `FrozenSnapshotFilterPlugin` |
| `src/visualizations/presets/MainPreset.ts` | Registers the plugin with key `FilterPlugins.FrozenSnapshot` |

---

## Troubleshooting

### "Columns missing in dataset: ['deployment', 'last_snapshot_date']"

The frozen deployments dataset does not have its columns synced in Superset. Go to **Data → Datasets**, edit the dataset, and click **Sync columns from source**.

### "Empty query?"

Both frozen column name fields are empty. Ensure the **Deployment column** and **Last snapshot column** fields in the filter settings are filled in.

### Frozen deployments show the selected date instead of being capped

The `last_snapshot_date` value for those rows is on or after the selected date, so no capping is needed — this is correct behaviour. The cap only activates when `selected_date > last_snapshot_date`.

### All deployments use the same date (no frozen logic applied)

The frozen deployments dataset returned no rows. Check that:
1. The dataset is correctly selected in the filter configuration
2. The table is not empty
3. The column names in the control panel match the actual column names in the dataset

### "Cannot convert string ... to type Date" (ClickHouse)

This was caused by the old `'YYYY-MM-DD HH:mm:ss'` format. The current version uses `'YYYY-MM-DD'`. If you see this error, ensure you are running the latest version of the plugin.
