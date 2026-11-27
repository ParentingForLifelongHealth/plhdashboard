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
"""Pre-generate AI dashboard translations so viewers get them instantly."""

import sys

import click
from flask import current_app
from flask.cli import with_appcontext
from sqlalchemy import or_

from superset.extensions import db


@click.command()
@with_appcontext
@click.option(
    "--dashboard",
    "-d",
    "dashboards",
    multiple=True,
    help="Dashboard id or slug (repeatable). Default: every dashboard.",
)
@click.option(
    "--language",
    "-l",
    "languages",
    multiple=True,
    help="Language code from DASHBOARD_AI_TRANSLATION_LANGUAGES (repeatable). "
    "Default: every configured language.",
)
@click.option(
    "--force",
    is_flag=True,
    help="Re-translate even when a saved translation already exists.",
)
def translate_dashboards(
    dashboards: tuple[str, ...], languages: tuple[str, ...], force: bool
) -> None:
    """Translate dashboards with AI and save the results to disk."""
    from superset.dashboards.ai_translation import (
        translate_dashboard,
        TranslationError,
    )
    from superset.models.dashboard import Dashboard, id_or_slug_filter

    configured: dict[str, str] = current_app.config[
        "DASHBOARD_AI_TRANSLATION_LANGUAGES"
    ]
    codes = list(languages) or list(configured)
    if not codes:
        raise click.UsageError("DASHBOARD_AI_TRANSLATION_LANGUAGES is empty")
    if unknown := sorted(set(codes) - set(configured)):
        raise click.BadParameter(
            f"{', '.join(unknown)} (configured: {', '.join(configured)})",
            param_hint="--language",
        )

    query = db.session.query(Dashboard).order_by(Dashboard.id)
    if dashboards:
        query = query.filter(or_(*(id_or_slug_filter(d) for d in dashboards)))
    targets = query.all()
    if dashboards and len(targets) < len(dashboards):
        found = {str(d.id) for d in targets} | {d.slug for d in targets}
        missing = [d for d in dashboards if d not in found]
        click.secho(f"Not found: {', '.join(missing)}", fg="yellow")

    total = len(targets) * len(codes)
    counts = {"translated": 0, "cached": 0, "failed": 0}
    click.echo(f"{len(targets)} dashboard(s) x {len(codes)} language(s) = {total}")

    # ponytail: sequential, one Claude call at a time (10-60s each). Fine for a
    # one-off warm-up; parallelise the Claude calls if runs get too slow.
    done = 0
    for dashboard in targets:
        for code in codes:
            done += 1
            label = (
                f"[{done}/{total}] #{dashboard.id} {dashboard.dashboard_title} ({code})"
            )
            try:
                result = translate_dashboard(dashboard, code, force=force)
            except TranslationError as ex:
                counts["failed"] += 1
                click.secho(f"{label}: FAILED {ex}", fg="red")
                continue
            status = "cached" if result["cached"] else "translated"
            counts[status] += 1
            click.echo(f"{label}: {status}")

    click.secho(
        f"Done: {counts['translated']} translated, {counts['cached']} already "
        f"saved, {counts['failed']} failed",
        fg="red" if counts["failed"] else "green",
    )
    if counts["failed"]:
        sys.exit(1)
