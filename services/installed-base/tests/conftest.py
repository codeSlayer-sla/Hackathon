import os

import pytest

# Must run before `app.main` is imported anywhere in the test session --
# DB_PATH is read at module import time. ":memory:" gives every app
# lifespan startup (i.e. every `with TestClient(app)`) a fresh, isolated,
# auto-seeded database.
os.environ.setdefault("INSTALLED_BASE_DB_PATH", ":memory:")


@pytest.fixture
def anyio_backend():
    # Pin the anyio pytest plugin (pulled in transitively via httpx/starlette)
    # to asyncio only, so `@pytest.mark.anyio` tests don't also try (and fail)
    # to run against trio, which isn't installed.
    return "asyncio"
