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
import { ChartProps, DataRecord, GenericDataType } from '@superset-ui/core';
import dayjs from 'dayjs';
import { noOp } from 'src/utils/common';
import { DEFAULT_FORM_DATA, FrozenDeployment } from './types';

export default function transformProps(chartProps: ChartProps) {
  const {
    formData,
    height,
    hooks,
    queriesData,
    width,
    behaviors,
    filterState,
    inputRef,
    displaySettings,
  } = chartProps;

  const {
    setDataMask = noOp,
    setHoveredFilter = noOp,
    unsetHoveredFilter = noOp,
    setFocusedFilter = noOp,
    unsetFocusedFilter = noOp,
    setFilterActive = noOp,
  } = hooks;

  const { snapshotColLabel, deploymentColLabel, isDeploymentString } = {
    ...DEFAULT_FORM_DATA,
    ...formData,
  };

  // groupby[0] = deployment column (user picks this)
  // freeze date column = the dataset's default temporal column (auto-detected from coltypes)
  const groupby = formData.groupby ?? [];
  const deploymentCol = typeof groupby[0] === 'string' ? groupby[0] : '';

  const colnames: string[] = queriesData[0]?.colnames ?? [];
  const coltypes: GenericDataType[] = queriesData[0]?.coltypes ?? [];
  const temporalIdx = coltypes.indexOf(GenericDataType.Temporal);
  const frozenDateCol = temporalIdx >= 0 ? colnames[temporalIdx] : '';

  const rawData: DataRecord[] = queriesData[0]?.data ?? [];

  const frozenDeployments: FrozenDeployment[] = rawData
    .filter(
      row =>
        row[deploymentCol] != null &&
        frozenDateCol &&
        row[frozenDateCol] != null,
    )
    .map(row => ({
      deploymentId: row[deploymentCol] as string | number,
      freezeDate: dayjs(row[frozenDateCol] as string | Date).format('YYYY-MM-DD'),
    }));

  return {
    data: rawData,
    filterState,
    formData: { ...DEFAULT_FORM_DATA, ...formData },
    height,
    behaviors,
    setDataMask,
    setHoveredFilter,
    unsetHoveredFilter,
    setFocusedFilter,
    unsetFocusedFilter,
    setFilterActive,
    width,
    inputRef,
    filterBarOrientation: displaySettings?.filterBarOrientation,
    isOverflowingFilterBar: displaySettings?.isOverflowingFilterBar,
    frozenDeployments,
    snapshotColLabel: snapshotColLabel ?? '',
    deploymentColLabel: deploymentColLabel ?? '',
    isDeploymentString: isDeploymentString ?? true,
  };
}
