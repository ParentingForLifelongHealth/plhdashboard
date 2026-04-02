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
import { styled, t } from '@superset-ui/core';
import type { ExtraFormData } from '@superset-ui/core';
import { useCallback, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import dayjs, { Dayjs } from 'dayjs';
import { updateDataMask } from 'src/dataMask/actions';
import { DatePicker } from 'src/components/DatePicker';
import { FrozenDeployment, PluginFilterFrozenSnapshotProps } from './types';

const DATE_FORMAT = 'YYYY-MM-DD';

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const Wrapper = styled.div<{ height: number; width: number }>`
  min-height: ${({ height }) => height}px;
  width: ${({ width }) => (width === 0 ? '100%' : `${width}px`)};
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const FrozenBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.info.base};
  background: ${({ theme }) => theme.colors.info.light2};
  border: 1px solid ${({ theme }) => theme.colors.info.light1};
  border-radius: ${({ theme }) => theme.gridUnit}px;
  padding: 1px 6px;
  line-height: 18px;
`;

const FrozenHint = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.grayscale.light1};
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sqlStringVal(val: unknown): string {
  return `'${String(val).replace(/'/g, "''")}'`;
}

function sqlVal(val: unknown, isString: boolean): string {
  return isString ? sqlStringVal(val) : String(val);
}


/**
 * Build the SQL WHERE expression for the filter.
 *
 * SQL shape:
 *
 *   (deployment NOT IN (all_frozen_ids) AND snapshot_date = D)
 *   OR
 *   (deployment = id1 AND snapshot_date = MIN(freeze1, D))
 *   OR
 *   (deployment = id2 AND snapshot_date = MIN(freeze2, D))
 *   ...
 *
 * Branch A covers all active (non-frozen) deployments at the selected date.
 * Branch B covers every frozen deployment: if D > freezeDate it shows the
 * last recorded snapshot, otherwise it shows the selected date.
 */
function buildExtraFormData(
  dateStr: string,
  frozenDeployments: FrozenDeployment[],
  snapshotColLabel: string,
  deploymentColLabel: string,
  isDeploymentString: boolean,
): ExtraFormData {
  if (!snapshotColLabel) {
    return {};
  }

  // No frozen deployments — simple date equality is enough
  if (frozenDeployments.length === 0) {
    return {
      filters: [{ col: snapshotColLabel, op: '==' as const, val: dateStr }],
    };
  }

  // Branch A: all non-frozen deployments filtered at D
  const allFrozenIds = frozenDeployments
    .map(d => sqlVal(d.deploymentId, isDeploymentString))
    .join(', ');
  const branchA = `(${deploymentColLabel} NOT IN (${allFrozenIds}) AND ${snapshotColLabel} = '${dateStr}')`;

  // Branch B: every frozen deployment uses MIN(freezeDate, D)
  const branchB = frozenDeployments
    .map(d => {
      const effectiveDate =
        d.freezeDate < dateStr ? d.freezeDate : dateStr;
      return `(${deploymentColLabel} = ${sqlVal(d.deploymentId, isDeploymentString)} AND ${snapshotColLabel} = '${effectiveDate}')`;
    })
    .join(' OR ');

  return {
    adhoc_filters: [
      {
        expressionType: 'SQL' as const,
        sqlExpression: `${branchA} OR ${branchB}`,
        clause: 'WHERE' as const,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FrozenSnapshotFilterPlugin(
  props: PluginFilterFrozenSnapshotProps,
) {
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
    inputRef,
    frozenDeployments,
    snapshotColLabel,
    deploymentColLabel,
    isDeploymentString,
  } = props;

  const defaultToToday = props.formData?.defaultToToday;
  const pipelineCutoffHour = props.formData?.pipelineCutoffHour ?? 8;
  const filterId = props.formData?.nativeFilterId;
  const dispatch = useDispatch();
  const hasInitialized = useRef(false);
  const prevFrozen = useRef(frozenDeployments);

  const applyMask = useCallback(
    (dateStr: string | null) => {
      if (!dateStr || !snapshotColLabel || !deploymentColLabel) {
        setDataMask({ extraFormData: {}, filterState: { value: undefined } });
        return;
      }

      const extraFormData = buildExtraFormData(
        dateStr,
        frozenDeployments,
        snapshotColLabel,
        deploymentColLabel,
        isDeploymentString,
      );

      const frozenPastCount = frozenDeployments.filter(
        d => d.freezeDate < dateStr,
      ).length;
      const label =
        frozenPastCount > 0
          ? `${dateStr} (${frozenPastCount} ❄ frozen)`
          : dateStr;

      setDataMask({ extraFormData, filterState: { value: dateStr, label } });
    },
    [
      frozenDeployments,
      snapshotColLabel,
      deploymentColLabel,
      isDeploymentString,
      setDataMask,
    ],
  );

  // Effect 1 — runs once on mount to apply the default date.
  useEffect(() => {
    hasInitialized.current = true;
    if (defaultToToday) {
      const nowUtc = dayjs().utc();
      const isPipelineReady = nowUtc.hour() >= pipelineCutoffHour;
      const effectiveDate = isPipelineReady
        ? nowUtc
        : nowUtc.subtract(1, 'day');
      const todayStr = effectiveDate.format(DATE_FORMAT);
      const mask = {
        extraFormData: {},
        filterState: { value: todayStr },
      };
      setDataMask(mask);
      if (filterId) {
        dispatch(updateDataMask(filterId, mask));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect 2 — re-evaluates the SQL mask when the frozen list changes
  // (e.g. a parent filter narrows scope and a deployment crosses its freeze date).
  // Skips the first render since Effect 1 handles init, and guards against
  // re-running when frozenDeployments reference changes but content hasn't.
  useEffect(() => {
    if (!hasInitialized.current) return;
    if (prevFrozen.current === frozenDeployments) return;
    prevFrozen.current = frozenDeployments;
    if (filterState.value) {
      applyMask(filterState.value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frozenDeployments]);

  const handleChange = useCallback(
    (date: Dayjs | null) => {
      applyMask(date ? date.format(DATE_FORMAT) : null);
    },
    [applyMask],
  );

  const dateValue = filterState.value ? dayjs(filterState.value) : null;

  const dateStr = dateValue ? dateValue.format(DATE_FORMAT) : null;
  const pastCount =
    dateStr && frozenDeployments.length > 0
      ? frozenDeployments.filter(d => d.freezeDate < dateStr).length
      : 0;

  if (!props.formData?.inView) return null;

  return (
    <Wrapper width={width} height={height}>
      <div
        ref={inputRef}
        onFocus={setFocusedFilter}
        onBlur={unsetFocusedFilter}
        onMouseEnter={setHoveredFilter}
        onMouseLeave={unsetHoveredFilter}
      >
        <DatePicker
          value={dateValue}
          onChange={handleChange}
          onOpenChange={open => {
            setFilterActive(open);
            if (!open) {
              unsetHoveredFilter();
              unsetFocusedFilter();
            }
          }}
          allowClear
          placeholder={t('Select date')}
          style={{ width: '100%' }}
        />
      </div>

      {pastCount > 0 && (
        <>
          <FrozenBadge>❄ {t('%s frozen past deadline', pastCount)}</FrozenBadge>
          <FrozenHint>
            {t('Showing last recorded snapshot for those deployments')}
          </FrozenHint>
        </>
      )}
    </Wrapper>
  );
}
