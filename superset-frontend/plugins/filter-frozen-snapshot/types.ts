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
import { RefObject } from 'react';
import {
  Behavior,
  DataRecord,
  FilterState,
  QueryFormData,
} from '@superset-ui/core';
import {
  PluginFilterHooks,
  PluginFilterStylesProps,
} from 'src/filters/components/types';

export interface FrozenDeployment {
  deploymentId: string | number;
  freezeDate: string; // YYYY-MM-DD
}

interface PluginFilterFrozenSnapshotCustomizeProps {
  snapshotColLabel?: string;
  deploymentColLabel?: string;
  isDeploymentString?: boolean;
  enableEmptyFilter?: boolean;
  defaultToToday?: boolean;
}

export type PluginFilterFrozenSnapshotQueryFormData = QueryFormData &
  PluginFilterStylesProps &
  PluginFilterFrozenSnapshotCustomizeProps;

export type PluginFilterFrozenSnapshotProps = PluginFilterStylesProps & {
  behaviors: Behavior[];
  data: DataRecord[];
  formData: PluginFilterFrozenSnapshotQueryFormData;
  filterState: FilterState;
  inputRef: RefObject<HTMLInputElement>;
  isOverflowingFilterBar?: boolean;
  frozenDeployments: FrozenDeployment[];
  snapshotColLabel: string;
  deploymentColLabel: string;
  isDeploymentString: boolean;
} & PluginFilterHooks;

export const DEFAULT_FORM_DATA: PluginFilterFrozenSnapshotCustomizeProps = {
  snapshotColLabel: 'snapshot_date',
  deploymentColLabel: 'deployment_id',
  isDeploymentString: true,
  enableEmptyFilter: false,
  defaultToToday: false,
};
