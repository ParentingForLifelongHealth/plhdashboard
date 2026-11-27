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
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import patch

import pytest

from superset.dashboards import ai_translation
from superset.utils import json

TEMPLATE = "<h3>Families</h3>{{#each data}}<p>{{this.count}} reached</p>{{/each}}"


def _dashboard(title: str = "Reach", tab: str = "Overview") -> Any:
    position = {
        "DASHBOARD_VERSION_KEY": "v2",
        "HEADER_ID": {"type": "HEADER", "meta": {"text": title}},
        "TAB-1": {"type": "TAB", "meta": {"text": tab}},
        "CHART-1": {"type": "CHART", "meta": {"sliceNameOverride": "Families"}},
        "MARKDOWN-1": {"type": "MARKDOWN", "meta": {"code": "# Welcome"}},
        "ROW-1": {"type": "ROW", "meta": {}},
    }
    metadata = {"native_filter_configuration": [{"name": "Country"}]}
    return SimpleNamespace(
        id=7,
        dashboard_title=title,
        slices=[
            SimpleNamespace(slice_name="Total reach", viz_type="table", params="{}"),
            SimpleNamespace(
                slice_name="Summary card",
                viz_type="handlebars",
                params=json.dumps({"handlebars_template": TEMPLATE}),
            ),
        ],
        position_json=json.dumps(position),
        json_metadata=json.dumps(metadata),
    )


def test_collect_strings() -> None:
    assert ai_translation.collect_strings(_dashboard()) == [
        "# Welcome",
        TEMPLATE,
        "Country",
        "Families",
        "Overview",
        "Reach",
        "Summary card",
        "Total reach",
    ]


def test_keep_expressions_rejects_broken_template() -> None:
    good = "<h3>Familias</h3>{{#each data}}<p>{{this.count}} alcanzadas</p>{{/each}}"
    bad = "<h3>Familias</h3>{{#cada data}}<p>{{this.count}} alcanzadas</p>{{/cada}}"
    assert ai_translation._keep_expressions(TEMPLATE, good) == good
    assert ai_translation._keep_expressions(TEMPLATE, bad) == TEMPLATE


def test_cache_key_changes_when_text_changes() -> None:
    a = ai_translation.collect_strings(_dashboard())
    b = ai_translation.collect_strings(_dashboard(tab="Summary"))
    key = ai_translation.cache_key
    assert key("Spanish", "m", a) == key("Spanish", "m", list(a))
    assert key("Spanish", "m", a) != key("Spanish", "m", b)
    assert key("Spanish", "m", a) != key("French", "m", a)


def test_translate_dashboard_uses_disk_cache(app_context: None, tmp_path: Path) -> None:
    from flask import current_app

    current_app.config["DASHBOARD_AI_TRANSLATION_LANGUAGES"] = {"es": "Spanish"}
    current_app.config["DASHBOARD_AI_TRANSLATION_CACHE_DIR"] = str(tmp_path)

    async def fake_ask(_lang: str, _model: str, strings: list[str]) -> list[str]:
        return [f"es:{s}" for s in strings]

    with patch.object(ai_translation, "_ask_claude", side_effect=fake_ask) as ask:
        first = ai_translation.translate_dashboard(_dashboard(), "es")
        second = ai_translation.translate_dashboard(_dashboard(), "es")
        ai_translation.translate_dashboard(_dashboard(tab="Summary"), "es")

    assert first["cached"] is False
    assert first["translations"]["Overview"] == "es:Overview"
    assert second == {**first, "cached": True}
    assert ask.call_count == 2  # third call: text changed, cache miss

    files = sorted((tmp_path / "dashboard_7").glob("es_*.json"))
    assert len(files) == 2
    record = json.loads(files[0].read_text())
    assert record["dashboard_id"] == 7
    assert record["language"] == "Spanish"

    with pytest.raises(ValueError, match="Unsupported language"):
        ai_translation.translate_dashboard(_dashboard(), "xx")


def test_save_and_list_translations(app_context: None, tmp_path: Path) -> None:
    from flask import current_app

    current_app.config["DASHBOARD_AI_TRANSLATION_LANGUAGES"] = {
        "es": "Spanish",
        "ms": "Malay",
    }
    current_app.config["DASHBOARD_AI_TRANSLATION_CACHE_DIR"] = str(tmp_path)

    async def fake_ask(_lang: str, _model: str, strings: list[str]) -> list[str]:
        return [f"es:{s}" for s in strings]

    with pytest.raises(ValueError, match="Translate this language"):
        ai_translation.save_translations(_dashboard(), "es", {"Reach": "x"})

    with patch.object(ai_translation, "_ask_claude", side_effect=fake_ask):
        ai_translation.translate_dashboard(_dashboard(), "es")

    ai_translation.save_translations(
        _dashboard(), "es", {"Reach": "Alcance", "Unknown": "ignored"}
    )
    with pytest.raises(ValueError, match="expressions"):
        ai_translation.save_translations(_dashboard(), "es", {TEMPLATE: "<h3>X</h3>"})

    listed = ai_translation.list_translations(_dashboard())
    assert listed["translations"]["ms"] is None
    saved = listed["translations"]["es"]
    assert saved["translations"]["Reach"] == "Alcance"
    assert "Unknown" not in saved["translations"]
    assert "edited" in saved
    cached = ai_translation.translate_dashboard(_dashboard(), "es")
    assert cached["translations"]["Reach"] == "Alcance"
