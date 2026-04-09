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
import { buildQueryContext, BuildQuery } from '@superset-ui/core';
import { PluginFilterFrozenSnapshotQueryFormData } from './types';

// Fetches rows from the configured frozen deployments dataset so the
// component can build the conditional snapshot SQL expression.
// Uses `columns` (plain SELECT, no GROUP BY) with the configured column names.
// The column names must exist in the dataset's synced column list or the
// backend will return "Columns missing in dataset".
const buildQuery: BuildQuery<PluginFilterFrozenSnapshotQueryFormData> =
  formData => {
    const { frozenDeploymentColumn, frozenLastSnapshotColumn } = formData;
    const cols = [frozenDeploymentColumn, frozenLastSnapshotColumn].filter(
      Boolean,
    );
    return buildQueryContext(formData, () => [
      {
        metrics: [],
        columns: cols.length ? cols : undefined,
        row_limit: 500,
        orderby: [],
      },
    ]);
  };

export default buildQuery;
