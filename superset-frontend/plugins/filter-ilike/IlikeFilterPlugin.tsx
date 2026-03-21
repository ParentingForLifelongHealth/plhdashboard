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
import { styled, t, getColumnLabel } from '@superset-ui/core';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { debounce } from 'lodash';
import { Input } from 'src/components/Input';
import { PluginFilterIlikeProps } from './types';

const DEBOUNCE_MS = 300;

const FilterPluginStyle = styled.div<{ height: number; width: number }>`
  min-height: ${({ height }) => height}px;
  width: ${({ width }) => (width === 0 ? '100%' : `${width}px`)};
`;

const StyledInput = styled(Input)`
  width: 100%;
`;

export default function IlikeFilterPlugin(props: PluginFilterIlikeProps) {
  const {
    setDataMask,
    setHoveredFilter,
    unsetHoveredFilter,
    setFocusedFilter,
    unsetFocusedFilter,
    width,
    height,
    filterState,
    inputRef,
    formData,
  } = props;

  const column = formData?.groupby?.[0]
    ? getColumnLabel(formData.groupby[0])
    : undefined;

  const [localValue, setLocalValue] = useState<string>(
    filterState.value ?? '',
  );

  // Sync local value if the filter state is changed externally (e.g. URL params)
  useEffect(() => {
    setLocalValue(filterState.value ?? '');
  }, [filterState.value]);

  const applyFilter = useCallback(
    (value: string) => {
      if (value && column) {
        setDataMask({
          extraFormData: {
            filters: [{ col: column, op: 'ILIKE', val: `%${value}%` }],
          },
          filterState: { value },
        });
      } else {
        setDataMask({
          extraFormData: {},
          filterState: { value: undefined },
        });
      }
    },
    [column, setDataMask],
  );

  const debouncedApply = useMemo(
    () => debounce(applyFilter, DEBOUNCE_MS),
    [applyFilter],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = e.target;
      setLocalValue(value);
      debouncedApply(value);
    },
    [debouncedApply],
  );

  return props.formData?.inView ? (
    <FilterPluginStyle width={width} height={height}>
      <div ref={inputRef}>
        <StyledInput
          value={localValue}
          onChange={handleChange}
          onFocus={setFocusedFilter}
          onBlur={unsetFocusedFilter}
          onMouseEnter={setHoveredFilter}
          onMouseLeave={unsetHoveredFilter}
          placeholder={t('Search...')}
          allowClear
        />
      </div>
    </FilterPluginStyle>
  ) : null;
}
