from datetime import date, timedelta


def make_demo(categories):
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    def stamp(offset, hour):
        return f"{(monday + timedelta(days=offset)).isoformat()}T{hour}:00"
    specs = [
        ("demo-work", "把想法变成一个小作品", "work", 0, 5, "active", 65, None, 0, "梳理想法、搭建雏形，给这一周留下一点看得见的进展。", ["创造", "本周重点"]),
        ("demo-research", "收集灵感与参考", "work", 0, 1, "done", 100, "demo-work", 90, "选出三个喜欢的案例，记录它们让人舒服的原因。", ["灵感"]),
        ("demo-build", "完成第一个可用版本", "work", 2, 4, "active", 55, "demo-work", 180, "先让核心流程可以顺畅使用。", ["专注"]),
        ("demo-read", "读一本想读很久的书", "learn", 0, 6, "active", 40, None, 120, "不赶进度，每天读一点，再写下一句自己的理解。", ["阅读"]),
        ("demo-run", "傍晚去公园走走", "life", 2, 2, "done", 100, None, 40, "看见了很好看的晚霞。", ["户外", "小确幸"]),
        ("demo-home", "整理一个舒服的角落", "life", 4, 5, "planned", 0, None, 0, "给书、植物和新的想法留一点空间。", ["家"]),
        ("demo-film", "周末电影之夜", "fun", 5, 5, "planned", 0, None, 0, "挑一部轻松的电影，准备好喜欢的零食。", ["放松"]),
    ]
    events = []
    for i, title, cat, a, b, status, progress, parent, minutes, notes, tags in specs:
        events.append(dict(id=i, title=title, category_id=cat, start=stamp(a, "09"), end=stamp(b, "22"), status=status, progress=progress, parent_id=parent, minutes=minutes, notes=notes, tags=tags, deleted=False))
    events.insert(0, dict(id="demo-fitness", title="健身 · 与身体好好相处", kind="record", category_id="life", start=f"{(today-timedelta(days=60)).isoformat()}T09:00", end=None, status="active", progress=None, progress_explicit=False, parent_id=None, minutes=None, notes="不设终点，也不考核百分比。散步、拉伸、练力量，每一次都记在下面。", tags=["日常", "身体"], deleted=False))
    for index, (offset, hour, title) in enumerate([(0, "09", "晨间拉伸"), (1, "09", "公园散步"), (1, "17", "肩颈放松"), (2, "09", "轻松慢跑"), (3, "09", "力量练习"), (3, "17", "饭后走一走"), (4, "09", "周五瑜伽")]):
        events.append(dict(id=f"demo-fitness-{index}", title=title, kind="record", category_id="life", start=stamp(offset, hour), end=stamp(offset, str(int(hour)+1).zfill(2)), status="active", progress=None, progress_explicit=False, parent_id="demo-fitness", minutes=None, notes="今天动一动，感觉舒服了一点。", tags=["日常"], deleted=False))
    return dict(revision=0, events=events, categories=categories, journals=[dict(id="demo-journal", date=today.isoformat(), title="普通的一天，也有值得收藏的瞬间", notes="今天把一个惦记很久的想法往前推了一小步。\n\n傍晚出门走了走，风已经有了一点秋天的味道。比起把每一分钟填满，我更想记住这些真实的片刻。\n\n明天的小愿望：读几页书，认真吃一顿饭。", mood="充实", tags=["小确幸"], event_id=None, deleted=False)])
