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
import { ControlPanelConfig } from '@superset-ui/chart-controls';
import { t } from '@apache-superset/core/translation';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Frozen Deployments Dataset Columns'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'frozenDeploymentColumn',
            config: {
              type: 'TextControl',
              label: t('Deployment column'),
              default: 'dep',
              renderTrigger: true,
              description: t(
                'Column name in the frozen deployments dataset that contains the deployment identifier',
              ),
            },
          },
        ],
        [
          {
            name: 'frozenLastSnapshotColumn',
            config: {
              type: 'TextControl',
              label: t('Last snapshot column'),
              default: 'last_snapshot',
              renderTrigger: true,
              description: t(
                'Column name in the frozen deployments dataset that contains the last available snapshot date',
              ),
            },
          },
        ],
      ],
    },
    {
      label: t('Main Dataset Columns'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'mainDeploymentColumn',
            config: {
              type: 'TextControl',
              label: t('Deployment column'),
              default: '"fields.deployment"',
              renderTrigger: true,
              description: t(
                'Column reference for deployment in the main datasets. Include quotes if the column name contains special characters (e.g. "fields.deployment")',
              ),
            },
          },
        ],
        [
          {
            name: 'mainSnapshotDateColumn',
            config: {
              type: 'TextControl',
              label: t('Snapshot date column'),
              default: 'snapshot_date',
              renderTrigger: true,
              description: t(
                'Column name for the snapshot date in the main datasets',
              ),
            },
          },
        ],
      ],
    },
    {
      label: t('UI Configuration'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'enableEmptyFilter',
            config: {
              type: 'CheckboxControl',
              label: t('Filter value is required'),
              default: false,
              renderTrigger: true,
              description: t(
                'User must select a date before applying the filter',
              ),
            },
          },
        ],
        [
          {
            name: 'defaultToToday',
            config: {
              type: 'CheckboxControl',
              label: t('Default to today'),
              default: false,
              renderTrigger: true,
              description: t(
                'Always default to the current date when the dashboard loads',
              ),
            },
          },
        ],
      ],
    },
  ],
};

export default config;
