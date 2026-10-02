import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

_bootstrap_directory = tempfile.TemporaryDirectory(prefix="la-petite-jauge-tests-")
os.environ["CARNET_ESSENCE_DB"] = str(Path(_bootstrap_directory.name) / "bootstrap.db")

from backend import app as api


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(api, "DATABASE", tmp_path / "carnet_essence.db")
    api.initialize_database()
    with TestClient(api.app) as test_client:
        yield test_client