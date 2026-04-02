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

// Fetches all rows from the configured frozen_dates dataset.
// groupby holds the deployment column; frozenDateCol is added alongside it
// so we get (deployment_id, freeze_date) pairs back.
// groupby[0] = deployment column, groupby[1] = freeze date column.
// Both are picked by the user from the frozen_dates dataset column picker.
const buildQuery: BuildQuery<PluginFilterFrozenSnapshotQueryFormData> =
  formData =>
    buildQueryContext(formData, baseQueryObject => [
      {
        ...baseQueryObject,
        metrics: [],
        row_limit: 10000,
        orderby: [],
      },
    ]);

export default buildQuery;
