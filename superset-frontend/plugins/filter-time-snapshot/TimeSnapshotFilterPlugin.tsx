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
import { styled } from '@superset-ui/core';
import { useCallback, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import dayjs, { Dayjs } from 'dayjs';
import { updateDataMask } from 'src/dataMask/actions';
import { DatePicker } from 'src/components/DatePicker';
import { PluginFilterTimeSnapshotProps } from './types';

const TIME_RANGE_FORMAT = 'YYYY-MM-DD HH:mm:ss';

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
    ${({ validateStatus, theme }) =>
      validateStatus && `border-color: ${theme.colors[validateStatus]?.base}`}
  }
`;

function dateToTimeRange(dateStr: string): string {
  const start = dayjs(dateStr).startOf('day');
  const end = start.add(1, 'day');
  return `${start.format(TIME_RANGE_FORMAT)} : ${end.format(TIME_RANGE_FORMAT)}`;
}

export default function TimeSnapshotFilterPlugin(
  props: PluginFilterTimeSnapshotProps,
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

  const defaultToToday = props.formData?.defaultToToday;
  const filterId = props.formData?.nativeFilterId;
  const dispatch = useDispatch();
  const hasInitialized = useRef(false);

  const handleDateChange = useCallback(
    (date: Dayjs | null): void => {
      if (date) {
        const dateStr = date.format('YYYY-MM-DD');
        setDataMask({
          extraFormData: { time_range: dateToTimeRange(dateStr) },
          filterState: { value: dateStr },
        });
      } else {
        setDataMask({
          extraFormData: {},
          filterState: { value: undefined },
        });
      }
    },
    [setDataMask],
  );

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      if (defaultToToday) {
        const todayStr = dayjs().format('YYYY-MM-DD');
        const mask = {
          extraFormData: { time_range: dateToTimeRange(todayStr) },
          filterState: { value: todayStr },
        };
        setDataMask(mask);
        if (filterId) {
          dispatch(updateDataMask(filterId, mask));
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
  }, [filterState.value, defaultToToday, filterId]);

  const resolvedValue =
    defaultToToday && !filterState.value
      ? dayjs().format('YYYY-MM-DD')
      : filterState.value;

  const dateValue = resolvedValue ? dayjs(resolvedValue) : null;

  return props.formData?.inView ? (
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
