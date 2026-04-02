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
import { t, validateNonEmpty } from '@superset-ui/core';
import {
  ControlPanelConfig,
  sharedControls,
} from '@superset-ui/chart-controls';

const INSTRUCTIONS = `
HOW TO USE THIS FILTER
──────────────────────
This filter applies a date snapshot across your charts, with special
handling for decommissioned deployments that are no longer being updated.

STEP 1 — Point the filter at your frozen_dates table (the dataset picker
above). This table must have one row per frozen deployment.

STEP 2 — Pick the deployment column from that table (e.g. deployment_id).
The freeze date is automatically read from the dataset's default temporal
column — make sure your frozen_dates table has exactly one date/timestamp
column and that it is marked as temporal in the dataset settings.

STEP 3 — Enter the matching column names from your fact tables:
  • Snapshot date column  – e.g. snapshot_date
  • Deployment column     – e.g. deployment_id

HOW THE FILTER WORKS
─────────────────────
When a user selects date D, the filter generates a SQL WHERE clause that:

  • Active deployments (not in frozen_dates):
      → Shows snapshot at D  (normal behaviour)

  • Frozen deployments where D ≤ freeze_date:
      → Shows snapshot at D  (data still exists up to this date)

  • Frozen deployments where D > freeze_date:
      → Shows snapshot at freeze_date  (last recorded entry)

This means frozen deployments will always show their final state once
the selected date moves past their freeze date, with no missing data.
`.trim();

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('How to use'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'instructions',
            config: {
              type: 'TextAreaControl',
              label: '',
              default: INSTRUCTIONS,
              language: 'markdown',
              readOnly: true,
              renderTrigger: false,
              description: '',
            },
          },
        ],
      ],
    },
    {
      label: t('Frozen dates table columns'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'groupby',
            config: {
              ...sharedControls.groupby,
              label: t('Deployment column'),
              description: t(
                'The column in the frozen_dates dataset that identifies each deployment. ' +
                  'The freeze date is automatically read from the dataset\'s default temporal column.',
              ),
              required: true,
            },
          },
        ],
      ],
    },
    {
      label: t('Fact table columns'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'snapshotColLabel',
            config: {
              type: 'TextControl',
              label: t('Snapshot date column'),
              description: t(
                'The name of the snapshot date column in your fact tables (must match exactly)',
              ),
              default: 'snapshot_date',
              renderTrigger: false,
            },
          },
        ],
        [
          {
            name: 'deploymentColLabel',
            config: {
              type: 'TextControl',
              label: t('Deployment column'),
              description: t(
                'The name of the deployment identifier column in your fact tables (must match exactly)',
              ),
              default: 'deployment_id',
              renderTrigger: false,
            },
          },
        ],
        [
          {
            name: 'isDeploymentString',
            config: {
              type: 'CheckboxControl',
              label: t('Deployment IDs are strings'),
              default: true,
              renderTrigger: true,
              description: t(
                'Enable if deployment IDs are strings and need to be quoted in SQL. Disable for numeric IDs.',
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
                'User must select a date before the filter is applied',
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
                'Automatically default to the current date when the dashboard loads. ' +
                  'Uses the pipeline cutoff hour below to determine whether to show today or yesterday.',
              ),
            },
          },
        ],

      ],
    },
  ],
  controlOverrides: {
    groupby: {
      multi: false,
      validators: [validateNonEmpty],
    },
  },
};

export default config;
