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
 * Admin review of AI dashboard translations: one table per language with
 * the original text beside an editable translation. Saves go straight to
 * the translation file on the server.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SupersetClient, getClientErrorObject } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import {
  Button,
  Empty,
  Flex,
  Input,
  Loading,
  Popconfirm,
  Select,
  Table,
  Tag,
  Tooltip,
  Typography,
  type ColumnsType,
} from '@superset-ui/core/components';
import { StandardModal, MODAL_LARGE_WIDTH } from 'src/components/Modal';
import { useToasts } from 'src/components/MessageToasts/withToasts';

type TranslationRecord = {
  translations: Record<string, string>;
  created?: string;
  edited?: string;
  model?: string;
};

type TranslationsInfo = {
  languages: Record<string, string>;
  strings: string[];
  translations: Record<string, TranslationRecord | null>;
};

type Row = { source: string };

interface TranslationsModalProps {
  dashboardId: number;
  show: boolean;
  onHide: () => void;
}

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleString() : '';

export default function TranslationsModal({
  dashboardId,
  show,
  onHide,
}: TranslationsModalProps) {
  const { addSuccessToast, addDangerToast } = useToasts();
  const [info, setInfo] = useState<TranslationsInfo>();
  const [language, setLanguage] = useState<string>();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<'translate' | 'save' | null>(null);

  const fail = useCallback(
    async (response: Parameters<typeof getClientErrorObject>[0]) => {
      const { error, message } = await getClientErrorObject(response);
      addDangerToast(message || error || t('Request failed'));
    },
    [addDangerToast],
  );

  const load = useCallback(async () => {
    try {
      const { json } = await SupersetClient.get({
        endpoint: `/api/v1/dashboard/${dashboardId}/translations`,
      });
      const next = json.result as TranslationsInfo;
      setInfo(next);
      setLanguage(current => current ?? Object.keys(next.languages)[0]);
    } catch (response) {
      await fail(response);
    }
  }, [dashboardId, fail]);

  useEffect(() => {
    if (show) load();
  }, [show, load]);

  const record = language ? info?.translations[language] : null;
  const saved = useMemo(() => record?.translations ?? {}, [record]);
  useEffect(() => setDraft({ ...saved }), [saved]);

  const changed = useMemo(
    () => Object.keys(draft).filter(source => draft[source] !== saved[source]),
    [draft, saved],
  );
  const dirty = changed.length > 0;

  const rows = useMemo<Row[]>(() => {
    const needle = search.trim().toLowerCase();
    return (info?.strings ?? [])
      .filter(
        source =>
          !needle ||
          source.toLowerCase().includes(needle) ||
          (draft[source] ?? '').toLowerCase().includes(needle),
      )
      .map(source => ({ source }));
  }, [info, search, draft]);

  const translate = async () => {
    setBusy('translate');
    try {
      await SupersetClient.post({
        endpoint: `/api/v1/dashboard/${dashboardId}/translate/${language}`,
      });
      addSuccessToast(t('Translation generated'));
      await load();
    } catch (response) {
      await fail(response);
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy('save');
    try {
      await SupersetClient.put({
        endpoint: `/api/v1/dashboard/${dashboardId}/translations/${language}`,
        jsonPayload: { translations: draft },
      });
      addSuccessToast(t('Translations saved'));
      await load();
    } catch (response) {
      await fail(response);
    } finally {
      setBusy(null);
    }
  };

  const columns: ColumnsType<Row> = [
    {
      title: t('Original'),
      dataIndex: 'source',
      key: 'source',
      width: '45%',
      render: (source: string) => (
        <Typography.Paragraph
          ellipsis={{ rows: 4, expandable: true, symbol: t('more') }}
          css={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}
        >
          {source}
        </Typography.Paragraph>
      ),
    },
    {
      title: t('Translation'),
      key: 'translation',
      render: (_: unknown, { source }: Row) => (
        <Flex vertical gap={4}>
          <Input.TextArea
            aria-label={t('Translation of %s', source.slice(0, 60))}
            autoSize={{ minRows: 1, maxRows: 10 }}
            value={draft[source] ?? ''}
            status={draft[source]?.trim() ? undefined : 'warning'}
            onChange={event =>
              setDraft(current => ({
                ...current,
                [source]: event.target.value,
              }))
            }
          />
          {draft[source] !== saved[source] && (
            <Typography.Text type="warning">{t('Unsaved')}</Typography.Text>
          )}
        </Flex>
      ),
    },
  ];

  let status = <Tag>{t('Not translated')}</Tag>;
  if (record?.edited) {
    status = (
      <Tooltip title={formatDate(record.edited)}>
        <Tag color="blue">{t('Reviewed')}</Tag>
      </Tooltip>
    );
  } else if (record) {
    status = (
      <Tooltip title={formatDate(record.created)}>
        <Tag color="green">{t('AI translated')}</Tag>
      </Tooltip>
    );
  }

  return (
    <StandardModal
      show={show}
      onHide={onHide}
      title={t('Manage translations')}
      width={MODAL_LARGE_WIDTH}
      onSave={save}
      saveText={
        dirty ? t('Save %s change(s)', changed.length) : t('Save changes')
      }
      saveDisabled={!dirty || !record}
      saveLoading={busy === 'save'}
      cancelText={t('Close')}
      destroyOnClose
    >
      {!info ? (
        <Loading position="inline-centered" />
      ) : (
        <Flex vertical gap={12} css={{ padding: 16 }}>
          <Flex gap={8} align="center" wrap="wrap">
            <Tooltip
              title={dirty ? t('Save or discard your changes first') : null}
            >
              <span>
                <Select
                  ariaLabel={t('Language')}
                  value={language}
                  disabled={dirty}
                  onChange={value => setLanguage(value as string)}
                  options={Object.entries(info.languages).map(
                    ([value, label]) => ({ value, label }),
                  )}
                  css={{ width: 260 }}
                />
              </span>
            </Tooltip>
            {status}
            <Flex flex={1} />
            <Input.Search
              allowClear
              placeholder={t('Search text')}
              aria-label={t('Search text')}
              onChange={event => setSearch(event.target.value)}
              css={{ width: 200 }}
            />
            {dirty && (
              <Button buttonStyle="tertiary" onClick={() => setDraft(saved)}>
                {t('Discard')}
              </Button>
            )}
            {record && (
              <Popconfirm
                title={t('Re-translate with AI?')}
                description={t(
                  'This replaces every translation, including reviewed edits.',
                )}
                okText={t('Re-translate')}
                onConfirm={translate}
              >
                <Button buttonStyle="secondary" loading={busy === 'translate'}>
                  {t('Re-translate')}
                </Button>
              </Popconfirm>
            )}
          </Flex>

          {record ? (
            <Table<Row>
              data={rows}
              columns={columns}
              rowKey="source"
              defaultPageSize={10}
              pageSizeOptions={['10', '25', '50']}
              sticky={false}
            />
          ) : (
            <Empty
              description={t(
                'No translation for the current dashboard text yet.',
              )}
            >
              <Button
                buttonStyle="primary"
                onClick={translate}
                loading={busy === 'translate'}
              >
                {t('Translate with AI')}
              </Button>
            </Empty>
          )}
        </Flex>
      )}
    </StandardModal>
  );
}
