"""Append-only JSONL transactions, with optimistic concurrency and fsync."""
import copy
import json
import os
import threading
from pathlib import Path


class Conflict(ValueError):
    pass


class Store:
    def __init__(self, directory, categories):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.path = self.directory / "records.jsonl"
        self.lock = threading.RLock()
        self.revision = 0
        self.data = {"events": {}, "journals": {}, "categories": {}}
        self.lease = (self.directory / ".writer.lock").open("a+b")
        if self.lease.tell() == 0:
            self.lease.write(b"0")
            self.lease.flush()
        self.lease.seek(0)
        try:
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(self.lease.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(self.lease, fcntl.LOCK_EX | fcntl.LOCK_NB)
            if self.path.exists():
                with self.path.open("rb") as stream:
                    for number, line in enumerate(stream, 1):
                        try:
                            if not line.endswith(b"\n"):
                                raise ValueError("Incomplete transaction")
                            tx = json.loads(line)
                            if tx["revision"] != self.revision + 1:
                                raise ValueError("Invalid revision")
                            self._apply(tx["changes"])
                            self.revision = tx["revision"]
                        except Exception as exc:
                            raise ValueError(f"records.jsonl 第 {number} 行损坏；原文件保留，请从备份恢复。") from exc
            else:
                self.commit(0, [{"collection": "categories", "record": c} for c in categories])
        except Exception:
            self.lease.close()
            raise

    def close(self):
        self.lease.close()

    def _apply(self, changes):
        for change in changes:
            self.data[change["collection"]][change["record"]["id"]] = change["record"]

    def snapshot(self):
        with self.lock:
            return {"revision": self.revision, **{k: copy.deepcopy(list(v.values())) for k, v in self.data.items()}}

    def commit(self, revision, changes):
        with self.lock:
            if revision != self.revision:
                raise Conflict("记录已在其他窗口更新。请刷新后重新保存；当前输入仍会保留。")
            tx = {"revision": self.revision + 1, "changes": changes}
            payload = (json.dumps(tx, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
            # One transaction per line: related edits are replayed as a unit.
            with self.path.open("ab") as stream:
                before = stream.tell()
                try:
                    stream.write(payload)
                    stream.flush()
                    os.fsync(stream.fileno())
                except OSError:
                    stream.truncate(before)
                    raise
            self._apply(copy.deepcopy(changes))
            self.revision += 1
            return self.snapshot()
