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
import { Behavior, ChartMetadata, ChartPlugin } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import thumbnail from 'src/filters/components/Time/images/thumbnail.png';

export default class ColumnTimeRangeFilterPlugin extends ChartPlugin {
  constructor() {
    const metadata = new ChartMetadata({
      name: t('Column time range filter'),
      description: t(
        'Date range filter that targets a specific column via SQL. Use this instead of the column snapshot filter when you need to filter across a range of dates rather than a single day.',
      ),
      behaviors: [Behavior.InteractiveChart, Behavior.NativeFilter],
      thumbnail,
      tags: [t('Experimental')],
      datasourceCount: 0,
    });

    super({
      controlPanel,
      loadChart: () => import('./ColumnTimeRangeFilterPlugin'),
      metadata,
      transformProps,
    });
  }
}
