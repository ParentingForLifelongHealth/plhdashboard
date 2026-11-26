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
/**
 * AI dashboard translation. Translations live in a tiny view-only store
 * outside Redux so translated text can never be saved back into the
 * dashboard (layout, filters and title in Redux stay untouched); render
 * sites call `tr(text)` to display the translated string.
 */
import { useCallback, useEffect, useState } from 'react';
import { SupersetClient, getClientErrorObject } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { Select } from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';

type TranslationMap = Record<string, string>;

const EMPTY: TranslationMap = {};
let current: TranslationMap = EMPTY;
const listeners = new Set<() => void>();

function setTranslations(next: TranslationMap) {
  current = next;
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Returns `tr(text)`: the translated text, or the original when none. */
export function useAiTranslation() {
  // ponytail: useState+subscribe because React 17 has no useSyncExternalStore
  const [map, setMap] = useState(current);
  useEffect(() => {
    setMap(current); // catch updates between render and subscribe
    return subscribe(() => setMap(current));
  }, []);
  return useCallback(
    <T extends string | undefined | null>(text: T): T =>
      (text && map[text] !== undefined ? map[text] : text) as T,
    [map],
  );
}

/** Function component wrapper so class components can render translated text. */
export function AiTranslated({
  text,
  children,
}: {
  text: string;
  children: (translated: string) => JSX.Element;
}) {
  const tr = useAiTranslation();
  return children(tr(text));
}

interface AiTranslationSelectProps {
  dashboardId: number;
  languages?: Record<string, string>;
  editMode: boolean;
}

export function AiTranslationSelect({
  dashboardId,
  languages,
  editMode,
}: AiTranslationSelectProps) {
  const [language, setLanguage] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const { addDangerToast } = useToasts();

  // Edit mode works on the original text; reset when entering it, and when
  // leaving the dashboard.
  useEffect(() => {
    if (editMode) {
      setLanguage(undefined);
      setTranslations(EMPTY);
    }
  }, [editMode]);
  useEffect(() => () => setTranslations(EMPTY), [dashboardId]);

  const onChange = useCallback(
    async (code?: string) => {
      setLanguage(code);
      if (!code) {
        setTranslations(EMPTY);
        return;
      }
      setLoading(true);
      try {
        const { json } = await SupersetClient.get({
          endpoint: `/api/v1/dashboard/${dashboardId}/translate/${code}`,
        });
        setTranslations(json.result.translations as TranslationMap);
      } catch (response) {
        const { error, message } = await getClientErrorObject(response);
        addDangerToast(
          t('Translation failed: %s', message || error || t('unknown error')),
        );
        setLanguage(undefined);
        setTranslations(EMPTY);
      } finally {
        setLoading(false);
      }
    },
    [dashboardId, addDangerToast],
  );

  if (editMode || !languages || !Object.keys(languages).length) {
    return null;
  }
  return (
    <Select
      ariaLabel={t('Translate dashboard')}
      placeholder={t('Translate (AI)')}
      value={language}
      onChange={value => onChange(value as string | undefined)}
      onClear={() => onChange(undefined)}
      allowClear
      loading={loading}
      disabled={loading}
      showSearch
      options={Object.entries(languages).map(([value, label]) => ({
        value,
        label,
      }))}
      css={{ width: 180 }}
    />
  );
}
