import argparse
import threading
import tomllib
import webbrowser
from pathlib import Path
from dayisle.server import create_server


def main():
    parser = argparse.ArgumentParser(description="时屿 · 本地生活时间地图")
    parser.add_argument("--port", type=int)
    parser.add_argument("--data-dir", help="数据目录，可指定空目录恢复备份")
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    with (root / "config.toml").open("rb") as stream:
        config = tomllib.load(stream)
    try:
        server = create_server(config, root, port=args.port, data_dir=args.data_dir)
    except (OSError, ValueError) as exc:
        print(f"启动失败：{exc}\n请检查端口是否已使用，或数据目录是否被另一个实例打开。")
        return 1
    url = f"http://127.0.0.1:{server.server_port}"
    print(f"DayIsle: {url}\nData: {server.store.path}\nPress Ctrl+C to stop.", flush=True)
    if not args.no_browser:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        server.store.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
