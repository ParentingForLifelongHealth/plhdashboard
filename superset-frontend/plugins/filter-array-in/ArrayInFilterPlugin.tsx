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
import { getColumnLabel } from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { useCallback } from 'react';
import { Select } from '@superset-ui/core/components';
import { PluginFilterArrayInProps } from './types';

const FilterPluginStyle = styled.div<{ height: number; width: number }>`
  min-height: ${({ height }) => height}px;
  width: ${({ width }) => (width === 0 ? '100%' : `${width}px`)};
`;

export default function ArrayInFilterPlugin(props: PluginFilterArrayInProps) {
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
    formData,
  } = props;

  const column = formData?.groupby?.[0]
    ? getColumnLabel(formData.groupby[0])
    : undefined;

  const handleChange = useCallback(
    (values: string[]) => {
      if (values.length > 0 && column) {
        setDataMask({
          extraFormData: {
            filters: [{ col: column, op: 'IN', val: values }],
          },
          filterState: { value: values },
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

  const value: string[] = filterState.value ?? [];

  return props.formData?.inView ? (
    <FilterPluginStyle width={width} height={height}>
      <Select
        mode="tags"
        value={value}
        onChange={handleChange}
        onFocus={setFocusedFilter}
        onBlur={unsetFocusedFilter}
        onMouseEnter={setHoveredFilter}
        onMouseLeave={unsetHoveredFilter}
        onDropdownVisibleChange={setFilterActive}
        placeholder={t('Type values and press Enter...')}
        style={{ width: '100%' }}
        allowClear
        tokenSeparators={[',']}
        status={filterState.validateStatus === 'error' ? 'error' : undefined}
      />
    </FilterPluginStyle>
  ) : null;
}
