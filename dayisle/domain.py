import copy
import re
import uuid
from datetime import datetime, date

STATUSES = ("planned", "active", "done", "paused")


def now():
    return datetime.now().isoformat(timespec="seconds")


def text(value, maximum, label, required=False):
    if not isinstance(value, str) or len(value) > maximum or (required and not value.strip()):
        raise ValueError(f"{label}不能为空且不得超过 {maximum} 字" if required else f"{label}格式不正确或过长")
    return value.strip()


def normalize(collection, raw, existing=None):
    if collection not in ("events", "journals", "categories") or not isinstance(raw, dict):
        raise ValueError("无效记录类型")
    r = {"id": raw.get("id") or uuid.uuid4().hex}
    if not isinstance(r["id"], str) or not re.fullmatch(r"[\w-]{1,80}", r["id"]):
        raise ValueError("无效记录 ID")
    r["deleted"] = bool(raw.get("deleted", False))
    r["created_at"] = existing.get("created_at", now()) if existing else now()
    r["updated_at"] = now()
    if collection == "categories":
        r["name"] = text(raw.get("name"), 24, "分类名称", True)
        r["color"] = raw.get("color", "#6d8b70")
        if not isinstance(r["color"], str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", r["color"]):
            raise ValueError("分类颜色必须是六位十六进制颜色")
        return r
    r["title"] = text(raw.get("title"), 160, "标题", True)
    r["notes"] = text(raw.get("notes", ""), 100000, "正文")
    tags = raw.get("tags", [])
    if not isinstance(tags, list) or len(tags) > 20:
        raise ValueError("最多 20 个标签")
    r["tags"] = list(dict.fromkeys(text(t, 30, "标签", True) for t in tags))
    if collection == "journals":
        r["date"] = raw.get("date")
        date.fromisoformat(r["date"])
        r["mood"] = raw.get("mood", "平静")
        if r["mood"] not in ("开心", "平静", "充实", "疲惫", "低落"):
            raise ValueError("无效心情")
        r["event_id"] = raw.get("event_id") or None
    else:
        r["kind"] = raw.get("kind", "task")
        if r["kind"] not in ("task", "record"):
            raise ValueError("请选择普通任务或持续记录")
        r["category_id"] = raw.get("category_id")
        r["parent_id"] = raw.get("parent_id") or None
        r["start"] = raw.get("start")
        r["end"] = raw.get("end") or None
        start = datetime.fromisoformat(r["start"])
        end = datetime.fromisoformat(r["end"]) if r["end"] else None
        if end is None and r["kind"] != "record":
            raise ValueError("普通任务需要结束时间；长期事项可选择持续记录")
        if start.tzinfo or (end and (end.tzinfo or start >= end)):
            raise ValueError("结束时间须晚于开始时间，请使用本地时间")
        r["status"] = raw.get("status", "planned")
        if r["status"] not in STATUSES:
            raise ValueError("无效状态")
        for field, maximum in (("progress", 100), ("minutes", 1000000)):
            value = raw.get(field)
            if value is not None and (isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= maximum):
                raise ValueError(f"{field} 必须在 0 到 {maximum} 之间")
            r[field] = value
        explicit = raw.get("progress_explicit", (r["progress"] or 0) > 0 or r["status"] == "done")
        if not isinstance(explicit, bool):
            raise ValueError("进度标记格式不正确")
        r["progress_explicit"] = explicit and r["progress"] is not None
        if r["kind"] == "record":
            r.update(status="active", progress=None, progress_explicit=False)
        elif r["status"] == "done":
            r["progress"] = 100
            r["progress_explicit"] = True
    return r


def validate_graph(data):
    events = {k: v for k, v in data["events"].items() if not v.get("deleted")}
    categories = {k: v for k, v in data["categories"].items() if not v.get("deleted")}
    if len({c["name"].casefold() for c in categories.values()}) != len(categories):
        raise ValueError("分类名称不能重复")
    for event in events.values():
        if event["category_id"] not in categories:
            raise ValueError("事件的分类不存在")
        seen = {event["id"]}
        child = event
        while child.get("parent_id"):
            parent_id = child["parent_id"]
            if parent_id in seen or parent_id not in events:
                raise ValueError("父事件不存在或形成循环")
            seen.add(parent_id)
            parent = events[parent_id]
            if datetime.fromisoformat(child["start"]) < datetime.fromisoformat(parent["start"]) or (parent.get("end") and (not child.get("end") or datetime.fromisoformat(child["end"]) > datetime.fromisoformat(parent["end"]))):
                raise ValueError("子事件时间需要包含在父事件内，请先调整父事件时间")
            child = parent
    for journal in data["journals"].values():
        if not journal.get("deleted") and journal.get("event_id") and journal["event_id"] not in events:
            raise ValueError("日记关联的事件不存在")


def changes_for_save(store, collection, raw):
    previous = store.data.get(collection, {}).get(raw.get("id"))
    record = normalize(collection, raw, previous)
    candidate = copy.deepcopy(store.data)
    candidate[collection][record["id"]] = record
    validate_graph(candidate)
    return [{"collection": collection, "record": record}]


def changes_for_delete(store, collection, record_id):
    if collection not in store.data or record_id not in store.data[collection]:
        raise ValueError("记录不存在")
    changes = []
    ids = {record_id}
    if collection == "events":
        while True:
            new = {r["id"] for r in store.data["events"].values() if r.get("parent_id") in ids}
            if new <= ids:
                break
            ids |= new
        for journal in store.data["journals"].values():
            if journal.get("event_id") in ids:
                changes.append({"collection": "journals", "record": {**journal, "event_id": None, "updated_at": now()}})
    for item_id in ids:
        changes.append({"collection": collection, "record": {**store.data[collection][item_id], "deleted": True, "updated_at": now()}})
    candidate = copy.deepcopy(store.data)
    for c in changes:
        candidate[c["collection"]][c["record"]["id"]] = c["record"]
    validate_graph(candidate)
    return changes


def changes_for_import(store, backup):
    if not isinstance(backup, dict) or backup.get("format") != "dayisle-backup-v1":
        raise ValueError("请选择时屿导出的 JSON 备份")
    candidate = copy.deepcopy(store.data)
    changes = []
    for collection in ("categories", "events", "journals"):
        rows = backup.get(collection)
        if not isinstance(rows, list):
            raise ValueError("备份缺少数据集合")
        seen = set()
        for raw in rows:
            if not isinstance(raw, dict) or not raw.get("id") or raw["id"] in seen:
                raise ValueError("备份 ID 缺失或重复")
            seen.add(raw["id"])
            existing = candidate[collection].get(raw["id"])
            record = normalize(collection, raw, existing)
            if existing:
                comparable = lambda r: {k: v for k, v in r.items() if k not in ("created_at", "updated_at")}
                if comparable(existing) != comparable(record):
                    # Default categories have no metadata/deleted field.
                    base = normalize(collection, existing, existing)
                    if comparable(base) != comparable(record):
                        raise ValueError(f"备份与当前记录冲突：{raw['id']}。为避免覆盖，未导入任何数据；可用空数据目录恢复。")
                continue
            record["created_at"] = text(raw.get("created_at", now()), 40, "创建时间")
            record["updated_at"] = text(raw.get("updated_at", now()), 40, "修改时间")
            candidate[collection][record["id"]] = record
            changes.append({"collection": collection, "record": record})
    validate_graph(candidate)
    return changes


def changes_for_restore(store, collection, record_id):
    if collection not in store.data or record_id not in store.data[collection]:
        raise ValueError("记录不存在")
    candidate = copy.deepcopy(store.data)
    changes = []
    visited = set()
    pending = [(collection, record_id)]
    while pending:
        kind, item_id = pending.pop()
        if (kind, item_id) in visited:
            continue
        visited.add((kind, item_id))
        r = candidate[kind].get(item_id)
        if not r:
            raise ValueError("关联记录缺失，无法恢复")
        if r.get("deleted"):
            r = {**r, "deleted": False, "updated_at": now()}
            candidate[kind][item_id] = r
            changes.append({"collection": kind, "record": r})
        if kind == "events":
            pending.append(("categories", r["category_id"]))
            if r.get("parent_id"):
                pending.append(("events", r["parent_id"]))
        if kind == "journals" and r.get("event_id"):
            pending.append(("events", r["event_id"]))
    validate_graph(candidate)
    return changes
