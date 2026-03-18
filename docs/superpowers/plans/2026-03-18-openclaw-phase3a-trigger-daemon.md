# Phase 3a: Trigger Daemon & Paperclip Activation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Aware-style trigger daemon that replaces all legacy cron jobs, enables self-adaptive agent awareness, and activates Paperclip task execution with Slack-based L3 approvals.

**Architecture:** Single-process Python asyncio service with four concurrent tasks (poller, HTTP listener, inotify watcher, Slack Socket Mode client). Modular package at `~/.openclaw/triggers/daemon/` with SQLite state. Invokes agents via `openclaw agent` CLI. See spec: `docs/superpowers/specs/2026-03-18-openclaw-phase3a-trigger-daemon-design.md`

**Tech Stack:** Python 3.11+, asyncio, aiohttp, inotify-simple, croniter, jsonpath-ng, slack-sdk, pyyaml, SQLite

---

## File Structure

```
~/.openclaw/triggers/
├── daemon/
│   ├── __init__.py            ← package init, version
│   ├── __main__.py            ← entry point, wires all components into asyncio loop
│   ├── config.py              ← loads triggers.json per agent, watches for changes, env var expansion
│   ├── state.py               ← SQLite wrapper: trigger_state, audit_log, approvals, plaza_counts
│   ├── focus.py               ← reads focus.md, parses {focus_ref:} tags, checks [x] status
│   ├── autonomy.py            ← reads autonomy.json, gates actions by L1/L2/L3
│   ├── executor.py            ← invokes agents via CLI, groups triggers, dedup window
│   ├── poller.py              ← 30s poll cycle: cron, interval, once, poll triggers
│   ├── watcher.py             ← inotify on inbox/ dirs, parses YAML frontmatter, fires on_message
│   ├── listener.py            ← aiohttp server: /health, /metrics, /hook/*, /triggers/*, /audit
│   ├── approval.py            ← Slack Socket Mode: send Block Kit messages, handle callbacks
│   └── plaza.py               ← post count enforcement per agent per cycle
├── requirements.txt
├── watchdog-alert.sh          ← Slack webhook alert on daemon restart
├── daemon.db                  ← created at runtime by state.py
└── audit.log                  ← created at runtime
```

**Config files touched (per agent × 9):**
- `~/.openclaw/agents/{name}/agent/triggers.json` — populated with trigger definitions
- `~/.openclaw/agents/{name}/agent/autonomy.json` — populated with L1/L2/L3 matrix
- `~/.openclaw/agents/{name}/agent/focus.md` — seeded with initial goals

**Other files:**
- `~/.config/systemd/user/trigger-daemon.service` — systemd unit
- `~/.openclaw/cron/jobs.json` — backed up then cleared after migration
- System crontab — add watchdog entry

**Directories created:**
- `~/.openclaw/triggers/` — daemon home
- `~/.openclaw/approvals/pending/`, `approved/`, `denied/`, `expired/`
- `~/.openclaw/plaza/` — placeholder for Phase 3b

---

## Task 1: Project Setup & SQLite Foundation

**Files:**
- Create: `~/.openclaw/triggers/requirements.txt`
- Create: `~/.openclaw/triggers/daemon/__init__.py`
- Create: `~/.openclaw/triggers/daemon/state.py`
- Test: `~/.openclaw/triggers/tests/test_state.py`

- [ ] **Step 1: Create project directory and venv**

```bash
mkdir -p ~/.openclaw/triggers/daemon
mkdir -p ~/.openclaw/triggers/tests
touch ~/.openclaw/triggers/tests/__init__.py
mkdir -p ~/.openclaw/approvals/{pending,approved,denied,expired}
mkdir -p ~/.openclaw/plaza
cd ~/.openclaw/triggers
python3 -m venv .venv
source .venv/bin/activate
```

- [ ] **Step 2: Write requirements.txt**

```
aiohttp>=3.9
inotify-simple>=1.3
croniter>=1.0
jsonpath-ng>=1.5
slack-sdk>=3.0
pyyaml>=6.0
pytest>=8.0
pytest-asyncio>=0.23
```

- [ ] **Step 3: Install dependencies**

```bash
cd ~/.openclaw/triggers
source .venv/bin/activate
pip install -r requirements.txt
```

- [ ] **Step 4: Write `__init__.py`**

```python
"""OpenClaw Trigger Daemon — Aware-style autonomous agent awareness engine."""
__version__ = "0.1.0"
```

- [ ] **Step 5: Write the failing test for state.py**

Create `~/.openclaw/triggers/tests/test_state.py`:

```python
import os
import tempfile
import pytest
from daemon.state import StateDB


@pytest.fixture
def db():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        path = f.name
    s = StateDB(path)
    yield s
    s.close()
    os.unlink(path)


def test_create_tables(db):
    """Tables should exist after init."""
    tables = db.list_tables()
    assert "trigger_state" in tables
    assert "audit_log" in tables
    assert "approvals" in tables
    assert "plaza_counts" in tables


def test_upsert_and_get_trigger_state(db):
    db.upsert_trigger_state("worker", "dude-morning", last_fire_at="2026-03-18T09:00:00Z", fire_count=1)
    row = db.get_trigger_state("worker", "dude-morning")
    assert row["fire_count"] == 1
    assert row["last_fire_at"] == "2026-03-18T09:00:00Z"
    assert row["consecutive_failures"] == 0
    assert row["enabled"] == 1


def test_increment_failure(db):
    db.upsert_trigger_state("worker", "dude-morning")
    db.increment_failure("worker", "dude-morning")
    db.increment_failure("worker", "dude-morning")
    row = db.get_trigger_state("worker", "dude-morning")
    assert row["consecutive_failures"] == 2


def test_reset_failure_on_success(db):
    db.upsert_trigger_state("worker", "dude-morning", consecutive_failures=3)
    db.record_success("worker", "dude-morning", fire_at="2026-03-18T10:00:00Z")
    row = db.get_trigger_state("worker", "dude-morning")
    assert row["consecutive_failures"] == 0
    assert row["fire_count"] == 1


def test_auto_disable_after_5_failures(db):
    db.upsert_trigger_state("worker", "dude-morning")
    for _ in range(5):
        db.increment_failure("worker", "dude-morning")
    row = db.get_trigger_state("worker", "dude-morning")
    assert row["enabled"] == 0
    assert row["consecutive_failures"] == 5


def test_write_and_read_audit(db):
    db.write_audit(
        event_type="FIRE", agent_id="worker", trigger_id="dude-morning",
        trigger_type="cron", detail="focus:null", autonomy_level="L2",
        status="ok", duration_ms=1230
    )
    rows = db.recent_audit(limit=10)
    assert len(rows) == 1
    assert rows[0]["event_type"] == "FIRE"
    assert rows[0]["duration_ms"] == 1230


def test_create_and_resolve_approval(db):
    db.create_approval(
        approval_id="walter-deploy-001", agent_id="cto", trigger_id="walter-deploy",
        action_type="deployment", prompt="Deploy gateway config",
        slack_message_ts="1234567890.123456"
    )
    pending = db.get_pending_approvals()
    assert len(pending) == 1
    assert pending[0]["agent_id"] == "cto"

    db.resolve_approval("walter-deploy-001", status="approved", decided_by="charlie")
    pending = db.get_pending_approvals()
    assert len(pending) == 0


def test_plaza_count_enforcement(db):
    db.increment_plaza_count("worker", "2026-03-18T09:00:00Z", post=True)
    assert db.can_post("worker", "2026-03-18T09:00:00Z") is False  # 1 post max
    assert db.can_comment("worker", "2026-03-18T09:00:00Z") is True  # 2 comments left
    db.increment_plaza_count("worker", "2026-03-18T09:00:00Z", post=False)
    db.increment_plaza_count("worker", "2026-03-18T09:00:00Z", post=False)
    assert db.can_comment("worker", "2026-03-18T09:00:00Z") is False
```

- [ ] **Step 6: Run test to verify it fails**

```bash
cd ~/.openclaw/triggers
source .venv/bin/activate
PYTHONPATH=. python -m pytest tests/test_state.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'daemon.state'`

- [ ] **Step 7: Implement state.py**

Create `~/.openclaw/triggers/daemon/state.py`:

```python
"""SQLite state management for trigger daemon."""
import sqlite3
from datetime import datetime, timezone
from typing import Optional


class StateDB:
    def __init__(self, db_path: str):
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self._create_tables()

    def _create_tables(self):
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS trigger_state (
                trigger_id TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                last_fire_at TEXT,
                next_fire_at TEXT,
                fire_count INTEGER DEFAULT 0,
                consecutive_failures INTEGER DEFAULT 0,
                enabled INTEGER DEFAULT 1,
                config_hash TEXT,
                PRIMARY KEY (agent_id, trigger_id)
            );
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                event_type TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                trigger_id TEXT,
                trigger_type TEXT,
                detail TEXT,
                autonomy_level TEXT,
                status TEXT,
                duration_ms INTEGER
            );
            CREATE TABLE IF NOT EXISTS approvals (
                id TEXT PRIMARY KEY,
                agent_id TEXT NOT NULL,
                trigger_id TEXT NOT NULL,
                action_type TEXT NOT NULL,
                prompt TEXT NOT NULL,
                created_at TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                decided_at TEXT,
                decided_by TEXT,
                slack_message_ts TEXT
            );
            CREATE TABLE IF NOT EXISTS plaza_counts (
                agent_id TEXT NOT NULL,
                cycle_id TEXT NOT NULL,
                posts INTEGER DEFAULT 0,
                comments INTEGER DEFAULT 0,
                PRIMARY KEY (agent_id, cycle_id)
            );
        """)
        self.conn.commit()

    def list_tables(self) -> list[str]:
        rows = self.conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
        return [r["name"] for r in rows]

    def close(self):
        self.conn.close()

    # -- Trigger State --

    def upsert_trigger_state(self, agent_id: str, trigger_id: str, **kwargs):
        existing = self.get_trigger_state(agent_id, trigger_id)
        if existing:
            sets = []
            vals = []
            for k, v in kwargs.items():
                sets.append(f"{k} = ?")
                vals.append(v)
            if sets:
                vals.extend([agent_id, trigger_id])
                self.conn.execute(
                    f"UPDATE trigger_state SET {', '.join(sets)} WHERE agent_id = ? AND trigger_id = ?",
                    vals
                )
                self.conn.commit()
        else:
            cols = ["agent_id", "trigger_id"] + list(kwargs.keys())
            vals = [agent_id, trigger_id] + list(kwargs.values())
            placeholders = ", ".join(["?"] * len(vals))
            self.conn.execute(
                f"INSERT INTO trigger_state ({', '.join(cols)}) VALUES ({placeholders})",
                vals
            )
            self.conn.commit()

    def get_trigger_state(self, agent_id: str, trigger_id: str) -> Optional[dict]:
        row = self.conn.execute(
            "SELECT * FROM trigger_state WHERE agent_id = ? AND trigger_id = ?",
            (agent_id, trigger_id)
        ).fetchone()
        return dict(row) if row else None

    def increment_failure(self, agent_id: str, trigger_id: str) -> bool:
        """Increment failure count. Returns True if trigger was auto-disabled (5 failures)."""
        # Ensure row exists first (upsert)
        self.upsert_trigger_state(agent_id, trigger_id)
        self.conn.execute(
            "UPDATE trigger_state SET consecutive_failures = consecutive_failures + 1 WHERE agent_id = ? AND trigger_id = ?",
            (agent_id, trigger_id)
        )
        # Auto-disable after 5 consecutive failures
        self.conn.execute(
            "UPDATE trigger_state SET enabled = 0 WHERE agent_id = ? AND trigger_id = ? AND consecutive_failures >= 5",
            (agent_id, trigger_id)
        )
        self.conn.commit()
        row = self.get_trigger_state(agent_id, trigger_id)
        return row is not None and row["consecutive_failures"] >= 5

    def record_success(self, agent_id: str, trigger_id: str, fire_at: str):
        # Ensure row exists first (upsert)
        self.upsert_trigger_state(agent_id, trigger_id)
        self.conn.execute(
            "UPDATE trigger_state SET consecutive_failures = 0, fire_count = fire_count + 1, last_fire_at = ? WHERE agent_id = ? AND trigger_id = ?",
            (fire_at, agent_id, trigger_id)
        )
        self.conn.commit()

    # -- Audit Log --

    def write_audit(self, event_type: str, agent_id: str, trigger_id: str = None,
                    trigger_type: str = None, detail: str = None,
                    autonomy_level: str = None, status: str = None,
                    duration_ms: int = None):
        now = datetime.now(timezone.utc).isoformat()
        self.conn.execute(
            "INSERT INTO audit_log (timestamp, event_type, agent_id, trigger_id, trigger_type, detail, autonomy_level, status, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (now, event_type, agent_id, trigger_id, trigger_type, detail, autonomy_level, status, duration_ms)
        )
        self.conn.commit()

    def recent_audit(self, limit: int = 100) -> list[dict]:
        rows = self.conn.execute(
            "SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]

    # -- Approvals --

    def create_approval(self, approval_id: str, agent_id: str, trigger_id: str,
                       action_type: str, prompt: str, slack_message_ts: str = None):
        now = datetime.now(timezone.utc).isoformat()
        self.conn.execute(
            "INSERT INTO approvals (id, agent_id, trigger_id, action_type, prompt, created_at, slack_message_ts) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (approval_id, agent_id, trigger_id, action_type, prompt, now, slack_message_ts)
        )
        self.conn.commit()

    def resolve_approval(self, approval_id: str, status: str, decided_by: str = None):
        now = datetime.now(timezone.utc).isoformat()
        self.conn.execute(
            "UPDATE approvals SET status = ?, decided_at = ?, decided_by = ? WHERE id = ?",
            (status, now, decided_by, approval_id)
        )
        self.conn.commit()

    def get_pending_approvals(self) -> list[dict]:
        rows = self.conn.execute(
            "SELECT * FROM approvals WHERE status = 'pending' ORDER BY created_at"
        ).fetchall()
        return [dict(r) for r in rows]

    def expire_old_approvals(self, max_age_hours: int = 4) -> list[dict]:
        """Expire approvals older than max_age_hours. Returns expired list."""
        cutoff = datetime.now(timezone.utc)
        rows = self.conn.execute(
            "SELECT * FROM approvals WHERE status = 'pending'"
        ).fetchall()
        expired = []
        for row in rows:
            created = datetime.fromisoformat(row["created_at"])
            age_hours = (cutoff - created).total_seconds() / 3600
            if age_hours >= max_age_hours:
                self.resolve_approval(row["id"], status="expired")
                expired.append(dict(row))
        return expired

    # -- Plaza Counts --

    def increment_plaza_count(self, agent_id: str, cycle_id: str, post: bool):
        existing = self.conn.execute(
            "SELECT * FROM plaza_counts WHERE agent_id = ? AND cycle_id = ?",
            (agent_id, cycle_id)
        ).fetchone()
        if existing:
            col = "posts" if post else "comments"
            self.conn.execute(
                f"UPDATE plaza_counts SET {col} = {col} + 1 WHERE agent_id = ? AND cycle_id = ?",
                (agent_id, cycle_id)
            )
        else:
            self.conn.execute(
                "INSERT INTO plaza_counts (agent_id, cycle_id, posts, comments) VALUES (?, ?, ?, ?)",
                (agent_id, cycle_id, 1 if post else 0, 0 if post else 1)
            )
        self.conn.commit()

    def can_post(self, agent_id: str, cycle_id: str) -> bool:
        row = self.conn.execute(
            "SELECT posts FROM plaza_counts WHERE agent_id = ? AND cycle_id = ?",
            (agent_id, cycle_id)
        ).fetchone()
        return row is None or row["posts"] < 1

    def can_comment(self, agent_id: str, cycle_id: str) -> bool:
        row = self.conn.execute(
            "SELECT comments FROM plaza_counts WHERE agent_id = ? AND cycle_id = ?",
            (agent_id, cycle_id)
        ).fetchone()
        return row is None or row["comments"] < 2
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
cd ~/.openclaw/triggers
source .venv/bin/activate
PYTHONPATH=. python -m pytest tests/test_state.py -v
```

Expected: All 8 tests PASS

- [ ] **Step 9: Commit**

```bash
cd ~/.openclaw/triggers
git init
git add daemon/__init__.py daemon/state.py tests/test_state.py requirements.txt
git commit -m "feat: add SQLite state module with trigger_state, audit, approvals, plaza tables"
```

---

## Task 2: Config Loader

**Files:**
- Create: `~/.openclaw/triggers/daemon/config.py`
- Test: `~/.openclaw/triggers/tests/test_config.py`

- [ ] **Step 1: Write the failing test**

Create `~/.openclaw/triggers/tests/test_config.py`:

```python
import json
import os
import tempfile
import pytest
from daemon.config import ConfigLoader

AGENTS_DIR = None
AGENTS = ["worker", "cto"]


@pytest.fixture
def agents_dir(tmp_path):
    for name in AGENTS:
        agent_dir = tmp_path / name / "agent"
        agent_dir.mkdir(parents=True)
        triggers = {
            "triggers": [
                {
                    "id": f"{name}-heartbeat",
                    "type": "interval",
                    "config": {"minutes": 30},
                    "action_type": "heartbeat",
                    "focus_ref": None,
                    "reason": "Test heartbeat",
                    "enabled": True,
                    "cooldown_seconds": 300,
                    "prompt": "Run heartbeat check."
                }
            ]
        }
        (agent_dir / "triggers.json").write_text(json.dumps(triggers))
    return tmp_path


def test_load_all_triggers(agents_dir):
    loader = ConfigLoader(str(agents_dir))
    all_triggers = loader.load_all()
    assert "worker" in all_triggers
    assert "cto" in all_triggers
    assert len(all_triggers["worker"]) == 1
    assert all_triggers["worker"][0]["id"] == "worker-heartbeat"


def test_env_var_expansion(agents_dir):
    os.environ["TEST_SECRET"] = "my-secret-value"
    agent_dir = agents_dir / "worker" / "agent"
    triggers = {
        "triggers": [
            {
                "id": "worker-webhook",
                "type": "webhook",
                "config": {"path": "/hook/test", "secret": "${TEST_SECRET}"},
                "action_type": "research",
                "focus_ref": None,
                "reason": "Test webhook",
                "enabled": True,
                "cooldown_seconds": 60,
                "prompt": "Handle webhook."
            }
        ]
    }
    (agent_dir / "triggers.json").write_text(json.dumps(triggers))
    loader = ConfigLoader(str(agents_dir))
    all_triggers = loader.load_all()
    assert all_triggers["worker"][0]["config"]["secret"] == "my-secret-value"
    del os.environ["TEST_SECRET"]


def test_missing_env_var_disables_trigger(agents_dir):
    agent_dir = agents_dir / "worker" / "agent"
    triggers = {
        "triggers": [
            {
                "id": "worker-webhook",
                "type": "webhook",
                "config": {"path": "/hook/test", "secret": "${NONEXISTENT_VAR_XYZ}"},
                "action_type": "research",
                "focus_ref": None,
                "reason": "Test webhook",
                "enabled": True,
                "cooldown_seconds": 60,
                "prompt": "Handle webhook."
            }
        ]
    }
    (agent_dir / "triggers.json").write_text(json.dumps(triggers))
    loader = ConfigLoader(str(agents_dir))
    all_triggers = loader.load_all()
    assert all_triggers["worker"][0]["enabled"] is False


def test_guardrails_max_triggers(agents_dir):
    agent_dir = agents_dir / "worker" / "agent"
    triggers = {
        "triggers": [
            {
                "id": f"trigger-{i}",
                "type": "interval",
                "config": {"minutes": 30},
                "action_type": "heartbeat",
                "focus_ref": None,
                "reason": f"Trigger {i}",
                "enabled": True,
                "cooldown_seconds": 300,
                "prompt": f"Do thing {i}."
            }
            for i in range(25)
        ]
    }
    (agent_dir / "triggers.json").write_text(json.dumps(triggers))
    loader = ConfigLoader(str(agents_dir))
    all_triggers = loader.load_all()
    assert len(all_triggers["worker"]) == 20  # capped at 20


def test_guardrails_min_cooldown(agents_dir):
    agent_dir = agents_dir / "worker" / "agent"
    triggers = {
        "triggers": [
            {
                "id": "fast-trigger",
                "type": "interval",
                "config": {"minutes": 1},
                "action_type": "heartbeat",
                "focus_ref": None,
                "reason": "Too fast",
                "enabled": True,
                "cooldown_seconds": 10,
                "prompt": "Do thing."
            }
        ]
    }
    (agent_dir / "triggers.json").write_text(json.dumps(triggers))
    loader = ConfigLoader(str(agents_dir))
    all_triggers = loader.load_all()
    assert all_triggers["worker"][0]["cooldown_seconds"] == 60  # enforced minimum


def test_on_message_exempt_from_min_cooldown(agents_dir):
    agent_dir = agents_dir / "worker" / "agent"
    triggers = {
        "triggers": [
            {
                "id": "msg-trigger",
                "type": "on_message",
                "config": {"watch_inbox": True, "from_agents": ["jr"]},
                "action_type": "research",
                "focus_ref": None,
                "reason": "Inbox",
                "enabled": True,
                "cooldown_seconds": 0,
                "prompt": "Read message."
            }
        ]
    }
    (agent_dir / "triggers.json").write_text(json.dumps(triggers))
    loader = ConfigLoader(str(agents_dir))
    all_triggers = loader.load_all()
    assert all_triggers["worker"][0]["cooldown_seconds"] == 0  # exempt


def test_config_hash_changes_on_file_update(agents_dir):
    loader = ConfigLoader(str(agents_dir))
    hash1 = loader.get_config_hash("worker")
    # Modify triggers
    agent_dir = agents_dir / "worker" / "agent"
    triggers = {"triggers": []}
    (agent_dir / "triggers.json").write_text(json.dumps(triggers))
    loader.reload("worker")
    hash2 = loader.get_config_hash("worker")
    assert hash1 != hash2
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/.openclaw/triggers && source .venv/bin/activate
PYTHONPATH=. python -m pytest tests/test_config.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'daemon.config'`

- [ ] **Step 3: Implement config.py**

Create `~/.openclaw/triggers/daemon/config.py`:

```python
"""Loads and watches triggers.json per agent with guardrails and env var expansion."""
import hashlib
import json
import os
import re
from pathlib import Path
from typing import Optional

MAX_TRIGGERS_PER_AGENT = 20
MIN_COOLDOWN_SECONDS = 60
COOLDOWN_EXEMPT_TYPES = {"on_message"}

ENV_VAR_PATTERN = re.compile(r'\$\{([^}]+)\}')


def _expand_env_vars(obj):
    """Recursively expand ${VAR} in strings. Returns (expanded_obj, missing_vars)."""
    missing = []
    if isinstance(obj, str):
        def replacer(match):
            var_name = match.group(1)
            val = os.environ.get(var_name)
            if val is None:
                missing.append(var_name)
                return match.group(0)  # leave as-is
            return val
        return ENV_VAR_PATTERN.sub(replacer, obj), missing
    elif isinstance(obj, dict):
        result = {}
        for k, v in obj.items():
            expanded, m = _expand_env_vars(v)
            result[k] = expanded
            missing.extend(m)
        return result, missing
    elif isinstance(obj, list):
        result = []
        for item in obj:
            expanded, m = _expand_env_vars(item)
            result.append(expanded)
            missing.extend(m)
        return result, missing
    return obj, missing


class ConfigLoader:
    def __init__(self, agents_dir: str):
        self.agents_dir = Path(agents_dir)
        self._triggers: dict[str, list[dict]] = {}
        self._hashes: dict[str, str] = {}
        self._warnings: list[str] = []

    def load_all(self) -> dict[str, list[dict]]:
        self._triggers.clear()
        self._hashes.clear()
        self._warnings.clear()
        for agent_dir in sorted(self.agents_dir.iterdir()):
            if not agent_dir.is_dir() or agent_dir.name.startswith('.'):
                continue
            triggers_file = agent_dir / "agent" / "triggers.json"
            if triggers_file.exists():
                self._load_agent(agent_dir.name, triggers_file)
        return self._triggers

    def reload(self, agent_id: str):
        triggers_file = self.agents_dir / agent_id / "agent" / "triggers.json"
        if triggers_file.exists():
            self._load_agent(agent_id, triggers_file)

    def get_config_hash(self, agent_id: str) -> Optional[str]:
        return self._hashes.get(agent_id)

    @property
    def warnings(self) -> list[str]:
        return self._warnings

    def _load_agent(self, agent_id: str, path: Path):
        raw = path.read_text()
        self._hashes[agent_id] = hashlib.sha256(raw.encode()).hexdigest()

        data = json.loads(raw)
        triggers = data.get("triggers", [])

        # Guardrail: max triggers
        if len(triggers) > MAX_TRIGGERS_PER_AGENT:
            self._warnings.append(
                f"{agent_id}: {len(triggers)} triggers exceeds max {MAX_TRIGGERS_PER_AGENT}, truncating"
            )
            triggers = triggers[:MAX_TRIGGERS_PER_AGENT]

        processed = []
        for t in triggers:
            # Env var expansion
            expanded, missing = _expand_env_vars(t)
            if missing:
                self._warnings.append(
                    f"{agent_id}/{t['id']}: missing env vars {missing}, disabling trigger"
                )
                expanded["enabled"] = False

            # Guardrail: min cooldown (on_message exempt)
            trigger_type = expanded.get("type", "")
            cooldown = expanded.get("cooldown_seconds", 0)
            if trigger_type not in COOLDOWN_EXEMPT_TYPES and cooldown < MIN_COOLDOWN_SECONDS:
                expanded["cooldown_seconds"] = MIN_COOLDOWN_SECONDS

            processed.append(expanded)

        self._triggers[agent_id] = processed
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/.openclaw/triggers && source .venv/bin/activate
PYTHONPATH=. python -m pytest tests/test_config.py -v
```

Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
cd ~/.openclaw/triggers
git add daemon/config.py tests/test_config.py
git commit -m "feat: add config loader with env var expansion and guardrails"
```

---

## Task 3: Focus System

**Files:**
- Create: `~/.openclaw/triggers/daemon/focus.py`
- Test: `~/.openclaw/triggers/tests/test_focus.py`

- [ ] **Step 1: Write the failing test**

Create `~/.openclaw/triggers/tests/test_focus.py`:

```python
import pytest
from daemon.focus import FocusReader


@pytest.fixture
def focus_file(tmp_path):
    content = """# Focus — Dude (Worker)

## Active Goals
- [ ] Stand up Paperclip pipeline {focus_ref: task-execution}
- [/] Morning brief pipeline {focus_ref: morning-brief}
- [ ] Research PowerApps {focus_ref: powerapps-research}

## Completed
- [x] Phase 2 agent onboarding {focus_ref: phase2-onboard}
"""
    f = tmp_path / "focus.md"
    f.write_text(content)
    return str(f)


def test_parse_focus_refs(focus_file):
    reader = FocusReader(focus_file)
    refs = reader.all_refs()
    assert "task-execution" in refs
    assert "morning-brief" in refs
    assert "powerapps-research" in refs
    assert "phase2-onboard" in refs


def test_completed_refs(focus_file):
    reader = FocusReader(focus_file)
    completed = reader.completed_refs()
    assert "phase2-onboard" in completed
    assert "task-execution" not in completed
    assert "morning-brief" not in completed


def test_is_active(focus_file):
    reader = FocusReader(focus_file)
    assert reader.is_active("task-execution") is True
    assert reader.is_active("morning-brief") is True  # [/] counts as active
    assert reader.is_active("phase2-onboard") is False
    assert reader.is_active("nonexistent") is False  # unknown ref = not active


def test_should_trigger_fire(focus_file):
    reader = FocusReader(focus_file)
    # Trigger with completed focus_ref should NOT fire
    assert reader.should_fire("phase2-onboard") is False
    # Trigger with active focus_ref should fire
    assert reader.should_fire("task-execution") is True
    # Trigger with null focus_ref always fires (system trigger)
    assert reader.should_fire(None) is True
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/.openclaw/triggers && source .venv/bin/activate
PYTHONPATH=. python -m pytest tests/test_focus.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'daemon.focus'`

- [ ] **Step 3: Implement focus.py**

Create `~/.openclaw/triggers/daemon/focus.py`:

```python
"""Reads focus.md and determines which focus_refs are active vs completed."""
import re
from pathlib import Path
from typing import Optional

# Matches: - [ ] text {focus_ref: value} or - [x] text {focus_ref: value} or - [/] text {focus_ref: value}
FOCUS_LINE = re.compile(r'^-\s+\[(.)\]\s+.*\{focus_ref:\s*([^}]+)\}', re.MULTILINE)


class FocusReader:
    def __init__(self, focus_path: str):
        self.path = Path(focus_path)
        self._refs: dict[str, str] = {}  # ref -> status char (' ', 'x', '/')
        self._parse()

    def _parse(self):
        if not self.path.exists():
            return
        content = self.path.read_text()
        for match in FOCUS_LINE.finditer(content):
            status_char = match.group(1)
            ref = match.group(2).strip()
            self._refs[ref] = status_char

    def reload(self):
        self._refs.clear()
        self._parse()

    def all_refs(self) -> set[str]:
        return set(self._refs.keys())

    def completed_refs(self) -> set[str]:
        return {ref for ref, status in self._refs.items() if status == 'x'}

    def is_active(self, focus_ref: str) -> bool:
        if focus_ref not in self._refs:
            return False
        return self._refs[focus_ref] != 'x'

    def should_fire(self, focus_ref: Optional[str]) -> bool:
        """Determine if a trigger with this focus_ref should fire.
        None = system trigger, always fires.
        Active ref = fires.
        Completed ref = does not fire.
        Unknown ref = does not fire (orphaned trigger).
        """
        if focus_ref is None:
            return True
        return self.is_active(focus_ref)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/.openclaw/triggers && source .venv/bin/activate
PYTHONPATH=. python -m pytest tests/test_focus.py -v
```

Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
cd ~/.openclaw/triggers
git add daemon/focus.py tests/test_focus.py
git commit -m "feat: add focus reader with focus_ref binding and completion detection"
```

---

## Task 4: Autonomy Gate

**Files:**
- Create: `~/.openclaw/triggers/daemon/autonomy.py`
- Test: `~/.openclaw/triggers/tests/test_autonomy.py`

- [ ] **Step 1: Write the failing test**

Create `~/.openclaw/triggers/tests/test_autonomy.py`:

```python
import json
import pytest
from daemon.autonomy import AutonomyGate, AutonomyLevel


@pytest.fixture
def autonomy_file(tmp_path):
    data = {
        "autonomy": {
            "heartbeat": "L1",
            "research": "L2",
            "deployment": "L3",
            "config_change": "L3"
        }
    }
    f = tmp_path / "autonomy.json"
    f.write_text(json.dumps(data))
    return str(f)


def test_load_autonomy(autonomy_file):
    gate = AutonomyGate(autonomy_file)
    assert gate.get_level("heartbeat") == AutonomyLevel.L1
    assert gate.get_level("research") == AutonomyLevel.L2
    assert gate.get_level("deployment") == AutonomyLevel.L3


def test_unknown_action_defaults_to_l3(autonomy_file):
    gate = AutonomyGate(autonomy_file)
    assert gate.get_level("unknown_action") == AutonomyLevel.L3


def test_should_execute(autonomy_file):
    gate = AutonomyGate(autonomy_file)
    assert gate.should_execute("heartbeat") is True    # L1 = auto
    assert gate.should_execute("research") is True     # L2 = auto
    assert gate.should_execute("deployment") is False  # L3 = block


def test_should_notify(autonomy_file):
    gate = AutonomyGate(autonomy_file)
    assert gate.should_notify("heartbeat") is False   # L1 = log only
    assert gate.should_notify("research") is True     # L2 = notify
    assert gate.should_notify("deployment") is True   # L3 = notify (approval msg)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/.openclaw/triggers && source .venv/bin/activate
PYTHONPATH=. python -m pytest tests/test_autonomy.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'daemon.autonomy'`

- [ ] **Step 3: Implement autonomy.py**

Create `~/.openclaw/triggers/daemon/autonomy.py`:

```python
"""Reads autonomy.json and gates agent actions by L1/L2/L3."""
import json
from enum import Enum
from pathlib import Path


_LEVEL_ORDER = {"L1": 1, "L2": 2, "L3": 3}


class AutonomyLevel(Enum):
    L1 = "L1"  # auto + log
    L2 = "L2"  # auto + notify
    L3 = "L3"  # block + approve

    def __gt__(self, other):
        return _LEVEL_ORDER[self.value] > _LEVEL_ORDER[other.value]

    def __ge__(self, other):
        return _LEVEL_ORDER[self.value] >= _LEVEL_ORDER[other.value]


class AutonomyGate:
    def __init__(self, autonomy_path: str):
        self.path = Path(autonomy_path)
        self._levels: dict[str, AutonomyLevel] = {}
        self._load()

    def _load(self):
        if not self.path.exists():
            return
        data = json.loads(self.path.read_text())
        for action_type, level_str in data.get("autonomy", {}).items():
            try:
                self._levels[action_type] = AutonomyLevel(level_str)
            except ValueError:
                self._levels[action_type] = AutonomyLevel.L3  # default to safest

    def reload(self):
        self._levels.clear()
        self._load()

    def get_level(self, action_type: str) -> AutonomyLevel:
        return self._levels.get(action_type, AutonomyLevel.L3)

    def should_execute(self, action_type: str) -> bool:
        """L1 and L2 execute immediately. L3 blocks for approval."""
        level = self.get_level(action_type)
        return level in (AutonomyLevel.L1, AutonomyLevel.L2)

    def should_notify(self, action_type: str) -> bool:
        """L2 and L3 send notifications. L1 is log-only."""
        level = self.get_level(action_type)
        return level in (AutonomyLevel.L2, AutonomyLevel.L3)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/.openclaw/triggers && source .venv/bin/activate
PYTHONPATH=. python -m pytest tests/test_autonomy.py -v
```

Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
cd ~/.openclaw/triggers
git add daemon/autonomy.py tests/test_autonomy.py
git commit -m "feat: add autonomy gate with L1/L2/L3 action gating"
```

---

## Task 5: Executor

**Files:**
- Create: `~/.openclaw/triggers/daemon/executor.py`
- Test: `~/.openclaw/triggers/tests/test_executor.py`

- [ ] **Step 1: Write the failing test**

Create `~/.openclaw/triggers/tests/test_executor.py`:

```python
import asyncio
import os
import tempfile
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from daemon.executor import Executor
from daemon.state import StateDB
from daemon.autonomy import AutonomyLevel


@pytest.fixture
def db():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        path = f.name
    s = StateDB(path)
    yield s
    s.close()
    os.unlink(path)


@pytest.fixture
def executor(db):
    return Executor(db, audit_log_path="/dev/null")


@pytest.mark.asyncio
async def test_dedup_same_agent_same_cycle(executor):
    """Multiple triggers for same agent in same cycle should group."""
    triggers = [
        {"id": "t1", "agent_id": "worker", "prompt": "Do A.", "action_type": "heartbeat"},
        {"id": "t2", "agent_id": "worker", "prompt": "Do B.", "action_type": "heartbeat"},
    ]
    grouped = executor.group_by_agent(triggers)
    assert len(grouped) == 1
    assert "worker" in grouped
    assert "Do A." in grouped["worker"]["combined_prompt"]
    assert "Do B." in grouped["worker"]["combined_prompt"]


@pytest.mark.asyncio
async def test_dedup_different_agents(executor):
    triggers = [
        {"id": "t1", "agent_id": "worker", "prompt": "Do A.", "action_type": "heartbeat"},
        {"id": "t2", "agent_id": "cto", "prompt": "Do B.", "action_type": "heartbeat"},
    ]
    grouped = executor.group_by_agent(triggers)
    assert len(grouped) == 2


@pytest.mark.asyncio
@patch("daemon.executor.asyncio.create_subprocess_exec")
async def test_invoke_agent_success(mock_exec, executor):
    mock_proc = AsyncMock()
    mock_proc.communicate.return_value = (b"Agent response", b"")
    mock_proc.returncode = 0
    mock_exec.return_value = mock_proc

    result = await executor.invoke_agent("worker", "Do heartbeat.", timeout=10)
    assert result["success"] is True
    assert result["output"] == "Agent response"

    # Check the CLI command was called correctly
    call_args = mock_exec.call_args[0]
    assert "openclaw" in call_args[0]
    assert "--agent" in call_args
    assert "worker" in call_args


@pytest.mark.asyncio
@patch("daemon.executor.asyncio.create_subprocess_exec")
async def test_invoke_agent_failure(mock_exec, executor):
    mock_proc = AsyncMock()
    mock_proc.communicate.return_value = (b"", b"Error occurred")
    mock_proc.returncode = 1
    mock_exec.return_value = mock_proc

    result = await executor.invoke_agent("worker", "Do thing.", timeout=10)
    assert result["success"] is False
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/.openclaw/triggers && source .venv/bin/activate
PYTHONPATH=. python -m pytest tests/test_executor.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'daemon.executor'`

- [ ] **Step 3: Implement executor.py**

Create `~/.openclaw/triggers/daemon/executor.py`:

```python
"""Invokes agents via openclaw CLI, groups triggers per agent, deduplicates."""
import asyncio
import logging
import time
from pathlib import Path
from typing import Optional

from daemon.state import StateDB

logger = logging.getLogger(__name__)

OPENCLAW_BIN = "openclaw"
DEFAULT_TIMEOUT = 300


class Executor:
    def __init__(self, db: StateDB, audit_log_path: str = None):
        self.db = db
        self.audit_log_path = audit_log_path

    def group_by_agent(self, fired_triggers: list[dict]) -> dict[str, dict]:
        """Group multiple fired triggers into one invocation per agent."""
        groups: dict[str, dict] = {}
        for t in fired_triggers:
            agent_id = t["agent_id"]
            if agent_id not in groups:
                groups[agent_id] = {
                    "trigger_ids": [],
                    "prompts": [],
                    "combined_prompt": "",
                    "action_types": set(),
                }
            groups[agent_id]["trigger_ids"].append(t["id"])
            groups[agent_id]["prompts"].append(t["prompt"])
            groups[agent_id]["action_types"].add(t["action_type"])

        for agent_id, group in groups.items():
            if len(group["prompts"]) == 1:
                group["combined_prompt"] = group["prompts"][0]
            else:
                parts = [f"[{i+1}] {p}" for i, p in enumerate(group["prompts"])]
                group["combined_prompt"] = (
                    "Multiple triggers fired. Handle each:\n\n" + "\n\n".join(parts)
                )

        return groups

    async def invoke_agent(
        self, agent_id: str, prompt: str, timeout: int = DEFAULT_TIMEOUT
    ) -> dict:
        """Invoke an agent via openclaw CLI. Returns result dict."""
        start = time.monotonic()
        try:
            proc = await asyncio.create_subprocess_exec(
                OPENCLAW_BIN, "agent",
                "--agent", agent_id,
                "--message", prompt,
                "--deliver", "--channel", "slack",
                "--timeout", str(timeout),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=timeout + 30
            )
            elapsed_ms = int((time.monotonic() - start) * 1000)

            if proc.returncode == 0:
                return {
                    "success": True,
                    "output": stdout.decode().strip(),
                    "duration_ms": elapsed_ms,
                }
            else:
                return {
                    "success": False,
                    "output": stderr.decode().strip(),
                    "duration_ms": elapsed_ms,
                }
        except asyncio.TimeoutError:
            elapsed_ms = int((time.monotonic() - start) * 1000)
            return {
                "success": False,
                "output": "CLI invocation timed out",
                "duration_ms": elapsed_ms,
            }
        except Exception as e:
            elapsed_ms = int((time.monotonic() - start) * 1000)
            return {
                "success": False,
                "output": str(e),
                "duration_ms": elapsed_ms,
            }

    def write_audit_line(self, line: str):
        """Append to human-readable audit.log."""
        if self.audit_log_path and self.audit_log_path != "/dev/null":
            with open(self.audit_log_path, "a") as f:
                f.write(line + "\n")
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/.openclaw/triggers && source .venv/bin/activate
PYTHONPATH=. python -m pytest tests/test_executor.py -v
```

Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
cd ~/.openclaw/triggers
git add daemon/executor.py tests/test_executor.py
git commit -m "feat: add executor with agent invocation, grouping, and dedup"
```

---

## Task 6: Poller

**Files:**
- Create: `~/.openclaw/triggers/daemon/poller.py`
- Test: `~/.openclaw/triggers/tests/test_poller.py`

- [ ] **Step 1: Write the failing test**

Create `~/.openclaw/triggers/tests/test_poller.py`:

```python
from datetime import datetime, timezone, timedelta
import pytest
from daemon.poller import should_fire_cron, should_fire_interval, should_fire_once, should_fire_poll


def test_cron_match():
    # "0 9 * * *" at 9:00 AM should fire
    now = datetime(2026, 3, 18, 9, 0, 0, tzinfo=timezone.utc)
    config = {"expr": "0 9 * * *", "tz": "UTC"}
    assert should_fire_cron(config, now, last_fire=None) is True


def test_cron_no_match():
    now = datetime(2026, 3, 18, 10, 0, 0, tzinfo=timezone.utc)
    config = {"expr": "0 9 * * *", "tz": "UTC"}
    assert should_fire_cron(config, now, last_fire=None) is False


def test_cron_already_fired_this_window():
    now = datetime(2026, 3, 18, 9, 0, 15, tzinfo=timezone.utc)
    last = "2026-03-18T09:00:01Z"
    config = {"expr": "0 9 * * *", "tz": "UTC"}
    assert should_fire_cron(config, now, last_fire=last) is False


def test_interval_elapsed():
    now = datetime(2026, 3, 18, 10, 0, 0, tzinfo=timezone.utc)
    last = "2026-03-18T09:00:00Z"
    config = {"minutes": 30}
    assert should_fire_interval(config, now, last_fire=last) is True


def test_interval_not_elapsed():
    now = datetime(2026, 3, 18, 9, 15, 0, tzinfo=timezone.utc)
    last = "2026-03-18T09:00:00Z"
    config = {"minutes": 30}
    assert should_fire_interval(config, now, last_fire=last) is False


def test_interval_first_fire():
    now = datetime(2026, 3, 18, 9, 0, 0, tzinfo=timezone.utc)
    config = {"minutes": 30}
    assert should_fire_interval(config, now, last_fire=None) is True


def test_once_before_target():
    now = datetime(2026, 3, 18, 8, 0, 0, tzinfo=timezone.utc)
    config = {"at": "2026-03-18T09:00:00Z"}
    assert should_fire_once(config, now, already_fired=False) is False


def test_once_at_target():
    now = datetime(2026, 3, 18, 9, 0, 30, tzinfo=timezone.utc)
    config = {"at": "2026-03-18T09:00:00Z"}
    assert should_fire_once(config, now, already_fired=False) is True


def test_once_already_fired():
    now = datetime(2026, 3, 18, 9, 5, 0, tzinfo=timezone.utc)
    config = {"at": "2026-03-18T09:00:00Z"}
    assert should_fire_once(config, now, already_fired=True) is False
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/.openclaw/triggers && source .venv/bin/activate
PYTHONPATH=. python -m pytest tests/test_poller.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'daemon.poller'`

- [ ] **Step 3: Implement poller.py**

Create `~/.openclaw/triggers/daemon/poller.py`:

```python
"""30-second poll cycle: evaluates cron, interval, once, and poll triggers."""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import aiohttp
from croniter import croniter
from jsonpath_ng import parse as jsonpath_parse

logger = logging.getLogger(__name__)

POLL_INTERVAL = 30  # seconds


def should_fire_cron(config: dict, now: datetime, last_fire: Optional[str]) -> bool:
    """Check if cron expression matches current time within the poll window."""
    expr = config["expr"]
    tz_name = config.get("tz", "UTC")

    # Use croniter to check if now is within one poll interval of the previous match
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo(tz_name)
        now_local = now.astimezone(tz)
    except Exception:
        now_local = now

    cron = croniter(expr, now_local - timedelta(seconds=POLL_INTERVAL))
    next_time = cron.get_next(datetime)

    # Fire if next_time is within the current poll window
    if not (now_local - timedelta(seconds=POLL_INTERVAL) <= next_time <= now_local):
        return False

    # Don't fire again if already fired in this window
    if last_fire:
        last_dt = datetime.fromisoformat(last_fire)
        if last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=timezone.utc)
        if (now - last_dt).total_seconds() < POLL_INTERVAL:
            return False

    return True


def should_fire_interval(config: dict, now: datetime, last_fire: Optional[str]) -> bool:
    """Check if enough time has elapsed since last fire."""
    minutes = config["minutes"]
    if last_fire is None:
        return True
    last_dt = datetime.fromisoformat(last_fire)
    if last_dt.tzinfo is None:
        last_dt = last_dt.replace(tzinfo=timezone.utc)
    elapsed = (now - last_dt).total_seconds() / 60
    return elapsed >= minutes


def should_fire_once(config: dict, now: datetime, already_fired: bool) -> bool:
    """Fire once at or after the target time, never again."""
    if already_fired:
        return False
    target = datetime.fromisoformat(config["at"])
    if target.tzinfo is None:
        target = target.replace(tzinfo=timezone.utc)
    return now >= target


async def should_fire_poll(config: dict, session: aiohttp.ClientSession) -> bool:
    """HTTP GET + JSON path assertion. Fires when assertion FAILS or endpoint unreachable."""
    url = config["url"]
    json_path = config.get("json_path")
    expect = config.get("expect")

    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status != 200:
                return True  # Non-200 = unhealthy
            if json_path and expect is not None:
                data = await resp.json()
                matches = jsonpath_parse(json_path).find(data)
                if not matches or str(matches[0].value) != str(expect):
                    return True  # Assertion failed
            return False  # All good, don't fire
    except Exception:
        return True  # Unreachable = fire


async def run_poll_cycle(
    triggers_by_agent: dict[str, list[dict]],
    state_db,
    focus_readers: dict,
    http_session: aiohttp.ClientSession,
) -> list[dict]:
    """Evaluate all time-based triggers. Returns list of fired trigger dicts."""
    now = datetime.now(timezone.utc)
    fired = []

    for agent_id, triggers in triggers_by_agent.items():
        focus = focus_readers.get(agent_id)

        for t in triggers:
            if not t.get("enabled", True):
                continue

            trigger_type = t["type"]
            trigger_id = t["id"]

            # Check focus binding
            focus_ref = t.get("focus_ref")
            if focus and not focus.should_fire(focus_ref):
                continue

            # Check state
            ts = state_db.get_trigger_state(agent_id, trigger_id)
            last_fire = ts["last_fire_at"] if ts else None
            fire_count = ts["fire_count"] if ts else 0

            # Check cooldown
            if last_fire and t.get("cooldown_seconds", 0) > 0:
                last_dt = datetime.fromisoformat(last_fire)
                if last_dt.tzinfo is None:
                    last_dt = last_dt.replace(tzinfo=timezone.utc)
                if (now - last_dt).total_seconds() < t["cooldown_seconds"]:
                    continue

            # Check max_fires
            max_fires = t.get("max_fires")
            if max_fires is not None and fire_count >= max_fires:
                continue

            should_fire = False

            if trigger_type == "cron":
                should_fire = should_fire_cron(t["config"], now, last_fire)
            elif trigger_type == "interval":
                should_fire = should_fire_interval(t["config"], now, last_fire)
            elif trigger_type == "once":
                already = fire_count > 0
                should_fire = should_fire_once(t["config"], now, already)
            elif trigger_type == "poll":
                # Poll triggers have their own interval
                poll_interval = t["config"].get("interval_minutes", 5)
                if last_fire:
                    last_dt = datetime.fromisoformat(last_fire)
                    if last_dt.tzinfo is None:
                        last_dt = last_dt.replace(tzinfo=timezone.utc)
                    if (now - last_dt).total_seconds() / 60 < poll_interval:
                        continue
                should_fire = await should_fire_poll(t["config"], http_session)

            if should_fire:
                fired.append({
                    "id": trigger_id,
                    "agent_id": agent_id,
                    "type": trigger_type,
                    "action_type": t.get("action_type", "research"),
                    "prompt": t.get("prompt", ""),
                    "focus_ref": focus_ref,
                })

    return fired
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/.openclaw/triggers && source .venv/bin/activate
PYTHONPATH=. python -m pytest tests/test_poller.py -v
```

Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
cd ~/.openclaw/triggers
git add daemon/poller.py tests/test_poller.py
git commit -m "feat: add poller with cron, interval, once, and poll trigger evaluation"
```

---

## Task 7: Inbox Watcher

**Files:**
- Create: `~/.openclaw/triggers/daemon/watcher.py`
- Test: `~/.openclaw/triggers/tests/test_watcher.py`

- [ ] **Step 1: Write the failing test**

Create `~/.openclaw/triggers/tests/test_watcher.py`:

```python
import pytest
from daemon.watcher import parse_inbox_message, matches_on_message_trigger


SAMPLE_MESSAGE = """---
from: jr
to: dude
timestamp: 2026-03-18T09:15:00Z
subject: New goal from Charlie
priority: normal
focus_ref: null
---

Charlie wants to add a PowerApps integration for the first client.
"""

SAMPLE_TRIGGER = {
    "id": "dude-from-jr",
    "type": "on_message",
    "config": {"watch_inbox": True, "from_agents": ["jr"]},
    "action_type": "research",
    "focus_ref": None,
    "reason": "Receive goals from Jr",
    "enabled": True,
    "cooldown_seconds": 0,
    "prompt": "Read and process the incoming message from Jr."
}


def test_parse_inbox_message():
    meta, body = parse_inbox_message(SAMPLE_MESSAGE)
    assert meta["from"] == "jr"
    assert meta["to"] == "dude"
    assert meta["subject"] == "New goal from Charlie"
    assert "PowerApps" in body


def test_parse_malformed_message():
    meta, body = parse_inbox_message("No frontmatter here, just text")
    assert meta == {}
    assert "No frontmatter" in body


def test_matches_trigger_from_authorized_agent():
    meta = {"from": "jr", "to": "dude"}
    assert matches_on_message_trigger(meta, SAMPLE_TRIGGER) is True


def test_rejects_trigger_from_unauthorized_agent():
    meta = {"from": "smokey", "to": "dude"}
    assert matches_on_message_trigger(meta, SAMPLE_TRIGGER) is False


def test_rejects_disabled_trigger():
    disabled = {**SAMPLE_TRIGGER, "enabled": False}
    meta = {"from": "jr", "to": "dude"}
    assert matches_on_message_trigger(meta, disabled) is False
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/.openclaw/triggers && source .venv/bin/activate
PYTHONPATH=. python -m pytest tests/test_watcher.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'daemon.watcher'`

- [ ] **Step 3: Implement watcher.py**

Create `~/.openclaw/triggers/daemon/watcher.py`:

```python
"""inotify watcher on agent inbox/ directories for on_message triggers."""
import asyncio
import logging
import shutil
from pathlib import Path
from typing import Optional

import yaml

logger = logging.getLogger(__name__)


def parse_inbox_message(content: str) -> tuple[dict, str]:
    """Parse markdown with YAML frontmatter. Returns (metadata, body)."""
    content = content.strip()
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            try:
                meta = yaml.safe_load(parts[1]) or {}
                body = parts[2].strip()
                return meta, body
            except yaml.YAMLError:
                pass
    return {}, content


def matches_on_message_trigger(meta: dict, trigger: dict) -> bool:
    """Check if an inbox message matches an on_message trigger."""
    if not trigger.get("enabled", True):
        return False
    config = trigger.get("config", {})
    from_agents = config.get("from_agents", [])
    sender = meta.get("from", "")
    return sender in from_agents


class InboxWatcher:
    """Watches agent inbox/ directories for new messages using inotify."""

    def __init__(self, agents_dir: str, triggers_by_agent: dict[str, list[dict]]):
        self.agents_dir = Path(agents_dir)
        self.triggers_by_agent = triggers_by_agent
        self._queue: asyncio.Queue = asyncio.Queue()

    def get_inbox_dirs(self) -> dict[str, Path]:
        """Map agent_id -> inbox/ path for all agents with on_message triggers."""
        dirs = {}
        for agent_id, triggers in self.triggers_by_agent.items():
            has_on_message = any(
                t.get("type") == "on_message" and t.get("enabled", True)
                for t in triggers
            )
            if has_on_message:
                inbox = self.agents_dir / agent_id / "inbox"
                if inbox.is_dir():
                    dirs[agent_id] = inbox
        return dirs

    async def process_new_file(self, agent_id: str, file_path: Path) -> Optional[dict]:
        """Process a new inbox file. Returns fired trigger dict or None."""
        try:
            content = file_path.read_text()
            meta, body = parse_inbox_message(content)

            triggers = self.triggers_by_agent.get(agent_id, [])
            for t in triggers:
                if t.get("type") != "on_message":
                    continue
                if matches_on_message_trigger(meta, t):
                    subject = meta.get("subject", file_path.name)
                    sender = meta.get("from", "unknown")
                    prompt = (
                        f"{t.get('prompt', 'Process incoming message.')}\n\n"
                        f"--- Incoming message from {sender} ---\n"
                        f"Subject: {subject}\n\n"
                        f"{body}"
                    )
                    return {
                        "id": t["id"],
                        "agent_id": agent_id,
                        "type": "on_message",
                        "action_type": t.get("action_type", "research"),
                        "prompt": prompt,
                        "focus_ref": t.get("focus_ref"),
                        "source_file": str(file_path),
                    }

            logger.warning(f"No matching on_message trigger for {file_path.name} in {agent_id}")
            return None

        except Exception as e:
            logger.error(f"Error processing inbox file {file_path}: {e}")
            return None

    @staticmethod
    def archive_message(file_path: Path):
        """Move processed message to inbox/archive/."""
        archive_dir = file_path.parent / "archive"
        archive_dir.mkdir(exist_ok=True)
        dest = archive_dir / file_path.name
        shutil.move(str(file_path), str(dest))

    async def watch(self, callback):
        """Main inotify watch loop. Calls callback(fired_trigger) for each match."""
        try:
            from inotify_simple import INotify, flags as inotify_flags
        except ImportError:
            logger.error("inotify_simple not installed, inbox watching disabled")
            return

        inotify = INotify()
        inbox_dirs = self.get_inbox_dirs()
        wd_to_agent: dict[int, tuple[str, Path]] = {}

        for agent_id, inbox_path in inbox_dirs.items():
            wd = inotify.add_watch(
                str(inbox_path),
                inotify_flags.CLOSE_WRITE | inotify_flags.MOVED_TO
            )
            wd_to_agent[wd] = (agent_id, inbox_path)
            logger.info(f"Watching inbox: {inbox_path}")

        while True:
            # Use asyncio-friendly polling
            await asyncio.sleep(0.5)
            events = inotify.read(timeout=0)
            for event in events:
                if event.name and event.name.endswith(".md"):
                    agent_id, inbox_path = wd_to_agent.get(event.wd, (None, None))
                    if agent_id:
                        file_path = inbox_path / event.name
                        if file_path.exists():
                            fired = await self.process_new_file(agent_id, file_path)
                            if fired:
                                await callback(fired)
                                self.archive_message(file_path)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/.openclaw/triggers && source .venv/bin/activate
PYTHONPATH=. python -m pytest tests/test_watcher.py -v
```

Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
cd ~/.openclaw/triggers
git add daemon/watcher.py tests/test_watcher.py
git commit -m "feat: add inbox watcher with inotify, message parsing, and archive"
```

---

## Task 8: HTTP Listener

**Files:**
- Create: `~/.openclaw/triggers/daemon/listener.py`
- Test: `~/.openclaw/triggers/tests/test_listener.py`

- [ ] **Step 1: Write the failing test**

Create `~/.openclaw/triggers/tests/test_listener.py`:

```python
import hashlib
import hmac
import json
import os
import tempfile
import pytest
from aiohttp import web
from aiohttp.test_utils import AioHTTPTestCase, unittest_run_loop
from daemon.listener import create_app
from daemon.state import StateDB


@pytest.fixture
def db():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        path = f.name
    s = StateDB(path)
    yield s
    s.close()
    os.unlink(path)


@pytest.fixture
def app(db):
    webhook_queue = []
    triggers_by_agent = {
        "worker": [
            {
                "id": "dude-github",
                "type": "webhook",
                "config": {"path": "/hook/dude-github", "secret": "test-secret"},
                "enabled": True,
            }
        ]
    }
    return create_app(db, triggers_by_agent, webhook_queue)


@pytest.mark.asyncio
async def test_health_endpoint(aiohttp_client, app):
    client = await aiohttp_client(app)
    resp = await client.get("/health")
    assert resp.status == 200
    data = await resp.json()
    assert data["ok"] is True


@pytest.mark.asyncio
async def test_metrics_endpoint(aiohttp_client, app):
    client = await aiohttp_client(app)
    resp = await client.get("/metrics")
    assert resp.status == 200


@pytest.mark.asyncio
async def test_webhook_valid_hmac(aiohttp_client, app):
    client = await aiohttp_client(app)
    payload = json.dumps({"action": "push"}).encode()
    sig = "sha256=" + hmac.new(b"test-secret", payload, hashlib.sha256).hexdigest()
    resp = await client.post(
        "/hook/dude-github",
        data=payload,
        headers={"X-Hub-Signature-256": sig, "Content-Type": "application/json"},
    )
    assert resp.status == 202


@pytest.mark.asyncio
async def test_webhook_invalid_hmac(aiohttp_client, app):
    client = await aiohttp_client(app)
    payload = json.dumps({"action": "push"}).encode()
    resp = await client.post(
        "/hook/dude-github",
        data=payload,
        headers={"X-Hub-Signature-256": "sha256=wrong", "Content-Type": "application/json"},
    )
    assert resp.status == 403


@pytest.mark.asyncio
async def test_webhook_unknown_trigger(aiohttp_client, app):
    client = await aiohttp_client(app)
    resp = await client.post("/hook/nonexistent", data=b"{}")
    assert resp.status == 404


@pytest.mark.asyncio
async def test_audit_endpoint(aiohttp_client, app, db):
    db.write_audit(event_type="FIRE", agent_id="worker", trigger_id="test")
    client = await aiohttp_client(app)
    resp = await client.get("/audit")
    assert resp.status == 200
    data = await resp.json()
    assert len(data) >= 1
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/.openclaw/triggers && source .venv/bin/activate
PYTHONPATH=. python -m pytest tests/test_listener.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'daemon.listener'`

- [ ] **Step 3: Implement listener.py**

Create `~/.openclaw/triggers/daemon/listener.py`:

```python
"""aiohttp server: /health, /metrics, /hook/*, /triggers/*, /audit."""
import hashlib
import hmac
import json
import logging
import time
from datetime import datetime, timezone

from aiohttp import web

from daemon.state import StateDB

logger = logging.getLogger(__name__)

START_TIME = time.monotonic()


def create_app(
    db: StateDB,
    triggers_by_agent: dict[str, list[dict]],
    webhook_queue: list,
) -> web.Application:
    app = web.Application()
    app["db"] = db
    app["triggers_by_agent"] = triggers_by_agent
    app["webhook_queue"] = webhook_queue
    app["start_time"] = START_TIME

    app.router.add_get("/health", health_handler)
    app.router.add_get("/metrics", metrics_handler)
    app.router.add_post("/hook/{trigger_id}", webhook_handler)
    app.router.add_get("/triggers/{agent}", triggers_handler)
    app.router.add_get("/audit", audit_handler)

    return app


async def health_handler(request: web.Request) -> web.Response:
    db = request.app["db"]
    triggers = request.app["triggers_by_agent"]
    uptime = time.monotonic() - request.app["start_time"]
    total_triggers = sum(len(t) for t in triggers.values())
    return web.json_response({
        "ok": True,
        "uptime_seconds": round(uptime, 1),
        "agents": len(triggers),
        "triggers_loaded": total_triggers,
    })


async def metrics_handler(request: web.Request) -> web.Response:
    db = request.app["db"]
    recent = db.recent_audit(limit=1000)
    # Compute basic metrics from audit log
    total_fires = sum(1 for r in recent if r["event_type"] == "FIRE")
    total_errors = sum(1 for r in recent if r["status"] == "error")
    durations = [r["duration_ms"] for r in recent if r["duration_ms"] is not None]
    durations.sort()

    metrics = {
        "total_fires": total_fires,
        "total_errors": total_errors,
        "p50_latency_ms": durations[len(durations) // 2] if durations else 0,
        "p95_latency_ms": durations[int(len(durations) * 0.95)] if durations else 0,
    }
    return web.json_response(metrics)


async def webhook_handler(request: web.Request) -> web.Response:
    trigger_id = request.match_info["trigger_id"]

    # Find the trigger config
    trigger_config = None
    agent_id = None
    for aid, triggers in request.app["triggers_by_agent"].items():
        for t in triggers:
            if t["id"] == trigger_id and t["type"] == "webhook":
                trigger_config = t
                agent_id = aid
                break
        if trigger_config:
            break

    if not trigger_config:
        return web.json_response({"error": "Unknown trigger"}, status=404)

    if not trigger_config.get("enabled", True):
        return web.json_response({"error": "Trigger disabled"}, status=403)

    # HMAC validation
    secret = trigger_config.get("config", {}).get("secret")
    if secret:
        body = await request.read()
        sig_header = request.headers.get("X-Hub-Signature-256", "")
        expected_sig = "sha256=" + hmac.new(
            secret.encode(), body, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(sig_header, expected_sig):
            return web.json_response({"error": "Invalid signature"}, status=403)
        payload = json.loads(body) if body else {}
    else:
        body = await request.read()
        payload = json.loads(body) if body else {}

    # Queue for processing
    request.app["webhook_queue"].append({
        "id": trigger_id,
        "agent_id": agent_id,
        "type": "webhook",
        "action_type": trigger_config.get("action_type", "research"),
        "prompt": f"{trigger_config.get('prompt', 'Handle webhook.')}\n\nWebhook payload:\n```json\n{json.dumps(payload, indent=2)}\n```",
        "focus_ref": trigger_config.get("focus_ref"),
    })

    return web.json_response({"accepted": True}, status=202)


async def triggers_handler(request: web.Request) -> web.Response:
    agent = request.match_info["agent"]
    triggers = request.app["triggers_by_agent"].get(agent, [])
    return web.json_response(triggers)


async def audit_handler(request: web.Request) -> web.Response:
    db = request.app["db"]
    limit = int(request.query.get("limit", 100))
    rows = db.recent_audit(limit=limit)
    return web.json_response(rows)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/.openclaw/triggers && source .venv/bin/activate
PYTHONPATH=. python -m pytest tests/test_listener.py -v
```

Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
cd ~/.openclaw/triggers
git add daemon/listener.py tests/test_listener.py
git commit -m "feat: add HTTP listener with health, metrics, webhook, and audit endpoints"
```

---

## Task 9: Slack Approval Module

**Files:**
- Create: `~/.openclaw/triggers/daemon/approval.py`
- Test: `~/.openclaw/triggers/tests/test_approval.py`

- [ ] **Step 1: Write the failing test**

Create `~/.openclaw/triggers/tests/test_approval.py`:

```python
import pytest
from daemon.approval import build_approval_blocks, parse_approval_callback


def test_build_approval_blocks():
    blocks = build_approval_blocks(
        approval_id="walter-deploy-001",
        agent_id="cto",
        action_type="deployment",
        trigger_id="walter-deploy-webhook",
        focus_ref="infra-health",
        prompt="Deploy updated gateway config",
    )
    # Should contain at least header, details section, and action buttons
    assert len(blocks) >= 3
    # Last block should be actions with approve/deny buttons
    actions_block = blocks[-1]
    assert actions_block["type"] == "actions"
    button_values = [e["value"] for e in actions_block["elements"]]
    assert "approve:walter-deploy-001" in button_values
    assert "deny:walter-deploy-001" in button_values


def test_parse_approve_callback():
    action = {"value": "approve:walter-deploy-001"}
    result = parse_approval_callback(action, user_id="U12345")
    assert result["approval_id"] == "walter-deploy-001"
    assert result["decision"] == "approved"
    assert result["user_id"] == "U12345"


def test_parse_deny_callback():
    action = {"value": "deny:walter-deploy-001"}
    result = parse_approval_callback(action, user_id="U12345")
    assert result["decision"] == "denied"


def test_parse_unknown_callback():
    action = {"value": "unknown:something"}
    result = parse_approval_callback(action, user_id="U12345")
    assert result is None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/.openclaw/triggers && source .venv/bin/activate
PYTHONPATH=. python -m pytest tests/test_approval.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'daemon.approval'`

- [ ] **Step 3: Implement approval.py**

Create `~/.openclaw/triggers/daemon/approval.py`:

```python
"""Slack Socket Mode L3 approval flow: Block Kit messages, callback handling."""
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Agent display names for readable approval messages
AGENT_NAMES = {
    "worker": "Dude (Worker)",
    "cto": "Walter (CTO)",
    "jr": "Jr (Bonny)",
    "maude": "Maude (Platform)",
    "brandt": "Brandt (Containers)",
    "smokey": "Smokey (SRE)",
    "da-fino": "Da Fino (Security)",
    "donny": "Donny (Dashboards)",
    "mailroom": "Mailroom (Email)",
}


def build_approval_blocks(
    approval_id: str,
    agent_id: str,
    action_type: str,
    trigger_id: str,
    focus_ref: Optional[str],
    prompt: str,
) -> list[dict]:
    """Build Slack Block Kit blocks for an L3 approval message."""
    agent_display = AGENT_NAMES.get(agent_id, agent_id)
    prompt_preview = prompt[:300] + "..." if len(prompt) > 300 else prompt

    return [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": "Approval Required", "emoji": True}
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Agent:*\n{agent_display}"},
                {"type": "mrkdwn", "text": f"*Action:*\n{action_type}"},
                {"type": "mrkdwn", "text": f"*Trigger:*\n{trigger_id}"},
                {"type": "mrkdwn", "text": f"*Focus:*\n{focus_ref or 'none'}"},
            ]
        },
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*Prompt:*\n```{prompt_preview}```"}
        },
        {
            "type": "actions",
            "block_id": f"approval_{approval_id}",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "Approve", "emoji": True},
                    "style": "primary",
                    "value": f"approve:{approval_id}",
                    "action_id": "approval_approve",
                },
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "Deny", "emoji": True},
                    "style": "danger",
                    "value": f"deny:{approval_id}",
                    "action_id": "approval_deny",
                },
            ]
        }
    ]


def parse_approval_callback(action: dict, user_id: str) -> Optional[dict]:
    """Parse a Slack interactive action callback. Returns parsed result or None."""
    value = action.get("value", "")
    if value.startswith("approve:"):
        return {
            "approval_id": value[len("approve:"):],
            "decision": "approved",
            "user_id": user_id,
        }
    elif value.startswith("deny:"):
        return {
            "approval_id": value[len("deny:"):],
            "decision": "denied",
            "user_id": user_id,
        }
    return None


class ApprovalManager:
    """Manages L3 approval lifecycle with Slack Socket Mode."""

    def __init__(self, db, slack_client=None, allowed_user_ids: list[str] = None):
        self.db = db
        self.slack = slack_client
        self.allowed_user_ids = allowed_user_ids or []

    async def request_approval(
        self,
        approval_id: str,
        agent_id: str,
        trigger_id: str,
        action_type: str,
        prompt: str,
        focus_ref: Optional[str] = None,
        channel: str = None,
    ):
        """Create approval record and send Slack message."""
        blocks = build_approval_blocks(
            approval_id=approval_id,
            agent_id=agent_id,
            action_type=action_type,
            trigger_id=trigger_id,
            focus_ref=focus_ref,
            prompt=prompt,
        )

        slack_ts = None
        if self.slack and channel:
            try:
                resp = await self.slack.chat_postMessage(
                    channel=channel,
                    text=f"Approval required: {AGENT_NAMES.get(agent_id, agent_id)} wants to {action_type}",
                    blocks=blocks,
                )
                slack_ts = resp.get("ts")
            except Exception as e:
                logger.error(f"Failed to send Slack approval message: {e}")

        self.db.create_approval(
            approval_id=approval_id,
            agent_id=agent_id,
            trigger_id=trigger_id,
            action_type=action_type,
            prompt=prompt,
            slack_message_ts=slack_ts,
        )

    async def handle_callback(self, action: dict, user_id: str) -> Optional[dict]:
        """Handle Slack interactive callback. Returns result or None if unauthorized."""
        if self.allowed_user_ids and user_id not in self.allowed_user_ids:
            logger.warning(f"Unauthorized approval attempt by {user_id}")
            return None

        result = parse_approval_callback(action, user_id)
        if not result:
            return None

        self.db.resolve_approval(
            result["approval_id"],
            status=result["decision"],
            decided_by=user_id,
        )
        return result
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/.openclaw/triggers && source .venv/bin/activate
PYTHONPATH=. python -m pytest tests/test_approval.py -v
```

Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
cd ~/.openclaw/triggers
git add daemon/approval.py tests/test_approval.py
git commit -m "feat: add Slack approval module with Block Kit and callback handling"
```

---

## Task 10: Plaza Enforcer

**Files:**
- Create: `~/.openclaw/triggers/daemon/plaza.py`
- Test: `~/.openclaw/triggers/tests/test_plaza.py`

- [ ] **Step 1: Write the failing test**

Create `~/.openclaw/triggers/tests/test_plaza.py`:

```python
import os
import tempfile
import pytest
from daemon.state import StateDB
from daemon.plaza import PlazaEnforcer


@pytest.fixture
def db():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        path = f.name
    s = StateDB(path)
    yield s
    s.close()
    os.unlink(path)


def test_first_post_allowed(db):
    enforcer = PlazaEnforcer(db)
    assert enforcer.can_post("worker", "cycle-1") is True


def test_second_post_blocked(db):
    enforcer = PlazaEnforcer(db)
    enforcer.record_post("worker", "cycle-1")
    assert enforcer.can_post("worker", "cycle-1") is False


def test_two_comments_allowed(db):
    enforcer = PlazaEnforcer(db)
    assert enforcer.can_comment("worker", "cycle-1") is True
    enforcer.record_comment("worker", "cycle-1")
    assert enforcer.can_comment("worker", "cycle-1") is True
    enforcer.record_comment("worker", "cycle-1")
    assert enforcer.can_comment("worker", "cycle-1") is False


def test_different_cycles_independent(db):
    enforcer = PlazaEnforcer(db)
    enforcer.record_post("worker", "cycle-1")
    assert enforcer.can_post("worker", "cycle-2") is True
```

- [ ] **Step 2: Run test, implement, run test, commit**

```bash
cd ~/.openclaw/triggers && source .venv/bin/activate
PYTHONPATH=. python -m pytest tests/test_plaza.py -v
# Expected: FAIL
```

Create `~/.openclaw/triggers/daemon/plaza.py`:

```python
"""Plaza posting enforcement: max 1 post + 2 comments per agent per cycle."""
from daemon.state import StateDB


class PlazaEnforcer:
    def __init__(self, db: StateDB):
        self.db = db

    def can_post(self, agent_id: str, cycle_id: str) -> bool:
        return self.db.can_post(agent_id, cycle_id)

    def can_comment(self, agent_id: str, cycle_id: str) -> bool:
        return self.db.can_comment(agent_id, cycle_id)

    def record_post(self, agent_id: str, cycle_id: str):
        self.db.increment_plaza_count(agent_id, cycle_id, post=True)

    def record_comment(self, agent_id: str, cycle_id: str):
        self.db.increment_plaza_count(agent_id, cycle_id, post=False)
```

```bash
PYTHONPATH=. python -m pytest tests/test_plaza.py -v
# Expected: All 4 tests PASS
git add daemon/plaza.py tests/test_plaza.py
git commit -m "feat: add plaza posting enforcer"
```

---

## Task 11: Main Entry Point

**Files:**
- Create: `~/.openclaw/triggers/daemon/__main__.py`
- Test: manual startup verification

- [ ] **Step 1: Implement `__main__.py`**

Create `~/.openclaw/triggers/daemon/__main__.py`:

```python
"""OpenClaw Trigger Daemon — entry point."""
import asyncio
import logging
import signal
import sys
from pathlib import Path

import aiohttp
from aiohttp import web

from daemon.config import ConfigLoader
from daemon.state import StateDB
from daemon.focus import FocusReader
from daemon.autonomy import AutonomyGate, AutonomyLevel
from daemon.executor import Executor
from daemon.poller import run_poll_cycle, POLL_INTERVAL
from daemon.watcher import InboxWatcher
from daemon.listener import create_app
from daemon.approval import ApprovalManager
from daemon.plaza import PlazaEnforcer

try:
    from slack_sdk.web.async_client import AsyncWebClient
    from slack_sdk.socket_mode.aio import AsyncSocketModeClient
    from slack_sdk.socket_mode.request import SocketModeRequest
    from slack_sdk.socket_mode.response import SocketModeResponse
    HAS_SLACK = True
except ImportError:
    HAS_SLACK = False

AGENTS_DIR = Path.home() / ".openclaw" / "agents"
TRIGGERS_DIR = Path.home() / ".openclaw" / "triggers"
DB_PATH = TRIGGERS_DIR / "daemon.db"
AUDIT_LOG = TRIGGERS_DIR / "audit.log"
LISTEN_PORT = 18800

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(str(AUDIT_LOG)),
    ]
)
logger = logging.getLogger("trigger-daemon")


class TriggerDaemon:
    def __init__(self):
        self.db = StateDB(str(DB_PATH))
        self.config = ConfigLoader(str(AGENTS_DIR))
        self.executor = Executor(self.db, audit_log_path=str(AUDIT_LOG))
        self.plaza = PlazaEnforcer(self.db)
        self.webhook_queue: list[dict] = []
        self.running = True

        # Slack config
        self.slack_bot_token = os.environ.get("SLACK_BOT_TOKEN")
        self.slack_app_token = os.environ.get("SLACK_APP_TOKEN")
        self.slack_approval_channel = os.environ.get("SLACK_APPROVAL_CHANNEL")
        self.slack_activity_channel = os.environ.get("SLACK_ACTIVITY_CHANNEL", "#openclaw-activity")
        self.allowed_approver_ids = os.environ.get("SLACK_APPROVER_IDS", "").split(",")
        self.slack_client = None
        self.approval_manager = None

        # Load initial config
        self.triggers_by_agent = self.config.load_all()
        for warning in self.config.warnings:
            logger.warning(warning)

        # Load focus readers and autonomy gates per agent
        self.focus_readers: dict[str, FocusReader] = {}
        self.autonomy_gates: dict[str, AutonomyGate] = {}
        for agent_id in self.triggers_by_agent:
            agent_dir = AGENTS_DIR / agent_id / "agent"
            focus_path = agent_dir / "focus.md"
            autonomy_path = agent_dir / "autonomy.json"
            if focus_path.exists():
                self.focus_readers[agent_id] = FocusReader(str(focus_path))
            if autonomy_path.exists():
                self.autonomy_gates[agent_id] = AutonomyGate(str(autonomy_path))

    async def poll_loop(self):
        """Main 30-second poll cycle."""
        async with aiohttp.ClientSession() as session:
            while self.running:
                try:
                    # Reload configs (hot-reload on file changes)
                    old_hashes = {a: self.config.get_config_hash(a) for a in self.triggers_by_agent}
                    self.triggers_by_agent = self.config.load_all()
                    for agent_id in self.triggers_by_agent:
                        new_hash = self.config.get_config_hash(agent_id)
                        if old_hashes.get(agent_id) != new_hash:
                            logger.info(f"Config changed for {agent_id}")
                            self.db.write_audit(
                                event_type="ADAPT", agent_id=agent_id,
                                detail=f"config hash changed",
                            )

                    # Reload focus files
                    for agent_id, reader in self.focus_readers.items():
                        reader.reload()

                    # Run poll cycle
                    fired = await run_poll_cycle(
                        self.triggers_by_agent, self.db,
                        self.focus_readers, session,
                    )

                    # Add any queued webhooks
                    while self.webhook_queue:
                        fired.append(self.webhook_queue.pop(0))

                    # Process fired triggers
                    await self._process_fired(fired)

                except Exception as e:
                    logger.error(f"Poll cycle error: {e}", exc_info=True)

                await asyncio.sleep(POLL_INTERVAL)

    async def _process_fired(self, fired: list[dict]):
        """Group, gate, and execute fired triggers."""
        if not fired:
            return

        from datetime import datetime, timezone
        cycle_id = datetime.now(timezone.utc).isoformat()

        grouped = self.executor.group_by_agent(fired)

        for agent_id, group in grouped.items():
            gate = self.autonomy_gates.get(agent_id)
            # Use highest autonomy level among grouped triggers
            max_level = AutonomyLevel.L1
            for action_type in group["action_types"]:
                if gate:
                    level = gate.get_level(action_type)
                else:
                    level = AutonomyLevel.L3
                if level > max_level:
                    max_level = level

            trigger_ids = group["trigger_ids"]
            prompt = group["combined_prompt"]

            if max_level == AutonomyLevel.L3:
                # Block and queue for approval
                import uuid
                approval_id = f"{agent_id}-{uuid.uuid4().hex[:8]}"
                self.db.write_audit(
                    event_type="BLOCKED", agent_id=agent_id,
                    trigger_id=",".join(trigger_ids), trigger_type="grouped",
                    autonomy_level="L3", status="pending",
                )
                if self.approval_manager:
                    await self.approval_manager.request_approval(
                        approval_id=approval_id,
                        agent_id=agent_id,
                        trigger_id=trigger_ids[0],
                        action_type=list(group["action_types"])[0],
                        prompt=prompt,
                        channel=self.slack_approval_channel,
                    )
                continue

            # L1 or L2: execute
            result = await self.executor.invoke_agent(agent_id, prompt)

            for tid in trigger_ids:
                if result["success"]:
                    self.db.record_success(agent_id, tid, fire_at=cycle_id)
                else:
                    auto_disabled = self.db.increment_failure(agent_id, tid)
                    if auto_disabled:
                        logger.warning(f"Trigger {tid} auto-disabled after 5 failures")
                        await self._slack_notify(
                            f"⚠️ Trigger `{tid}` on `{agent_id}` auto-disabled after 5 consecutive failures."
                        )

            self.db.write_audit(
                event_type="FIRE", agent_id=agent_id,
                trigger_id=",".join(trigger_ids),
                autonomy_level=max_level.value,
                status="ok" if result["success"] else "error",
                duration_ms=result["duration_ms"],
            )

            if max_level == AutonomyLevel.L2:
                status = "✅" if result["success"] else "❌"
                await self._slack_notify(
                    f"{status} `{agent_id}` fired: {', '.join(trigger_ids)} ({result['duration_ms']}ms)"
                )

    async def _slack_notify(self, text: str):
        """Send L2 notification to Slack #openclaw-activity."""
        if self.slack_client:
            try:
                await self.slack_client.chat_postMessage(
                    channel=self.slack_activity_channel, text=text
                )
            except Exception as e:
                logger.error(f"Slack notification failed: {e}")

    async def inbox_callback(self, fired_trigger: dict):
        """Called by InboxWatcher when a message matches."""
        await self._process_fired([fired_trigger])

    async def slack_loop(self):
        """Slack Socket Mode client for L3 approval callbacks."""
        if not HAS_SLACK or not self.slack_app_token or not self.slack_bot_token:
            logger.warning("Slack SDK not configured — L3 approvals and L2 notifications disabled")
            return

        self.slack_client = AsyncWebClient(token=self.slack_bot_token)
        self.approval_manager = ApprovalManager(
            db=self.db,
            slack_client=self.slack_client,
            allowed_user_ids=self.allowed_approver_ids,
        )
        socket_client = AsyncSocketModeClient(
            app_token=self.slack_app_token,
            web_client=self.slack_client,
        )

        async def handle_interactive(client, req: SocketModeRequest):
            if req.type == "interactive" and req.payload.get("type") == "block_actions":
                for action in req.payload.get("actions", []):
                    user_id = req.payload.get("user", {}).get("id", "")
                    result = await self.approval_manager.handle_callback(action, user_id)
                    if result:
                        # Execute approved actions
                        if result["decision"] == "approved":
                            approval = None
                            for a in self.db.get_pending_approvals():
                                if a["id"] == result["approval_id"]:
                                    approval = a
                                    break
                            # Approval already resolved by handle_callback, fetch from db
                            # Re-invoke the agent with the stored prompt
                            row = self.db.conn.execute(
                                "SELECT * FROM approvals WHERE id = ?",
                                (result["approval_id"],)
                            ).fetchone()
                            if row:
                                invoke_result = await self.executor.invoke_agent(
                                    dict(row)["agent_id"], dict(row)["prompt"]
                                )
                                self.db.write_audit(
                                    event_type="APPROVE", agent_id=dict(row)["agent_id"],
                                    trigger_id=dict(row)["trigger_id"],
                                    autonomy_level="L3",
                                    status="ok" if invoke_result["success"] else "error",
                                    duration_ms=invoke_result["duration_ms"],
                                    detail=f"by:{user_id}",
                                )
                        else:
                            self.db.write_audit(
                                event_type="DENY", agent_id="",
                                detail=f"by:{user_id}",
                                autonomy_level="L3", status="denied",
                            )
                await client.send_socket_mode_response(
                    SocketModeResponse(envelope_id=req.envelope_id)
                )

        socket_client.socket_mode_request_listeners.append(handle_interactive)
        await socket_client.connect()
        logger.info("Slack Socket Mode client connected")

        # Keep alive + periodic approval expiration
        while self.running:
            expired = self.db.expire_old_approvals(max_age_hours=4)
            for e in expired:
                self.db.write_audit(
                    event_type="EXPIRE", agent_id=e["agent_id"],
                    trigger_id=e["trigger_id"], autonomy_level="L3",
                    status="expired",
                )
                logger.info(f"Approval expired: {e['id']}")
            await asyncio.sleep(60)

    async def run(self):
        """Start all four concurrent tasks."""
        logger.info("Starting OpenClaw Trigger Daemon v0.1.0")
        logger.info(f"Agents: {list(self.triggers_by_agent.keys())}")
        total = sum(len(t) for t in self.triggers_by_agent.values())
        logger.info(f"Triggers loaded: {total}")

        # Create HTTP app
        app = create_app(self.db, self.triggers_by_agent, self.webhook_queue)

        # Create inbox watcher
        watcher = InboxWatcher(str(AGENTS_DIR), self.triggers_by_agent)

        # Start all tasks
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "127.0.0.1", LISTEN_PORT)

        try:
            await site.start()
            logger.info(f"HTTP listener on http://127.0.0.1:{LISTEN_PORT}")

            await asyncio.gather(
                self.poll_loop(),
                watcher.watch(self.inbox_callback),
                self.slack_loop(),
            )
        except asyncio.CancelledError:
            logger.info("Shutdown requested")
        finally:
            await runner.cleanup()
            self.db.close()
            logger.info("Trigger daemon stopped")


def main():
    daemon = TriggerDaemon()

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    def shutdown(sig, frame):
        daemon.running = False
        for task in asyncio.all_tasks(loop):
            task.cancel()

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    try:
        loop.run_until_complete(daemon.run())
    except KeyboardInterrupt:
        pass
    finally:
        loop.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Smoke test — verify daemon starts and /health responds**

```bash
cd ~/.openclaw/triggers && source .venv/bin/activate
# Start daemon in background
PYTHONPATH=. python -m daemon &
DAEMON_PID=$!
sleep 3
# Check health
curl -s http://127.0.0.1:18800/health | python3 -m json.tool
# Expected: {"ok": true, "uptime_seconds": ..., "agents": 9, "triggers_loaded": 0}
kill $DAEMON_PID
```

- [ ] **Step 3: Commit**

```bash
cd ~/.openclaw/triggers
git add daemon/__main__.py
git commit -m "feat: add main entry point wiring poller, listener, and watcher"
```

---

## Task 12: Populate triggers.json for All 9 Agents

**Files:**
- Modify: `~/.openclaw/agents/worker/agent/triggers.json`
- Modify: `~/.openclaw/agents/cto/agent/triggers.json`
- Modify: `~/.openclaw/agents/jr/agent/triggers.json`
- Modify: `~/.openclaw/agents/maude/agent/triggers.json`
- Modify: `~/.openclaw/agents/brandt/agent/triggers.json`
- Modify: `~/.openclaw/agents/smokey/agent/triggers.json`
- Modify: `~/.openclaw/agents/da-fino/agent/triggers.json`
- Modify: `~/.openclaw/agents/donny/agent/triggers.json`
- Modify: `~/.openclaw/agents/mailroom/agent/triggers.json`

Reference: Spec Section 4 (role definitions) + parent spec Section 4.4 (trigger assignments per agent).

- [ ] **Step 1: Write worker (Dude) triggers.json**

Write to `~/.openclaw/agents/worker/agent/triggers.json`:

```json
{
  "triggers": [
    {
      "id": "dude-morning-brief",
      "type": "cron",
      "config": { "expr": "0 9 * * *", "tz": "America/New_York" },
      "action_type": "research",
      "focus_ref": null,
      "reason": "Daily morning brief: review Plaza, Paperclip queue, agent status",
      "enabled": true,
      "cooldown_seconds": 300,
      "prompt": "Run morning brief: review Plaza feed for overnight posts, check Paperclip queue for new/stalled tasks, check agent status via daemon health endpoint at http://localhost:18800/metrics. Post summary to Plaza."
    },
    {
      "id": "dude-paperclip-check",
      "type": "interval",
      "config": { "minutes": 30 },
      "action_type": "heartbeat",
      "focus_ref": "task-execution",
      "reason": "Check Paperclip for new or stalled tasks",
      "enabled": true,
      "cooldown_seconds": 300,
      "prompt": "Check Paperclip queue for tasks assigned to you or stalled tasks. Execute, reassign, or escalate as needed. Update task status in Paperclip."
    },
    {
      "id": "dude-from-jr",
      "type": "on_message",
      "config": { "watch_inbox": true, "from_agents": ["jr"] },
      "action_type": "research",
      "focus_ref": null,
      "reason": "Receive goals and updates from Jr",
      "enabled": true,
      "cooldown_seconds": 0,
      "prompt": "Read and process the incoming message from Jr. Break goals into tasks, assign to specialists via Paperclip, or handle directly."
    },
    {
      "id": "dude-github-webhook",
      "type": "webhook",
      "config": { "path": "/hook/dude-github", "secret": "${GITHUB_WEBHOOK_SECRET}" },
      "action_type": "research",
      "focus_ref": null,
      "reason": "React to GitHub push/PR events",
      "enabled": true,
      "cooldown_seconds": 60,
      "prompt": "Review incoming GitHub event and determine if action is needed. Summarize relevant changes."
    }
  ]
}
```

- [ ] **Step 2: Write cto (Walter) triggers.json**

Write to `~/.openclaw/agents/cto/agent/triggers.json`:

```json
{
  "triggers": [
    {
      "id": "walter-daily-audit",
      "type": "cron",
      "config": { "expr": "0 9 * * *", "tz": "America/New_York" },
      "action_type": "research",
      "focus_ref": null,
      "reason": "Daily infrastructure audit",
      "enabled": true,
      "cooldown_seconds": 300,
      "prompt": "Run daily infrastructure audit: check OpenClaw gateway health, Paperclip status, systemd services, disk usage. Report issues."
    },
    {
      "id": "walter-security-audit",
      "type": "cron",
      "config": { "expr": "0 7 * * 0", "tz": "America/New_York" },
      "action_type": "security_scan",
      "focus_ref": null,
      "reason": "Weekly security audit",
      "enabled": true,
      "cooldown_seconds": 300,
      "prompt": "Run weekly security audit: check for exposed credentials, review agent permissions, verify service configurations."
    },
    {
      "id": "walter-vault-sync",
      "type": "interval",
      "config": { "minutes": 60 },
      "action_type": "heartbeat",
      "focus_ref": null,
      "reason": "Hourly vault/config sync check",
      "enabled": true,
      "cooldown_seconds": 300,
      "prompt": "Check vault and configuration sync status. Verify backups are current."
    },
    {
      "id": "walter-from-dude",
      "type": "on_message",
      "config": { "watch_inbox": true, "from_agents": ["worker"] },
      "action_type": "research",
      "focus_ref": null,
      "reason": "Receive direction from Dude",
      "enabled": true,
      "cooldown_seconds": 0,
      "prompt": "Read and process the incoming message from Dude. Execute technical tasks as directed."
    },
    {
      "id": "walter-gateway-health",
      "type": "poll",
      "config": {
        "url": "http://localhost:18789/health",
        "json_path": "$.status",
        "expect": "ok",
        "interval_minutes": 5
      },
      "action_type": "heartbeat",
      "focus_ref": "infra-health",
      "reason": "Monitor OpenClaw gateway health",
      "enabled": true,
      "cooldown_seconds": 300,
      "prompt": "Gateway health check failed or endpoint unreachable. Investigate: check systemd status, logs, port binding. Report findings and attempt restart if safe."
    }
  ]
}
```

- [ ] **Step 3: Write jr (Bonny) triggers.json**

Write to `~/.openclaw/agents/jr/agent/triggers.json`:

```json
{
  "triggers": [
    {
      "id": "jr-status-check",
      "type": "interval",
      "config": { "minutes": 30 },
      "action_type": "heartbeat",
      "focus_ref": null,
      "reason": "Periodic status check and journal update",
      "enabled": true,
      "cooldown_seconds": 300,
      "prompt": "Quick status check: review any pending items for Charlie, check if Dude has updates to relay. Update journal if anything notable."
    },
    {
      "id": "jr-from-charlie",
      "type": "on_message",
      "config": { "watch_inbox": true, "from_agents": ["charlie"] },
      "action_type": "research",
      "focus_ref": null,
      "reason": "Receive messages from Charlie",
      "enabled": true,
      "cooldown_seconds": 0,
      "prompt": "Read and process the incoming message from Charlie. Relay goals to Dude via his inbox, handle status queries yourself."
    },
    {
      "id": "jr-from-mailroom",
      "type": "on_message",
      "config": { "watch_inbox": true, "from_agents": ["mailroom"] },
      "action_type": "research",
      "focus_ref": null,
      "reason": "Receive email triage results from Mailroom",
      "enabled": true,
      "cooldown_seconds": 0,
      "prompt": "Read email triage results from Mailroom. Alert Charlie via Slack for urgent items. Log non-urgent items for daily brief."
    }
  ]
}
```

- [ ] **Step 4: Write specialist triggers (smokey, maude, brandt, da-fino, donny, mailroom)**

Write to `~/.openclaw/agents/smokey/agent/triggers.json`:

```json
{
  "triggers": [
    {
      "id": "smokey-health-sweep",
      "type": "interval",
      "config": { "minutes": 15 },
      "action_type": "heartbeat",
      "focus_ref": null,
      "reason": "Continuous health sweep across all services",
      "enabled": true,
      "cooldown_seconds": 300,
      "prompt": "Run health sweep: check trigger daemon at http://localhost:18800/health, gateway at http://localhost:18789/health, Paperclip at http://localhost:3101/health. Report any failures to Slack #openclaw-activity."
    },
    {
      "id": "smokey-from-walter",
      "type": "on_message",
      "config": { "watch_inbox": true, "from_agents": ["worker", "cto"] },
      "action_type": "research",
      "focus_ref": null,
      "reason": "Receive tasks from Dude or Walter",
      "enabled": true,
      "cooldown_seconds": 0,
      "prompt": "Read and process the incoming message. Execute reliability tasks as directed."
    },
    {
      "id": "smokey-paperclip-check",
      "type": "interval",
      "config": { "minutes": 30 },
      "action_type": "heartbeat",
      "focus_ref": "task-execution",
      "reason": "Check Paperclip for assigned SRE tasks",
      "enabled": true,
      "cooldown_seconds": 300,
      "prompt": "Check Paperclip queue for tasks assigned to you. Execute monitoring and reliability tasks."
    }
  ]
}
```

Write to `~/.openclaw/agents/maude/agent/triggers.json`:

```json
{
  "triggers": [
    {
      "id": "maude-from-walter",
      "type": "on_message",
      "config": { "watch_inbox": true, "from_agents": ["worker", "cto"] },
      "action_type": "research",
      "focus_ref": null,
      "reason": "Receive tasks from Dude or Walter",
      "enabled": true,
      "cooldown_seconds": 0,
      "prompt": "Read and process the incoming message. Execute OpenClaw platform tasks as directed."
    },
    {
      "id": "maude-paperclip-check",
      "type": "interval",
      "config": { "minutes": 30 },
      "action_type": "heartbeat",
      "focus_ref": "task-execution",
      "reason": "Check Paperclip for assigned platform tasks",
      "enabled": true,
      "cooldown_seconds": 300,
      "prompt": "Check Paperclip queue for tasks assigned to you. Execute platform engineering tasks."
    }
  ]
}
```

Write to `~/.openclaw/agents/brandt/agent/triggers.json`:

```json
{
  "triggers": [
    {
      "id": "brandt-from-walter",
      "type": "on_message",
      "config": { "watch_inbox": true, "from_agents": ["worker", "cto"] },
      "action_type": "research",
      "focus_ref": null,
      "reason": "Receive tasks from Dude or Walter",
      "enabled": true,
      "cooldown_seconds": 0,
      "prompt": "Read and process the incoming message. Execute container and VM tasks as directed."
    },
    {
      "id": "brandt-paperclip-check",
      "type": "interval",
      "config": { "minutes": 30 },
      "action_type": "heartbeat",
      "focus_ref": "task-execution",
      "reason": "Check Paperclip for assigned container tasks",
      "enabled": true,
      "cooldown_seconds": 300,
      "prompt": "Check Paperclip queue for tasks assigned to you. Execute container, VM, and PowerApps tasks."
    }
  ]
}
```

Write to `~/.openclaw/agents/da-fino/agent/triggers.json`:

```json
{
  "triggers": [
    {
      "id": "da-fino-daily-scan",
      "type": "cron",
      "config": { "expr": "0 3 * * *", "tz": "America/New_York" },
      "action_type": "security_scan",
      "focus_ref": null,
      "reason": "Daily security scan at 3 AM",
      "enabled": true,
      "cooldown_seconds": 300,
      "prompt": "Run daily security scan: TruffleHog for exposed secrets, check agent permission drift, review recent config changes. Report findings."
    },
    {
      "id": "da-fino-from-walter",
      "type": "on_message",
      "config": { "watch_inbox": true, "from_agents": ["worker", "cto"] },
      "action_type": "security_scan",
      "focus_ref": null,
      "reason": "Receive security tasks from Dude or Walter",
      "enabled": true,
      "cooldown_seconds": 0,
      "prompt": "Read and process the incoming message. Execute security tasks as directed."
    },
    {
      "id": "da-fino-paperclip-check",
      "type": "interval",
      "config": { "minutes": 30 },
      "action_type": "heartbeat",
      "focus_ref": "task-execution",
      "reason": "Check Paperclip for assigned security tasks",
      "enabled": true,
      "cooldown_seconds": 300,
      "prompt": "Check Paperclip queue for tasks assigned to you. Execute security audit and remediation tasks."
    }
  ]
}
```

Write to `~/.openclaw/agents/donny/agent/triggers.json`:

```json
{
  "triggers": [
    {
      "id": "donny-daily-data-scan",
      "type": "cron",
      "config": { "expr": "0 10 * * *", "tz": "America/New_York" },
      "action_type": "dashboard_ui",
      "focus_ref": null,
      "reason": "Daily data scan for dashboard improvements",
      "enabled": true,
      "cooldown_seconds": 300,
      "prompt": "Scan snapshot.json and Plaza feed for data patterns. Propose dashboard improvements to Dude via his inbox if you find actionable insights."
    },
    {
      "id": "donny-from-dude",
      "type": "on_message",
      "config": { "watch_inbox": true, "from_agents": ["worker"] },
      "action_type": "dashboard_ui",
      "focus_ref": null,
      "reason": "Receive dashboard tasks from Dude",
      "enabled": true,
      "cooldown_seconds": 0,
      "prompt": "Read and process the incoming message. Execute dashboard and visualization tasks as directed."
    },
    {
      "id": "donny-paperclip-check",
      "type": "interval",
      "config": { "minutes": 30 },
      "action_type": "heartbeat",
      "focus_ref": "task-execution",
      "reason": "Check Paperclip for assigned dashboard tasks",
      "enabled": true,
      "cooldown_seconds": 300,
      "prompt": "Check Paperclip queue for tasks assigned to you. Execute dashboard and data visualization tasks."
    }
  ]
}
```

Write to `~/.openclaw/agents/mailroom/agent/triggers.json`:

```json
{
  "triggers": [
    {
      "id": "mailroom-bulk-ingestion",
      "type": "cron",
      "config": { "expr": "0 2 * * *", "tz": "America/New_York" },
      "action_type": "heartbeat",
      "focus_ref": null,
      "reason": "Daily bulk email ingestion at 2 AM",
      "enabled": false,
      "cooldown_seconds": 300,
      "prompt": "Run bulk email ingestion pipeline. Fetch, sanitize, scan with LLM Guard, classify, and index new emails. Send triage results to Jr's inbox."
    },
    {
      "id": "mailroom-monitor",
      "type": "interval",
      "config": { "minutes": 5 },
      "action_type": "heartbeat",
      "focus_ref": null,
      "reason": "Monitor for new priority emails",
      "enabled": false,
      "cooldown_seconds": 300,
      "prompt": "Check for new high-priority emails since last check. Process and send urgent triage results to Jr's inbox."
    }
  ]
}
```

Note: Mailroom triggers start `enabled: false` — awaiting OAuth setup (Task 11 from Mailroom project).

- [ ] **Step 5: Commit**

```bash
cd ~/.openclaw
git add agents/*/agent/triggers.json
git commit -m "feat: populate triggers.json for all 9 agents"
```

---

## Task 13: Populate autonomy.json for All 9 Agents

**Files:** Same 9 agents' `autonomy.json` files.

- [ ] **Step 1: Write autonomy.json per agent**

All agents get the base matrix from the spec. Agent-specific overrides noted.

**worker, jr** — `autonomy.json`:
```json
{
  "autonomy": {
    "heartbeat": "L1",
    "research": "L2",
    "sop_writing": "L2",
    "config_change": "L3",
    "deployment": "L3",
    "external_comms": "L3",
    "security_scan": "L3",
    "security_remediate": "L3",
    "email_action": "L3",
    "dashboard_ui": "L3",
    "dashboard_structural": "L3"
  }
}
```

**cto** — `autonomy.json`:
```json
{
  "autonomy": {
    "heartbeat": "L1",
    "research": "L2",
    "sop_writing": "L2",
    "config_change": "L3",
    "deployment": "L3",
    "external_comms": "L3",
    "security_scan": "L2",
    "security_remediate": "L3",
    "email_action": "L3",
    "dashboard_ui": "L3",
    "dashboard_structural": "L3"
  }
}
```

**smokey** — `autonomy.json`:
```json
{
  "autonomy": {
    "heartbeat": "L1",
    "research": "L2",
    "sop_writing": "L2",
    "config_change": "L3",
    "deployment": "L3",
    "external_comms": "L2",
    "security_scan": "L2",
    "security_remediate": "L3",
    "email_action": "L3",
    "dashboard_ui": "L3",
    "dashboard_structural": "L3"
  }
}
```

Note: Smokey gets L2 for `external_comms` — monitoring alerts to Slack are classified as notifications, not external comms.

**da-fino** — `autonomy.json`:
```json
{
  "autonomy": {
    "heartbeat": "L1",
    "research": "L2",
    "sop_writing": "L2",
    "config_change": "L3",
    "deployment": "L3",
    "external_comms": "L3",
    "security_scan": "L2",
    "security_remediate": "L3",
    "email_action": "L3",
    "dashboard_ui": "L3",
    "dashboard_structural": "L3"
  }
}
```

**donny** — `autonomy.json`:
```json
{
  "autonomy": {
    "heartbeat": "L1",
    "research": "L2",
    "sop_writing": "L2",
    "config_change": "L3",
    "deployment": "L3",
    "external_comms": "L3",
    "security_scan": "L3",
    "security_remediate": "L3",
    "email_action": "L3",
    "dashboard_ui": "L2",
    "dashboard_structural": "L3"
  }
}
```

**maude, brandt, mailroom** — same as worker/jr base matrix.

- [ ] **Step 2: Write all 9 files, commit**

```bash
# Write files (implementation will use Write tool for each)
cd ~/.openclaw
git add agents/*/agent/autonomy.json
git commit -m "feat: populate autonomy.json for all 9 agents with role-specific overrides"
```

---

## Task 14: Seed focus.md for All 9 Agents

**Files:** 9 agents' `focus.md` files.

- [ ] **Step 1: Write focus.md per agent**

Example for worker:

```markdown
# Focus — Dude (Worker)

## Active Goals
- [ ] Stand up Paperclip task execution pipeline {focus_ref: task-execution}
- [ ] Establish morning brief routine with Jr and Walter {focus_ref: morning-brief}
- [ ] Triage and assign reclassified Paperclip tasks to specialists {focus_ref: task-triage}

## Completed
- [x] Phase 2 onboarding — learn soul.md, test skills, verify chain of command {focus_ref: phase2-onboard}
```

Each agent gets 2-3 initial goals matching their role and trigger assignments. Keep simple — agents will refine.

- [ ] **Step 2: Write all 9 files, commit**

```bash
cd ~/.openclaw
git add agents/*/agent/focus.md
git commit -m "feat: seed focus.md for all 9 agents with initial goals"
```

---

## Task 15: Cron Migration & Backup

**Files:**
- Backup: `~/.openclaw/cron/jobs.json` → `jobs.json.pre-phase3a`
- Modify: `~/.openclaw/cron/jobs.json` (clear after verification)

- [ ] **Step 1: Backup current jobs.json**

```bash
cp ~/.openclaw/cron/jobs.json ~/.openclaw/cron/jobs.json.pre-phase3a
```

- [ ] **Step 2: Verify triggers.json covers all active cron jobs**

The 3 enabled cron jobs map to:
- `da431d82...` (CTO Daily Audit) → `walter-daily-audit` in cto/triggers.json ✓
- `8b887...` (CTO Security Audit) → `walter-security-audit` in cto/triggers.json ✓
- `dca1a...` (CTO Vault Sync) → `walter-vault-sync` in cto/triggers.json ✓

The 12 disabled jobs are either for archived agents (5) or have broken Telegram delivery (7). All are replaced by trigger daemon equivalents.

- [ ] **Step 3: Clear jobs.json after daemon is running**

```bash
# Only do this AFTER Task 16 (systemd) confirms daemon is running
echo '[]' > ~/.openclaw/cron/jobs.json
```

- [ ] **Step 4: Commit**

```bash
cd ~/.openclaw
git add cron/jobs.json cron/jobs.json.pre-phase3a
git commit -m "feat: migrate cron jobs to triggers.json, clear legacy jobs.json"
```

---

## Task 16: Systemd Service & Watchdog

**Files:**
- Create: `~/.config/systemd/user/trigger-daemon.service`
- Create: `~/.openclaw/triggers/watchdog-alert.sh`
- Modify: system crontab (add watchdog entry)

- [ ] **Step 1: Write systemd service file**

Create `~/.config/systemd/user/trigger-daemon.service`:

```ini
[Unit]
Description=OpenClaw Trigger Daemon
After=openclaw-gateway.service paperclip.service

[Service]
Type=simple
WorkingDirectory=%h/.openclaw/triggers
ExecStart=%h/.openclaw/triggers/.venv/bin/python -m daemon
Restart=on-failure
RestartSec=5
Environment=PYTHONPATH=%h/.openclaw/triggers

[Install]
WantedBy=default.target
```

- [ ] **Step 2: Write watchdog alert script**

Create `~/.openclaw/triggers/watchdog-alert.sh`:

```bash
#!/usr/bin/env bash
# Posts to Slack #openclaw-activity when watchdog restarts the daemon
WEBHOOK_URL="${SLACK_WATCHDOG_WEBHOOK_URL:-}"
if [ -n "$WEBHOOK_URL" ]; then
    curl -s -X POST "$WEBHOOK_URL" \
        -H 'Content-Type: application/json' \
        -d "{\"text\": \"⚠️ Trigger daemon restarted by watchdog at $(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
fi
```

```bash
chmod +x ~/.openclaw/triggers/watchdog-alert.sh
```

- [ ] **Step 3: Enable and start the service**

```bash
systemctl --user daemon-reload
systemctl --user enable trigger-daemon.service
systemctl --user start trigger-daemon.service
systemctl --user status trigger-daemon.service
```

- [ ] **Step 4: Verify health endpoint**

```bash
sleep 3
curl -s http://127.0.0.1:18800/health | python3 -m json.tool
```

Expected: `{"ok": true, "agents": 9, "triggers_loaded": N, ...}`

- [ ] **Step 5: Add watchdog cron**

```bash
(crontab -l; echo '*/5 * * * * curl -sf http://localhost:18800/health > /dev/null || (systemctl --user restart trigger-daemon.service && ~/.openclaw/triggers/watchdog-alert.sh)') | crontab -
```

- [ ] **Step 6: Commit**

```bash
cd ~/.openclaw/triggers
git add watchdog-alert.sh
git commit -m "feat: add systemd service and watchdog cron"
```

---

## Task 17: Paperclip Activation

**Files:** None (API calls only)

- [ ] **Step 1: Register missing agents in Paperclip**

```bash
PAPERCLIP_URL="http://127.0.0.1:3101"
PAPERCLIP_KEY="pcp_6721c4b370e3c6a03d4c3fd5a8464c8a9f17b5d4f453fe18"
COMPANY_ID="b2fbca57-a8f9-4cf8-9e35-42e1b63dbbad"

for AGENT in maude brandt smokey da-fino donny mailroom; do
    curl -s -X POST "$PAPERCLIP_URL/api/agents" \
        -H "Authorization: Bearer $PAPERCLIP_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"$AGENT\", \"companyId\": \"$COMPANY_ID\"}"
    echo " → registered $AGENT"
done
```

- [ ] **Step 2: List all agents to verify and identify ghosts**

```bash
curl -s "$PAPERCLIP_URL/api/agents" \
    -H "Authorization: Bearer $PAPERCLIP_KEY" | python3 -m json.tool
```

Deregister any agents that were cut (scout, atlas, herald, oracle, etc.).

- [ ] **Step 3: Reclassify tasks**

```bash
# List current tasks
curl -s "$PAPERCLIP_URL/api/tasks?companyId=$COMPANY_ID" \
    -H "Authorization: Bearer $PAPERCLIP_KEY" | python3 -m json.tool | head -100
```

Review and reassign tasks assigned to cut agents. This is manual — read the task list, identify reassignments, update via API.

- [ ] **Step 4: Set budgets**

```bash
# Set per-agent monthly budgets via Paperclip API
# (exact endpoint depends on Paperclip API — check docs)
```

- [ ] **Step 5: Document Paperclip state**

Record final agent roster, task count, budget settings in a commit message.

---

## Task 18: End-to-End Verification

- [ ] **Step 1: Verify daemon health**

```bash
curl -s http://127.0.0.1:18800/health | python3 -m json.tool
curl -s http://127.0.0.1:18800/metrics | python3 -m json.tool
```

- [ ] **Step 2: Test once trigger (fires in 1 minute)**

Add a test trigger to worker's triggers.json:

```json
{
    "id": "test-once",
    "type": "once",
    "config": { "at": "2026-03-18T23:00:00Z" },
    "action_type": "heartbeat",
    "focus_ref": null,
    "reason": "Test once trigger",
    "enabled": true,
    "cooldown_seconds": 0,
    "prompt": "This is a test trigger. Reply with: TEST_OK"
}
```

Set `at` to 1 minute from now. Wait, check audit log:

```bash
tail -5 ~/.openclaw/triggers/audit.log
```

Remove test trigger after verification.

- [ ] **Step 3: Test on_message trigger (inbox file drop)**

```bash
cat > ~/.openclaw/agents/worker/inbox/$(date +%s)-jr-test-goal.md << 'EOF'
---
from: jr
to: dude
timestamp: 2026-03-18T23:05:00Z
subject: Test goal
priority: normal
focus_ref: null
---

This is a test message from Jr. Please confirm you received it.
EOF
```

Wait 30s, check:

```bash
ls ~/.openclaw/agents/worker/inbox/archive/
tail -5 ~/.openclaw/triggers/audit.log
```

- [ ] **Step 4: Test webhook trigger**

```bash
PAYLOAD='{"action":"test"}'
SECRET="test-secret"  # set to actual value from env
SIG="sha256=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)"
curl -s -X POST http://localhost:18800/hook/dude-github \
    -H "Content-Type: application/json" \
    -H "X-Hub-Signature-256: $SIG" \
    -d "$PAYLOAD"
```

- [ ] **Step 5: Test self-adaptive triggering**

Agent modifies its own triggers.json during a session → check audit for ADAPT entry.

- [ ] **Step 6: Test focus-trigger binding**

Mark a focus item `[x]` in an agent's focus.md → verify associated triggers stop firing on next cycle.

- [ ] **Step 7: Test watchdog**

```bash
systemctl --user stop trigger-daemon.service
# Wait 5 minutes for watchdog cron to restart
systemctl --user status trigger-daemon.service
```

- [ ] **Step 8: Final commit**

```bash
cd ~/.openclaw/triggers
git add -A
git commit -m "chore: end-to-end verification complete, Phase 3a operational"
```

---

## Post-Implementation: Update Memory

After all tasks complete, update these memory files:
- `project_full_activation.md` — mark Phase 3a COMPLETE, document known issues
- `project_phase3_decisions.md` — add implementation notes
- `MEMORY.md` — update Phase 3a status line
