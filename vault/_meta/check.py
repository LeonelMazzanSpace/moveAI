#!/usr/bin/env python3
"""Structural validator for the MOVE knowledge vault.

Checks that the graph is still the thing it claims to be: a closed relation
vocabulary, resolvable links, grounded notes, and an acyclic structural layer.
Also regenerates _meta/edges.md, the inbound-edge index for readers without
a backlinks pane (i.e. Claude reading the vault as plain files).

Usage: python3 _meta/check.py        (from the vault root, or anywhere)
Exit 0 = clean, 1 = at least one failure. Sinks are reported, never failed on.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

VAULT = Path(__file__).resolve().parent.parent
# Sources are written as "move/<path>[#anchor]"; "move/" is the monorepo root.
REPO_ROOT = VAULT.parent
REPO_PREFIX = "move/"
FOLDER_TYPE = {
    "concepts": "concept",
    "constraints": "constraint",
    "failures": "failure",
    "decisions": "decision",
    "systems": "system",
    "screens": "screen",
    "MOC": "moc",
}
STATUSES = {"shipped", "built-off-by-default", "proposed", "draft", "todo", "superseded"}
# Sinks are normal for a chain endpoint or a leaf definition. They are suspicious in
# constraints/ and decisions/, where a note that establishes or forbids nothing is inert.
SINK_SUSPECT = {"constraints", "decisions"}
LINK = re.compile(r"\[\[([^\]|]+?)\]\]")
SECTION = re.compile(r"^##\s+(Structural|Associative)\s*$")
HEADING = re.compile(r"^#{1,6}\s")

failures: list[str] = []


def load_relations() -> tuple[set[str], set[str]]:
    """Read the two relation tables out of _meta/relations.md."""
    text = (VAULT / "_meta" / "relations.md").read_text(encoding="utf-8")
    out = []
    for header in ("## Structural", "## Associative"):
        start = text.index(header)
        end = text.find("\n## ", start + 1)
        body = text[start : end if end != -1 else len(text)]
        out.append({m.group(1) for m in re.finditer(r"^\|\s*`([^`]+)`\s*\|", body, re.M)})
    return out[0], out[1]


def parse_frontmatter(text: str) -> dict:
    if not text.startswith("---\n"):
        return {}
    end = text.find("\n---", 4)
    if end == -1:
        return {}
    data, key = {}, None
    for line in text[4:end].splitlines():
        if not line.strip():
            continue
        if line.startswith("  - ") and key:
            data.setdefault(key, []).append(line[4:].strip())
        elif ":" in line:
            key, _, value = line.partition(":")
            key = key.strip()
            value = value.strip()
            if value:
                data[key] = value
    return data


def relation_of(line: str, vocab: set[str]) -> str | None:
    """Longest-match the relation that opens an edge line."""
    body = line.lstrip("-").strip()
    return max(
        (r for r in vocab if body.startswith(r + " →")),
        key=len,
        default=None,
    )


def main() -> int:
    structural_rels, associative_rels = load_relations()
    all_rels = structural_rels | associative_rels

    notes = sorted(
        p for p in VAULT.rglob("*.md")
        if "_meta" not in p.parts and not p.name.startswith(".")
    )
    titles = {p.stem for p in notes}
    edges: dict[str, list[str]] = {}
    sinks: dict[str, list[str]] = {}
    inbound: dict[str, list[str]] = {}

    for path in notes:
        rel = path.relative_to(VAULT)
        folder = rel.parts[0] if len(rel.parts) > 1 else ""
        text = path.read_text(encoding="utf-8")

        # --- frontmatter (content folders and MOC only) ---
        if folder in FOLDER_TYPE:
            fm = parse_frontmatter(text)
            expected = FOLDER_TYPE[folder]
            if fm.get("type") != expected:
                failures.append(f"{rel}: type is {fm.get('type')!r}, folder wants {expected!r}")
            if fm.get("status") not in STATUSES:
                failures.append(f"{rel}: status {fm.get('status')!r} not in {sorted(STATUSES)}")
            if not fm.get("source"):
                failures.append(f"{rel}: no source: pointer")
            sources = fm.get("source")
            for src in sources if isinstance(sources, list) else [sources] if sources else []:
                path_part = src.split("#", 1)[0]
                if not path_part.startswith(REPO_PREFIX):
                    failures.append(f"{rel}: source {src!r} must start with {REPO_PREFIX!r}")
                elif not (REPO_ROOT / path_part[len(REPO_PREFIX):]).exists():
                    failures.append(f"{rel}: source {src!r} does not exist")

        # --- every wikilink in the note must resolve, not only relation lines ---
        for target in LINK.findall(text):
            if target not in titles:
                failures.append(f"{rel}: [[{target}]] does not resolve")

        # --- relation lines ---
        section = None
        outbound: list[str] = []
        for n, line in enumerate(text.splitlines(), 1):
            if m := SECTION.match(line):
                section = m.group(1)
                continue
            if HEADING.match(line):
                section = None
                continue
            if not section or not line.strip().startswith("-"):
                continue

            rel_name = relation_of(line, all_rels)
            if rel_name is None:
                failures.append(f"{rel}:{n}: no known relation opens this line: {line.strip()}")
                continue
            if section == "Structural" and rel_name not in structural_rels:
                failures.append(f"{rel}:{n}: {rel_name!r} is associative, used under ## Structural")
            if section == "Associative" and rel_name not in associative_rels:
                failures.append(f"{rel}:{n}: {rel_name!r} is structural, used under ## Associative")

            found = LINK.findall(line)
            if len(found) != 1:
                failures.append(f"{rel}:{n}: expected exactly 1 wikilink, found {len(found)}")
            for target in found:
                if target == path.stem:
                    failures.append(f"{rel}:{n}: self-link - the subject is implicit")
                elif target not in titles:
                    failures.append(f"{rel}:{n}: [[{target}]] does not resolve")
                else:
                    body = line.strip().lstrip("-").strip().replace("[[", "").replace("]]", "")
                    inbound.setdefault(target, []).append(f"{path.stem} — {body}")
                    if section == "Structural":
                        if folder == "MOC":
                            failures.append(f"{rel}:{n}: a MOC is an index; it originates no structural edge")
                        else:
                            outbound.append(target)

        if folder in FOLDER_TYPE and folder != "MOC":
            if outbound:
                edges[path.stem] = outbound
            else:
                sinks.setdefault(folder, []).append(path.stem)

    # --- cycles among structural edges ---
    WHITE, GREY, BLACK = 0, 1, 2
    colour: dict[str, int] = {}

    def walk(node: str, trail: list[str]) -> None:
        colour[node] = GREY
        for nxt in edges.get(node, []):
            if colour.get(nxt, WHITE) == GREY:
                cycle = trail[trail.index(nxt):] if nxt in trail else [nxt]
                failures.append("structural cycle: " + " → ".join(cycle + [nxt]))
            elif colour.get(nxt, WHITE) == WHITE:
                walk(nxt, trail + [nxt])
        colour[node] = BLACK

    for node in list(edges):
        if colour.get(node, WHITE) == WHITE:
            walk(node, [node])

    # --- generated inbound-edge index ---
    # Plain names, no wikilinks: this file is for reading the graph as raw files
    # (Claude has no backlinks pane) and must not add edges to Obsidian's graph.
    out = [
        "# Edge index",
        "",
        "Generated by check.py - do not edit. Inbound edges per note; the authored",
        "copy lives in the origin note, this is only the reverse lookup.",
        "",
    ]
    for target in sorted(inbound):
        out.append(f"## {target}")
        out.extend(f"- {entry}" for entry in sorted(inbound[target]))
        out.append("")
    (VAULT / "_meta" / "edges.md").write_text("\n".join(out), encoding="utf-8")

    # --- report ---
    print(f"{len(notes)} notes · {sum(len(v) for v in edges.values())} structural edges")
    print(f"  inbound index: _meta/edges.md ({len(inbound)} notes with inbound edges)")
    for folder in sorted(sinks):
        names = ", ".join(sorted(sinks[folder]))
        flag = "   <- inert: establishes/forbids nothing" if folder in SINK_SUSPECT else ""
        print(f"  sinks in {folder}/: {len(sinks[folder])}{flag}\n    {names}")

    if failures:
        print(f"\n{len(failures)} problem(s):", file=sys.stderr)
        for f in failures:
            print(f"  {f}", file=sys.stderr)
        return 1
    print("\nclean")
    return 0


if __name__ == "__main__":
    sys.exit(main())
