"""首次部署证券主数据初始化回归测试。"""
from __future__ import annotations

from unittest.mock import MagicMock

import polars as pl

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
