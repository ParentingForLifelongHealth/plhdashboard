# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""AI translation of dashboard text via the Claude Agent SDK.

Translations are stored as JSON files in DASHBOARD_AI_TRANSLATION_CACHE_DIR,
named after a hash of the language, model and every source string. A file is
reused until any title, markdown block, tab or filter name on the dashboard
changes, then a new one is generated. Files are plain JSON, so a reviewer can
correct a translation by editing the file.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask import current_app

from superset.models.dashboard import Dashboard
from superset.utils import json

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You translate the user-facing text of an analytics dashboard. "
    "You receive a JSON array of source strings and a target language. "
    "Return a `translations` array with exactly one entry per source string, "
    "in the same order. Keep Markdown, HTML tags, URLs, numbers, emoji, "
    "{{template}} placeholders and line breaks unchanged; translate only the "
    "human-readable text. Keep organisation and programme names (e.g. "
    "'Parenting for Lifelong Health', 'PLH', 'ParentApp') in their original "
    "form. If a string is already in the target language or has nothing to "
    "translate, return it unchanged."
)

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {"translations": {"type": "array", "items": {"type": "string"}}},
    "required": ["translations"],
    "additionalProperties": False,
}

# position_json meta keys holding visible text: HEADER/TAB text, chart title
# overrides and MARKDOWN content.
LAYOUT_TEXT_KEYS = ("text", "sliceNameOverride", "code")


class TranslationError(Exception):
    pass


def collect_strings(dashboard: Dashboard) -> list[str]:
    """Return the sorted, de-duplicated visible text of a dashboard."""
    found: set[str | None] = {dashboard.dashboard_title}
    for chart in dashboard.slices:
        found.add(chart.slice_name)

    layout = json.loads(dashboard.position_json or "{}")
    for component in layout.values():
        if isinstance(component, dict):
            meta = component.get("meta") or {}
            found.update(meta.get(key) for key in LAYOUT_TEXT_KEYS)

    metadata = json.loads(dashboard.json_metadata or "{}")
    for native_filter in metadata.get("native_filter_configuration", []):
        found.update((native_filter.get("name"), native_filter.get("description")))

    return sorted(s for s in found if isinstance(s, str) and s.strip())


def cache_key(language: str, model: str, strings: list[str]) -> str:
    return hashlib.sha256(json.dumps([language, model, strings]).encode()).hexdigest()


def _cache_path(dashboard: Dashboard, language_code: str, key: str) -> Path:
    cache_dir = Path(current_app.config["DASHBOARD_AI_TRANSLATION_CACHE_DIR"])
    return cache_dir / f"dashboard_{dashboard.id}" / f"{language_code}_{key[:16]}.json"


def _write_atomic(path: Path, content: str) -> None:
    """Write via temp file + rename so concurrent readers never see half a file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        fh.write(content)
    os.replace(tmp, path)


async def _ask_claude(language: str, model: str, strings: list[str]) -> list[str]:
    # Imported lazily so Superset starts without the optional dependency.
    from claude_agent_sdk import ClaudeAgentOptions, query, ResultMessage

    options = ClaudeAgentOptions(
        system_prompt=SYSTEM_PROMPT,
        model=model,
        tools=[],  # pure text-in/text-out: no file, shell or web access
        setting_sources=[],  # ignore any CLAUDE.md / settings on the host
        cwd=tempfile.gettempdir(),
        max_turns=3,  # structured output may take a validation retry
        effort="low",
        output_format={"type": "json_schema", "schema": OUTPUT_SCHEMA},
    )
    prompt = f"Target language: {language}\n\nSource strings:\n{json.dumps(strings)}"
    result: ResultMessage | None = None
    async for message in query(prompt=prompt, options=options):
        # Keep consuming (no early return) so the SDK closes the CLI cleanly.
        if isinstance(message, ResultMessage):
            result = message
    if result is None or result.is_error or not result.structured_output:
        raise TranslationError(
            f"Claude returned {result.subtype if result else 'no result'}"
        )
    translations = result.structured_output.get("translations", [])
    if len(translations) != len(strings):
        raise TranslationError(
            f"Expected {len(strings)} translations, got {len(translations)}"
        )
    return translations


def translate_dashboard(dashboard: Dashboard, language_code: str) -> dict[str, Any]:
    """Return {"language": code, "translations": {source: translated}}."""
    languages: dict[str, str] = current_app.config["DASHBOARD_AI_TRANSLATION_LANGUAGES"]
    if language_code not in languages:
        raise ValueError(f"Unsupported language: {language_code}")

    language = languages[language_code]
    model = current_app.config["DASHBOARD_AI_TRANSLATION_MODEL"]
    strings = collect_strings(dashboard)
    path = _cache_path(dashboard, language_code, cache_key(language, model, strings))

    if path.exists():
        cached = json.loads(path.read_text(encoding="utf-8"))
        return {
            "language": language_code,
            "translations": cached["translations"],
            "cached": True,
        }

    # ponytail: concurrent first requests for the same dashboard+language each
    # call Claude once; add a file lock around this if that cost matters.
    # Old files for a dashboard are left in place (small); prune by mtime if
    # the directory ever grows large.
    try:
        translated = (
            asyncio.run(_ask_claude(language, model, strings)) if strings else []
        )
    except TranslationError:
        raise
    except Exception as ex:  # SDK/CLI/auth failures surface as many types
        raise TranslationError(str(ex)) from ex
    mapping = dict(zip(strings, translated, strict=True))
    record = {
        "dashboard_id": dashboard.id,
        "dashboard_title": dashboard.dashboard_title,
        "language_code": language_code,
        "language": language,
        "model": model,
        "created": datetime.now(timezone.utc).isoformat(),
        "translations": mapping,
    }
    _write_atomic(path, json.dumps(record, indent=2))
    return {"language": language_code, "translations": mapping, "cached": False}
