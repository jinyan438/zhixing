"""首次部署证券主数据初始化回归测试。"""
from __future__ import annotations

from unittest.mock import MagicMock

import polars as pl

import app.main as main_module
from app.jobs import daily_pipeline


class _Repo:
    def __init__(self, instruments: pl.DataFrame) -> None:
        self._instruments = instruments

    def get_instruments(self) -> pl.DataFrame:
        return self._instruments


def test_bootstrap_keeps_existing_instruments(monkeypatch):
    repo = _Repo(pl.DataFrame({"symbol": ["600519.SH"]}))
    monkeypatch.setattr(daily_pipeline._prefs, "get_daily_data_provider", lambda: "stocksdk")
    sync = MagicMock()
    monkeypatch.setattr(daily_pipeline, "run_instruments_sync", sync)

    result = daily_pipeline.bootstrap_instruments_if_needed(repo)

    assert result == {"status": "ready", "provider": "stocksdk", "instruments_rows": 1}
    sync.assert_not_called()


def test_bootstrap_syncs_selected_plugin_when_instruments_empty(monkeypatch):
    repo = _Repo(pl.DataFrame())
    monkeypatch.setattr(daily_pipeline._prefs, "get_daily_data_provider", lambda: "stocksdk")
    sync = MagicMock(return_value={"instruments_rows": 5557})
    monkeypatch.setattr(daily_pipeline, "run_instruments_sync", sync)

    result = daily_pipeline.bootstrap_instruments_if_needed(repo)

    assert result == {"status": "synced", "provider": "stocksdk", "instruments_rows": 5557}
    sync.assert_called_once_with(repo)


def test_bootstrap_does_not_auto_switch_tickflow(monkeypatch):
    repo = _Repo(pl.DataFrame())
    monkeypatch.setattr(daily_pipeline._prefs, "get_daily_data_provider", lambda: "tickflow")
    sync = MagicMock()
    monkeypatch.setattr(daily_pipeline, "run_instruments_sync", sync)

    result = daily_pipeline.bootstrap_instruments_if_needed(repo)

    assert result == {"status": "skipped", "provider": "tickflow", "instruments_rows": 0}
    sync.assert_not_called()


def test_startup_bootstraps_instruments_after_providers_load(monkeypatch):
    repo = MagicMock()
    bootstrap = MagicMock(return_value={
        "status": "synced",
        "provider": "stocksdk",
        "instruments_rows": 5557,
    })
    monkeypatch.setattr(daily_pipeline, "bootstrap_instruments_if_needed", bootstrap)

    main_module._bootstrap_instruments_on_startup(repo)

    bootstrap.assert_called_once_with(repo)


def test_startup_instruments_bootstrap_failure_is_isolated(monkeypatch):
    repo = MagicMock()
    bootstrap = MagicMock(side_effect=RuntimeError("temporary provider failure"))
    log_exception = MagicMock()
    monkeypatch.setattr(daily_pipeline, "bootstrap_instruments_if_needed", bootstrap)
    monkeypatch.setattr(main_module.logger, "exception", log_exception)

    main_module._bootstrap_instruments_on_startup(repo)

    bootstrap.assert_called_once_with(repo)
    log_exception.assert_called_once_with("startup instruments bootstrap failed")
