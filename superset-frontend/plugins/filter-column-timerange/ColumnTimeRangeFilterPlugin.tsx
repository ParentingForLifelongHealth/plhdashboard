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
import { NO_TIME_RANGE, getExtensionsRegistry } from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { useCallback, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { updateDataMask } from 'src/dataMask/actions';
import DateFilterControl from 'src/explore/components/controls/DateFilterControl';
import { dttmToDayjs } from 'src/explore/components/controls/DateFilterControl/utils/dateParser';
import {
  Clauses,
  ExpressionTypes,
} from 'src/explore/components/controls/FilterControl/types';
import { FilterPluginStyle } from 'src/filters/components/common';
import { PluginFilterColumnTimeRangeProps } from './types';

dayjs.extend(utc);

const DATE_FORMAT = 'YYYY-MM-DD';
const DTTM_FORMAT = 'YYYY-MM-DD HH:mm:ss';

const TimeRangeFilterStyles = styled(FilterPluginStyle)`
  display: flex;
  align-items: center;
  overflow-x: visible;

  & .ant-tag {
    margin-right: 0;
  }
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
  & > div {
    width: 100%;
  }
`;

// Before 5am UTC the pipeline hasn't finished loading today's data,
// so we show yesterday's snapshot instead.
const PIPELINE_CUTOFF_HOUR_UTC = 5;

function getEffectiveDate() {
  const nowUtc = dayjs().utc();
  return nowUtc.hour() < PIPELINE_CUTOFF_HOUR_UTC
    ? nowUtc.subtract(1, 'day')
    : nowUtc;
}

function buildSqlExpression(
  timeRange: string,
  column: string,
): string | null {
  const parts = timeRange.split(' : ');
  if (parts.length !== 2) return null;
  const [sinceStr, untilStr] = parts.map(s => s.trim());
  const since = dttmToDayjs(sinceStr);
  const until = dttmToDayjs(untilStr);
  if (!since.isValid() || !until.isValid()) return null;
  return `${column} >= '${since.format(DATE_FORMAT)}' AND ${column} < '${until.format(DATE_FORMAT)}'`;
}

export default function ColumnTimeRangeFilterPlugin(
  props: PluginFilterColumnTimeRangeProps,
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
    isOverflowingFilterBar = false,
  } = props;

  const {
    defaultToToday,
    enableEmptyFilter,
    snapshotDateColumn,
    nativeFilterId,
  } = props.formData;

  const dispatch = useDispatch();
  const hasInitialized = useRef(false);

  const extensionsRegistry = getExtensionsRegistry();
  const DateFilterControlExtension = extensionsRegistry.get(
    'filter.dateFilterControl',
  );
  const DateFilterComponent = DateFilterControlExtension ?? DateFilterControl;

  const applyTimeRange = useCallback(
    (timeRange: string): void => {
      const isSet = timeRange && timeRange !== NO_TIME_RANGE;
      if (!isSet) {
        setDataMask({
          extraFormData: enableEmptyFilter
            ? {
                adhoc_filters: [
                  {
                    expressionType: ExpressionTypes.Sql,
                    clause: Clauses.Where,
                    sqlExpression: '1 = 0',
                    filterOptionName: 'column_timerange_empty',
                    isExtra: true,
                  },
                ],
              }
            : {},
          filterState: { value: undefined },
        });
        return;
      }

      const sqlExpression = buildSqlExpression(timeRange, snapshotDateColumn);
      setDataMask(
        sqlExpression
          ? {
              extraFormData: {
                adhoc_filters: [
                  {
                    expressionType: ExpressionTypes.Sql,
                    clause: Clauses.Where,
                    sqlExpression,
                    filterOptionName: `column_timerange_${timeRange}`,
                    isExtra: true,
                  },
                ],
              },
              filterState: { value: timeRange },
            }
          : {
              // ponytail: relative preset — fall back to time_range, no column targeting
              extraFormData: { time_range: timeRange },
              filterState: { value: timeRange },
            },
      );
    },
    [setDataMask, snapshotDateColumn, enableEmptyFilter],
  );

  useEffect(() => {
    if (!hasInitialized.current || (defaultToToday && !filterState.value)) {
      hasInitialized.current = true;
      if (defaultToToday) {
        const d = getEffectiveDate();
        const timeRange = `${d.startOf('day').format(DTTM_FORMAT)} : ${d.add(1, 'day').startOf('day').format(DTTM_FORMAT)}`;
        const mask = {
          extraFormData: {
            adhoc_filters: [
              {
                expressionType: ExpressionTypes.Sql,
                clause: Clauses.Where,
                sqlExpression: buildSqlExpression(timeRange, snapshotDateColumn)!,
                filterOptionName: `column_timerange_${timeRange}`,
                isExtra: true,
              },
            ],
          },
          filterState: { value: timeRange },
        };
        setDataMask(mask);
        if (nativeFilterId) {
          dispatch(updateDataMask(nativeFilterId, mask));
        }
        return;
      }
    }
    applyTimeRange(filterState.value ?? NO_TIME_RANGE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterState.value, defaultToToday, nativeFilterId]);

  const displayValue = filterState.value || NO_TIME_RANGE;

  return props.formData?.inView ? (
    <TimeRangeFilterStyles width={width} height={height}>
      <ControlContainer
        ref={inputRef}
        validateStatus={filterState.validateStatus}
        onFocus={setFocusedFilter}
        onBlur={unsetFocusedFilter}
        onMouseEnter={setHoveredFilter}
        onMouseLeave={unsetHoveredFilter}
        tabIndex={-1}
      >
        <DateFilterComponent
          value={displayValue}
          name={nativeFilterId || 'column_time_range'}
          onChange={timeRange => applyTimeRange(timeRange ?? NO_TIME_RANGE)}
          onOpenPopover={() => setFilterActive(true)}
          onClosePopover={() => {
            setFilterActive(false);
            unsetHoveredFilter();
            unsetFocusedFilter();
          }}
          isOverflowingFilterBar={isOverflowingFilterBar}
        />
      </ControlContainer>
    </TimeRangeFilterStyles>
  ) : null;
}
