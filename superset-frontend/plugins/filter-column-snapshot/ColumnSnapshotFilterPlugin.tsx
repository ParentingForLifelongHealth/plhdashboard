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
import { useCallback, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { updateDataMask } from 'src/dataMask/actions';
import { DatePicker } from '@superset-ui/core/components';
import {
  Clauses,
  ExpressionTypes,
} from 'src/explore/components/controls/FilterControl/types';
import { PluginFilterColumnSnapshotProps } from './types';

dayjs.extend(utc);

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
 * Builds a SQL WHERE expression targeting a specific column.
 * Works with both Date and DateTime column types across ClickHouse,
 * Postgres, and MySQL.
 *
 * Example: column='snapshot_date', selectedDate='2026-04-09'
 *   snapshot_date >= '2026-04-09' AND snapshot_date < '2026-04-10'
 */
function buildSqlExpression(selectedDate: string, column: string): string {
  const start = dayjs(selectedDate).startOf('day');
  const end = start.add(1, 'day');
  const fmt = (d: Dayjs) => d.format('YYYY-MM-DD');
  return `${column} >= '${fmt(start)}' AND ${column} < '${fmt(end)}'`;
}

export default function ColumnSnapshotFilterPlugin(
  props: PluginFilterColumnSnapshotProps,
) {
  const {
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
    snapshotDateColumn,
    nativeFilterId,
    inView,
  } = props.formData;

  const dispatch = useDispatch();
  const hasInitialized = useRef(false);

  const applyDate = useCallback(
    (dateStr: string) => ({
      extraFormData: {
        adhoc_filters: [
          {
            expressionType: ExpressionTypes.Sql,
            clause: Clauses.Where,
            sqlExpression: buildSqlExpression(dateStr, snapshotDateColumn),
            filterOptionName: `column_snapshot_${dateStr}`,
            isExtra: true,
          },
        ],
      },
      filterState: { value: dateStr },
    }),
    [snapshotDateColumn],
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
                    filterOptionName: 'column_snapshot_empty',
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
    if (!hasInitialized.current || (defaultToToday && !filterState.value)) {
      hasInitialized.current = true;
      if (defaultToToday) {
        const todayStr = getEffectiveDate().format('YYYY-MM-DD');
        const mask = applyDate(todayStr);
        setDataMask(mask);
        if (nativeFilterId) {
          dispatch(updateDataMask(nativeFilterId, mask));
        }
        return;
      }
    }
    if (filterState.value) {
      handleDateChange(dayjs(filterState.value));
    } else {
      handleDateChange(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterState.value, defaultToToday, nativeFilterId]);

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
