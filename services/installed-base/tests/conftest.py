import os

# Must run before `app.main` is imported anywhere in the test session --
# DB_PATH is read at module import time. ":memory:" gives every app
# lifespan startup (i.e. every `with TestClient(app)`) a fresh, isolated,
# auto-seeded database.
os.environ.setdefault("INSTALLED_BASE_DB_PATH", ":memory:")
