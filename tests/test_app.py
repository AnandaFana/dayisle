import copy
import json
import tempfile
import threading
import tomllib
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from dayisle.storage import Store, Conflict
from dayisle.domain import changes_for_save, changes_for_delete, changes_for_import, changes_for_restore
from dayisle.reports import report
from dayisle.server import create_server

ROOT = Path(__file__).resolve().parents[1]
CONFIG = tomllib.loads((ROOT / "config.toml").read_text(encoding="utf-8"))


def event(**kwargs):
    return dict(id="parent", title="测试项目", category_id="work", start="2026-09-07T09:00", end="2026-09-13T18:00", parent_id=None, status="active", progress=40, minutes=0, notes="进展说明", tags=["测试"], **kwargs)


class DomainTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(self.temp.name, CONFIG["categories"])

    def tearDown(self):
        self.store.close()
        self.temp.cleanup()

    def save(self, collection, record):
        return self.store.commit(self.store.revision, changes_for_save(self.store, collection, record))

    def test_persistence_unicode_and_no_seeded_events(self):
        self.assertEqual(self.store.snapshot()["events"], [])
        self.save("events", event())
        revision = self.store.revision
        self.store.close()
        self.store = Store(self.temp.name, CONFIG["categories"])
        self.assertEqual(self.store.revision, revision)
        self.assertEqual(self.store.snapshot()["events"][0]["title"], "测试项目")

    def test_optimistic_conflict_never_overwrites(self):
        stale = self.store.revision
        self.save("events", event())
        with self.assertRaises(Conflict):
            self.store.commit(stale, [])
        self.assertEqual(len(self.store.snapshot()["events"]), 1)

    def test_parent_cycle_and_child_time_validation(self):
        self.save("events", event())
        child = {**event(), "id": "child", "parent_id": "parent", "start": "2026-09-08T10:00", "end": "2026-09-08T11:00"}
        self.save("events", child)
        with self.assertRaises(ValueError):
            self.save("events", {**event(), "parent_id": "child"})
        with self.assertRaises(ValueError):
            self.save("events", {**event(), "end": "2026-09-07T12:00"})
        with self.assertRaises(ValueError):
            self.save("events", {**child, "end": "2026-09-20T12:00"})
        self.assertEqual(len(self.store.snapshot()["events"]), 2)

    def test_delete_descendants_preserves_journal(self):
        self.save("events", event())
        self.save("events", {**event(), "id": "child", "parent_id": "parent"})
        self.save("journals", {"title": "日记", "date": "2026-09-08", "event_id": "child"})
        self.store.commit(self.store.revision, changes_for_delete(self.store, "events", "parent"))
        self.assertTrue(all(e["deleted"] for e in self.store.snapshot()["events"]))
        journal = self.store.snapshot()["journals"][0]
        self.assertFalse(journal["deleted"])
        self.assertIsNone(journal["event_id"])

    def test_category_constraints(self):
        self.save("events", event())
        with self.assertRaises(ValueError):
            changes_for_delete(self.store, "categories", "work")
        with self.assertRaises(ValueError):
            self.save("categories", {"name": "工作", "color": "#aabbcc"})
        with self.assertRaises(ValueError):
            self.save("categories", {"name": "其他", "color": "red; injection"})

    def test_backup_roundtrip_and_idempotency(self):
        self.save("events", event())
        backup = {"format": "dayisle-backup-v1", **self.store.snapshot()}
        self.assertEqual(changes_for_import(self.store, backup), [])
        with tempfile.TemporaryDirectory() as directory:
            other = Store(directory, CONFIG["categories"])
            try:
                other.commit(other.revision, changes_for_import(other, backup))
                self.assertEqual(other.snapshot()["events"], self.store.snapshot()["events"])
            finally:
                other.close()

    def test_import_conflict_is_all_or_nothing(self):
        self.save("events", event())
        backup = {"format": "dayisle-backup-v1", **self.store.snapshot()}
        backup["events"].insert(0, {**event(), "id": "new-event"})
        backup["events"][1]["title"] = "冲突标题"
        before = self.store.snapshot()
        with self.assertRaises(ValueError):
            changes_for_import(self.store, backup)
        self.assertEqual(self.store.snapshot(), before)

    def test_incomplete_jsonl_fails_without_changing_file(self):
        self.store.close()
        with self.store.path.open("ab") as file:
            file.write(b'{"revision":')
        before = self.store.path.read_bytes()
        with self.assertRaisesRegex(ValueError, "损坏"):
            Store(self.temp.name, CONFIG["categories"])
        self.assertEqual(self.store.path.read_bytes(), before)

    def test_exclusive_writer_lock(self):
        with self.assertRaises(OSError):
            Store(self.temp.name, CONFIG["categories"])

    def test_restore_child_restores_necessary_ancestors(self):
        self.save("events", event())
        self.save("events", {**event(), "id": "child", "parent_id": "parent"})
        self.save("events", {**event(), "id": "sibling", "parent_id": "parent"})
        self.store.commit(self.store.revision, changes_for_delete(self.store, "events", "parent"))
        self.store.commit(self.store.revision, changes_for_delete(self.store, "categories", "work"))
        self.store.commit(self.store.revision, changes_for_restore(self.store, "events", "child"))
        self.assertFalse(self.store.data["events"]["parent"]["deleted"])
        self.assertFalse(self.store.data["events"]["child"]["deleted"])
        self.assertFalse(self.store.data["categories"]["work"]["deleted"])
        self.assertTrue(self.store.data["events"]["sibling"]["deleted"])

    def test_report_does_not_count_calendar_span_as_effort(self):
        self.save("events", event())
        self.save("events", {**event(), "id": "child", "parent_id": "parent", "minutes": 90, "end": "2026-09-08T10:00"})
        text = report(self.store.snapshot(), "2026-09-07", "2026-09-13")
        self.assertIn("手填投入：1.5 小时", text)
        earlier = report(self.store.snapshot(), "2026-09-07", "2026-09-07")
        self.assertIn("手填投入：未填写", earlier)

    def test_optional_progress_and_explicit_zero_are_distinct(self):
        self.save("events", {**event(), "progress": None, "minutes": None})
        stored = self.store.snapshot()["events"][0]
        self.assertIsNone(stored["progress"])
        self.assertIsNone(stored["minutes"])
        self.assertFalse(stored["progress_explicit"])
        text = report(self.store.snapshot(), "2026-09-07", "2026-09-13")
        self.assertNotIn("%", text)
        self.save("events", {**event(), "progress": 0, "progress_explicit": True})
        self.assertIn(" · 0%", report(self.store.snapshot(), "2026-09-07", "2026-09-13"))

    def test_legacy_zero_is_not_presented_as_entered_progress(self):
        self.save("events", {**event(), "progress": 0})
        self.assertFalse(self.store.snapshot()["events"][0]["progress_explicit"])
        self.assertNotIn("%", report(self.store.snapshot(), "2026-09-07", "2026-09-13"))

    def test_ongoing_record_accepts_unbounded_children_and_backups(self):
        self.save("events", {**event(), "kind": "record", "end": None, "progress": None, "minutes": None, "status": "done"})
        self.save("events", {**event(), "id": "child", "kind": "record", "parent_id": "parent", "start": "2027-01-01T09:00", "end": None})
        stored = self.store.data["events"]["parent"]
        self.assertEqual(stored["status"], "active")
        self.assertIsNone(stored["progress"])
        snapshot = self.store.snapshot()
        self.assertEqual(changes_for_import(self.store, {"format":"dayisle-backup-v1", **snapshot}), [])
        text = report(snapshot, "2027-01-01", "2027-01-07")
        self.assertIn("持续记录中", text)
        self.assertNotIn("%", text)
        with self.assertRaises(ValueError):
            self.save("events", {**stored, "end": "2026-10-01T12:00"})

    def test_task_requires_end_and_records_keep_valid_time_bounds(self):
        with self.assertRaises(ValueError):
            self.save("events", {**event(), "end": None})
        self.save("events", event())
        with self.assertRaises(ValueError):
            self.save("events", {**event(), "id":"child", "parent_id":"parent", "kind":"record", "end":None})
        with self.assertRaises(ValueError):
            self.save("events", {**event(), "kind":"record", "end":"2026-09-01T01:00"})

    def test_old_backup_import_does_not_rewrite_current_records(self):
        # Model a v1 file, with no kind/progress_explicit fields.
        legacy={**event(), "deleted":False, "created_at":"2026-09-11", "updated_at":"2026-09-11"}
        self.store.commit(self.store.revision,[{"collection":"events","record":legacy}])
        before=self.store.path.read_bytes()
        self.assertEqual(changes_for_import(self.store,{"format":"dayisle-backup-v1",**self.store.snapshot()}),[])
        self.assertEqual(self.store.path.read_bytes(),before)

    def test_work_report_excludes_private_journals(self):
        self.save("journals", {"title": "PRIVATE_TITLE", "notes": "PRIVATE_BODY", "date": "2026-09-08"})
        text = report(self.store.snapshot(), "2026-09-07", "2026-09-13", "work")
        self.assertNotIn("PRIVATE", text)
        self.assertIn("PRIVATE_BODY", report(self.store.snapshot(), "2026-09-07", "2026-09-13"))

    def test_invalid_data_rejected(self):
        for patch in ({"end": "2026-09-01T00:00"}, {"progress": 101}, {"minutes": -2}, {"status": "unknown"}, {"category_id": "missing"}, {"title": ""}):
            with self.subTest(patch=patch), self.assertRaises(ValueError):
                self.save("events", {**event(), **patch})


class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.server = create_server(CONFIG, ROOT, port=0, data_dir=cls.temp.name)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.thread.join()
        cls.server.server_close()
        cls.server.store.close()
        cls.temp.cleanup()

    def request(self, path, body=None, headers=None):
        request = Request(self.base + path, data=json.dumps(body).encode() if body is not None else None, headers=headers or {})
        try:
            response = urlopen(request, timeout=5)
        except HTTPError as response_error:
            response = response_error
        with response:
            return response.status, response.read(), response.headers

    def test_assets_and_demo_isolation(self):
        for path in ("/", "/styles.css", "/themes.css", "/js/app.js", "/js/ui.js", "/js/pages.js", "/js/state.js", "/js/timeline.js", "/js/editors.js"):
            status, content, headers = self.request(path)
            self.assertEqual(status, 200)
            self.assertTrue(content)
            self.assertIn("frame-ancestors 'none'", headers["Content-Security-Policy"])
        before = self.server.store.snapshot()
        self.assertTrue(json.loads(self.request('/api/demo')[1])["events"])
        self.assertEqual(before, self.server.store.snapshot())

    def test_block_cross_origin_and_dns_rebinding(self):
        self.assertEqual(self.request('/api/state', headers={"Host": "evil.example"})[0], 403)
        self.assertEqual(self.request('/api/save', {}, {"X-DayIsle": "1", "Origin": "https://evil.example"})[0], 403)
        self.assertEqual(self.request('/api/save', {})[0], 403)

    def test_save_export_and_conflict(self):
        snapshot = json.loads(self.request('/api/state')[1])
        body = {"revision": snapshot["revision"], "collection": "events", "record": {**event(), "id": "http-test", "title": "=2+3"}}
        self.assertEqual(self.request('/api/save', body, {"X-DayIsle": "1"})[0], 200)
        self.assertEqual(self.request('/api/save', body, {"X-DayIsle": "1"})[0], 409)
        status, content, headers = self.request('/api/export.csv')
        self.assertEqual(status, 200)
        self.assertIn("'=2+3", content.decode('utf-8-sig'))
        backup = json.loads(self.request('/api/backup')[1])
        self.assertEqual(backup['format'], 'dayisle-backup-v1')

    def test_path_and_bad_requests(self):
        self.assertEqual(self.request('/../config.toml')[0], 404)
        self.assertEqual(self.request('/api/export.csv?collection=unknown')[0], 400)
        self.assertEqual(self.request('/api/report?start=bad&end=bad')[0], 400)
        self.assertEqual(self.request('/api/save', [], {"X-DayIsle": "1"})[0], 400)


if __name__ == "__main__":
    unittest.main()
