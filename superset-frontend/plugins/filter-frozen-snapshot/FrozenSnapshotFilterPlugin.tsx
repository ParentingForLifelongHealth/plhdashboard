/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { styled } from '@apache-superset/core/theme';
import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { DataRecord } from '@superset-ui/core';
import { updateDataMask } from 'src/dataMask/actions';
import { DatePicker } from '@superset-ui/core/components';
import {
  Clauses,
  ExpressionTypes,
} from 'src/explore/components/controls/FilterControl/types';
import { PluginFilterFrozenSnapshotProps } from './types';

dayjs.extend(utc);

// ClickHouse Date columns require bare date strings (no time component).
// Using YYYY-MM-DD works for both Date and DateTime columns across ClickHouse,
// Postgres, and MySQL.
const DATE_FORMAT = 'YYYY-MM-DD';

const SnapshotFilterStyles = styled.div<{ height: number; width: number }>`
  min-height: ${({ height }) => height}px;
  width: ${({ width }) => (width === 0 ? '100%' : `${width}px`)};
  display: flex;
  align-items: center;
  overflow-x: auto;
`;

const ControlContainer = styled.div<{
  validateStatus?: 'error' | 'warning' | 'info';
}>`
  display: flex;
  height: 100%;
  max-width: 100%;
  width: 100%;
  & > div,
  & > div:hover {
    ${({ validateStatus, theme }) => {
      if (!validateStatus) return '';
      switch (validateStatus) {
        case 'error':
          return `border-color: ${theme.colorError}`;
        case 'warning':
          return `border-color: ${theme.colorWarning}`;
        case 'info':
          return `border-color: ${theme.colorInfo}`;
        default:
          return `border-color: ${theme.colorError}`;
      }
    }}
  }
`;

// Before 5am UTC the pipeline hasn't finished loading today's data,
// so we show yesterday's snapshot instead.
const PIPELINE_CUTOFF_HOUR_UTC = 5;

function getEffectiveDate(): Dayjs {
  const nowUtc = dayjs().utc();
  return nowUtc.hour() < PIPELINE_CUTOFF_HOUR_UTC
    ? nowUtc.subtract(1, 'day')
    : nowUtc;
}

/**
 * Generates a WHERE clause SQL expression that applies a conditional snapshot
 * date filter. Non-frozen deployments use the selected date. Frozen deployments
 * are capped at their last_snapshot date if the selected date is later.
 *
 * Example output:
 *   (
 *     ("fields.deployment" NOT IN ('sa', 'rct')
 *       AND snapshot_date >= '2026-04-09 00:00:00'
 *       AND snapshot_date <  '2026-04-10 00:00:00')
 *     OR
 *     ("fields.deployment" = 'sa'
 *       AND snapshot_date >= '2026-03-21 00:00:00'
 *       AND snapshot_date <  '2026-03-22 00:00:00')
 *     OR
 *     ("fields.deployment" = 'rct'
 *       AND snapshot_date >= '2026-03-21 00:00:00'
 *       AND snapshot_date <  '2026-03-22 00:00:00')
 *   )
 */
function generateSqlExpression(
  selectedDate: string,
  frozenRows: DataRecord[],
  mainDepCol: string,
  mainSnapshotCol: string,
  frozenDepKey: string,
  frozenSnapKey: string,
): string {
  const selectedStart = dayjs(selectedDate).startOf('day');
  const selectedEnd = selectedStart.add(1, 'day');
  const fmt = (d: Dayjs) => d.format(DATE_FORMAT);

  if (frozenRows.length === 0) {
    return (
      `${mainSnapshotCol} >= '${fmt(selectedStart)}'` +
      ` AND ${mainSnapshotCol} < '${fmt(selectedEnd)}'`
    );
  }

  const frozenNames = frozenRows
    .map(r => `'${String(r[frozenDepKey]).replace(/'/g, "''")}'`)
    .join(', ');

  const nonFrozenPart =
    `(${mainDepCol} NOT IN (${frozenNames})` +
    ` AND ${mainSnapshotCol} >= '${fmt(selectedStart)}'` +
    ` AND ${mainSnapshotCol} < '${fmt(selectedEnd)}')`;

  const frozenParts = frozenRows.map(row => {
    const dep = String(row[frozenDepKey]).replace(/'/g, "''");
    // ClickHouse may return Date values as numeric epoch-day integers or
    // ISO strings — dayjs handles both when passed the raw value directly.
    const lastSnap = dayjs(row[frozenSnapKey] as string | number);
    const effectiveStart = (
      lastSnap.isValid() && lastSnap.isBefore(selectedStart)
        ? lastSnap
        : selectedStart
    ).startOf('day');
    const effectiveEnd = effectiveStart.add(1, 'day');
    return (
      `(${mainDepCol} = '${dep}'` +
      ` AND ${mainSnapshotCol} >= '${fmt(effectiveStart)}'` +
      ` AND ${mainSnapshotCol} < '${fmt(effectiveEnd)}')`
    );
  });

  return `(\n  ${[nonFrozenPart, ...frozenParts].join('\n  OR\n  ')}\n)`;
}

export default function FrozenSnapshotFilterPlugin(
  props: PluginFilterFrozenSnapshotProps,
) {
  const {
    data,
    setDataMask,
    setHoveredFilter,
    unsetHoveredFilter,
    setFocusedFilter,
    unsetFocusedFilter,
    setFilterActive,
    width,
    height,
    filterState,
    inputRef,
  } = props;

  const {
    defaultToToday,
    enableEmptyFilter,
    frozenDeploymentColumn,
    frozenLastSnapshotColumn,
    mainDeploymentColumn,
    mainSnapshotDateColumn,
    nativeFilterId,
    inView,
  } = props.formData;

  const dispatch = useDispatch();

  const applyDate = useCallback(
    (dateStr: string) => {
      const sqlExpression = generateSqlExpression(
        dateStr,
        data,
        mainDeploymentColumn,
        mainSnapshotDateColumn,
        frozenDeploymentColumn,
        frozenLastSnapshotColumn,
      );
      return {
        extraFormData: {
          adhoc_filters: [
            {
              expressionType: ExpressionTypes.Sql,
              clause: Clauses.Where,
              sqlExpression,
              filterOptionName: `frozen_snapshot_${dateStr}`,
              isExtra: true,
            },
          ],
        },
        filterState: { value: dateStr },
      };
    },
    [
      data,
      mainDeploymentColumn,
      mainSnapshotDateColumn,
      frozenDeploymentColumn,
      frozenLastSnapshotColumn,
    ],
  );

  const handleDateChange = useCallback(
    (date: Dayjs | null): void => {
      if (date) {
        setDataMask(applyDate(date.format('YYYY-MM-DD')));
      } else {
        setDataMask({
          extraFormData: enableEmptyFilter
            ? {
                adhoc_filters: [
                  {
                    expressionType: ExpressionTypes.Sql,
                    clause: Clauses.Where,
                    sqlExpression: '1 = 0',
                    filterOptionName: 'frozen_snapshot_empty',
                    isExtra: true,
                  },
                ],
              }
            : {},
          filterState: { value: undefined },
        });
      }
    },
    [setDataMask, applyDate, enableEmptyFilter],
  );

  useEffect(() => {
    if (defaultToToday && !filterState.value) {
      const todayStr = getEffectiveDate().format('YYYY-MM-DD');
      const mask = applyDate(todayStr);
      setDataMask(mask);
      if (nativeFilterId) {
        dispatch(updateDataMask(nativeFilterId, mask));
      }
      return;
    }
    if (filterState.value) {
      handleDateChange(dayjs(filterState.value));
    } else {
      handleDateChange(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterState.value, defaultToToday, nativeFilterId, data]);

  const resolvedValue =
    defaultToToday && !filterState.value
      ? getEffectiveDate().format('YYYY-MM-DD')
      : filterState.value;

  const dateValue = resolvedValue ? dayjs(resolvedValue) : null;

  return inView ? (
    <SnapshotFilterStyles width={width} height={height}>
      <ControlContainer
        ref={inputRef}
        validateStatus={filterState.validateStatus}
        onFocus={setFocusedFilter}
        onBlur={unsetFocusedFilter}
        onMouseEnter={setHoveredFilter}
        onMouseLeave={unsetHoveredFilter}
      >
        <DatePicker
          value={dateValue}
          onChange={handleDateChange}
          onOpenChange={open => {
            setFilterActive(open);
            if (!open) {
              unsetHoveredFilter();
              unsetFocusedFilter();
            }
          }}
          allowClear
          placeholder="Select date"
          status={filterState.validateStatus === 'error' ? 'error' : undefined}
        />
      </ControlContainer>
    </SnapshotFilterStyles>
  ) : null;
}
