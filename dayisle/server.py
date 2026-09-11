import csv
import io
import json
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs

from .storage import Store, Conflict
from .domain import changes_for_save, changes_for_delete, changes_for_import, changes_for_restore
from .reports import report
from .demo import make_demo


def create_server(config, root, host=None, port=None, data_dir=None):
    host = host or config["app"]["host"]
    if host not in ("127.0.0.1", "localhost"):
        raise ValueError("此版本用于本机，请将 host 设置为 127.0.0.1")
    port = config["app"]["port"] if port is None else port
    static = (Path(root) / "static").resolve()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            # Do not log diary contents or user-supplied URL queries.
            pass

        def reply(self, code, content, mime="application/json; charset=utf-8", filename=None):
            if not isinstance(content, bytes):
                content = (json.dumps(content, ensure_ascii=False) if mime.startswith("application/json") else content).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
            if filename:
                self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
            self.end_headers()
            self.wfile.write(content)

        def allowed(self, write=False):
            authorities = {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}
            if self.headers.get("Host") not in authorities:
                self.reply(403, {"error": "只允许本机访问"})
                return False
            origin = self.headers.get("Origin")
            if (origin and origin not in {f"http://{a}" for a in authorities}) or (write and self.headers.get("X-DayIsle") != "1"):
                self.reply(403, {"error": "请求来源校验失败"})
                return False
            return True

        def do_GET(self):
            if not self.allowed():
                return
            url = urlsplit(self.path)
            params = parse_qs(url.query)
            try:
                if url.path == "/api/state":
                    self.reply(200, self.server.store.snapshot())
                elif url.path == "/api/config":
                    self.reply(200, {"name": config["app"]["name"], "subtitle": config["app"]["subtitle"], "defaults": config["defaults"], "display": config.get("display", {})})
                elif url.path == "/api/demo":
                    self.reply(200, make_demo(config["categories"]))
                elif url.path == "/api/backup":
                    self.reply(200, {"format": "dayisle-backup-v1", **self.server.store.snapshot()}, filename="dayisle-backup.json")
                elif url.path == "/api/export.csv":
                    collection = params.get("collection", ["events"])[0]
                    if collection not in ("events", "journals", "categories"):
                        raise ValueError("无效导出类型")
                    rows = self.server.store.snapshot()[collection]
                    rows = [r for r in rows if not r.get("deleted")]
                    fields = list(dict.fromkeys(k for r in rows for k in r)) or ["id", "title"]
                    stream = io.StringIO(newline="")
                    writer = csv.DictWriter(stream, fieldnames=fields)
                    writer.writeheader()
                    for r in rows:
                        safe = {}
                        for k, value in r.items():
                            value = json.dumps(value, ensure_ascii=False) if isinstance(value, list) else value
                            if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@", "\t", "\r")):
                                value = "'" + value
                            safe[k] = value
                        writer.writerow(safe)
                    self.reply(200, ("\ufeff" + stream.getvalue()).encode("utf-8"), "text/csv; charset=utf-8", f"dayisle-{collection}.csv")
                elif url.path == "/api/report":
                    snapshot = make_demo(config["categories"]) if params.get("demo") == ["1"] else self.server.store.snapshot()
                    self.reply(200, {"markdown": report(snapshot, params.get("start", [""])[0], params.get("end", [""])[0], params.get("category", ["all"])[0])})
                elif url.path.startswith("/api/"):
                    self.reply(404, {"error": "接口不存在"})
                else:
                    path = (static / ("index.html" if url.path == "/" else url.path.lstrip("/"))).resolve()
                    if not path.is_relative_to(static) or not path.is_file():
                        self.reply(404, {"error": "文件不存在"})
                        return
                    mime = "text/javascript" if path.suffix == ".js" else mimetypes.guess_type(path)[0] or "application/octet-stream"
                    self.reply(200, path.read_bytes(), mime + ("; charset=utf-8" if mime.startswith("text/") else ""))
            except (ValueError, TypeError, KeyError) as exc:
                self.reply(400, {"error": str(exc) or "请求格式错误"})
            except OSError:
                self.reply(500, {"error": "读取文件失败，请检查数据目录"})

        def do_POST(self):
            if not self.allowed(write=True):
                return
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if size < 1 or size > config["app"]["max_body_bytes"]:
                    self.reply(413, {"error": "请求为空或超过配置的文件大小限制"})
                    return
                self.connection.settimeout(15)
                body = json.loads(self.rfile.read(size))
                store = self.server.store
                with store.lock:
                    if body.get("revision") != store.revision:
                        raise Conflict("记录已在其他窗口更新，请刷新后重新保存。当前输入仍会保留。")
                    if self.path == "/api/save":
                        changes = changes_for_save(store, body["collection"], body["record"])
                    elif self.path == "/api/delete":
                        changes = changes_for_delete(store, body["collection"], body["id"])
                    elif self.path == "/api/import":
                        changes = changes_for_import(store, body["backup"])
                    elif self.path == "/api/restore":
                        changes = changes_for_restore(store, body["collection"], body["id"])
                    else:
                        self.reply(404, {"error": "接口不存在"})
                        return
                    self.reply(200, store.commit(body["revision"], changes))
            except Conflict as exc:
                self.reply(409, {"error": str(exc)})
            except (ValueError, TypeError, KeyError, AttributeError) as exc:
                self.reply(400, {"error": str(exc) or "输入格式错误"})
            except OSError:
                self.reply(500, {"error": "未能保存，请检查磁盘空间和目录权限；保留当前输入后重试。"})

    server = ThreadingHTTPServer((host, port), Handler)
    server.daemon_threads = True
    try:
        server.store = Store(data_dir or Path(root) / config["app"]["data_dir"], config["categories"])
    except Exception:
        server.server_close()
        raise
    return server
