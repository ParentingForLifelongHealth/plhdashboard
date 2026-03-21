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
import { PluginFilterIlikeQueryFormData } from './types';

// No data is fetched by this filter — the buildQuery is required by the
// framework when datasourceCount > 0 (i.e. when a dataset/column is configured).
const buildQuery: BuildQuery<PluginFilterIlikeQueryFormData> = formData =>
  buildQueryContext(formData, baseQueryObject => [
    { ...baseQueryObject, row_limit: 1 },
  ]);

export default buildQuery;
