"""Deterministic reports: scheduled spans are never treated as hours worked."""
from datetime import date, datetime, timedelta

STATUS_LABELS = {"planned": "待开始", "active": "进行中", "done": "已完成", "paused": "暂停"}


def report(data, start, end, category="all"):
    first, last = date.fromisoformat(start), date.fromisoformat(end)
    if first > last:
        raise ValueError("报告结束日期不能早于开始日期")
    begin, until = first.isoformat(), (last + timedelta(days=1)).isoformat()
    events = [e for e in data["events"] if not e.get("deleted") and e["start"] < until and (not e.get("end") or e["end"] > begin) and (category == "all" or e["category_id"] == category)]
    journals = [j for j in data["journals"] if not j.get("deleted") and start <= j["date"] <= end]
    # Explicit effort is attributed on the event end date, never prorated from calendar span.
    effort = [e for e in events if start <= (e.get("end") or e["start"])[:10] <= end]
    hours = sum(e.get("minutes") or 0 for e in effort) / 60
    effort_text = f"{hours:g} 小时" if hours else "未填写"
    lines = [f"# 时屿 · 生活回顾", f"\n{start} — {end}\n", f"- 区间相交事件：{len(events)} 项", f"- 当前标记完成：{sum(e['status'] == 'done' and e.get('kind') != 'record' for e in events)} 项", f"- 手填投入：{effort_text}", "\n> 状态为生成报告时的当前状态，不代表历史状态。独立投入按结束日归属；无结束日的持续记录按开始日归属，建议以每日子记录填写用时。父子记录不要重复填写用时；跨期用时不自动拆分。", "\n## 事件与成果\n"]
    categories = {c["id"]: c["name"] for c in data["categories"]}
    for e in sorted(events, key=lambda e: e["start"]):
        title = e['title'].replace('\n', ' ')
        state_text = "持续记录" if e.get("kind") == "record" else STATUS_LABELS[e["status"]]
        progress = e.get("progress")
        show_progress = e.get("kind") != "record" and progress is not None and e.get("progress_explicit", progress > 0 or e["status"] == "done")
        suffix = f" · {progress}%" if show_progress else ""
        lines.append(f"- {'↳ ' if e.get('parent_id') else ''}**{title}** · {categories.get(e['category_id'], '')} · {state_text}{suffix}")
        end_text = e["end"].replace("T", " ") if e.get("end") else "持续记录中"
        minutes_text = f"；手填投入 {e['minutes']} 分钟" if e.get("minutes") else ""
        lines.append(f"  - {e['start'].replace('T', ' ')} → {end_text}{minutes_text}")
        if e.get("notes"):
            lines.extend("  > " + line for line in e["notes"].splitlines())
    if not events:
        lines.append("本区间还没有事件记录。")
    lines += ["\n## 日记摘录\n"]
    if category != "all":
        lines.append("> 为保护私人记录，分类报告不包含日记。\n")
    else:
        for j in sorted(journals, key=lambda j: j["date"]):
            lines += [f"### {j['date']} · {j['title']} · {j['mood']}\n", j["notes"], ""]
    lines += ["\n## 留给自己的三个问题\n", "- 什么值得继续？\n", "- 什么可以调整？\n", "- 下一阶段，最想推进的一件事是什么？\n"]
    return "\n".join(lines)
