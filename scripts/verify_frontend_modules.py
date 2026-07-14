#!/usr/bin/env python3
"""Validate the browser's static, relative ESM dependency graph."""

from __future__ import annotations

import argparse
import os
import re
from pathlib import Path


class ModuleGraphError(AssertionError):
    pass


RAW_DYNAMIC_IMPORT = re.compile(r"\bimport\s*\(")


def _skip_quoted(source: str, index: int, quote: str, path: Path) -> int:
    start = index
    index += 1
    while index < len(source):
        if source[index] == "\\":
            index += 2
        elif source[index] == quote:
            return index + 1
        else:
            index += 1
    line = source.count("\n", 0, start) + 1
    raise ModuleGraphError(f"{path}:{line}: nicht abgeschlossene Zeichenkette")


def _skip_template(source: str, index: int, path: Path) -> int:
    start = index
    index += 1
    while index < len(source):
        if source[index] == "\\":
            index += 2
        elif source.startswith("${", index):
            index = _find_expression_end(source, index + 2, path) + 1
        elif source[index] == "`":
            return index + 1
        else:
            index += 1
    line = source.count("\n", 0, start) + 1
    raise ModuleGraphError(f"{path}:{line}: nicht abgeschlossenes Template")


def _find_expression_end(source: str, index: int, path: Path) -> int:
    start = index
    depth = 1
    while index < len(source):
        if source.startswith("//", index):
            end = source.find("\n", index + 2)
            index = len(source) if end < 0 else end
        elif source.startswith("/*", index):
            end = source.find("*/", index + 2)
            if end < 0:
                line = source.count("\n", 0, index) + 1
                raise ModuleGraphError(f"{path}:{line}: nicht abgeschlossener Kommentar")
            index = end + 2
        elif source[index] in "'\"":
            index = _skip_quoted(source, index, source[index], path)
        elif source[index] == "`":
            index = _skip_template(source, index, path)
        elif source[index] == "{":
            depth += 1
            index += 1
        elif source[index] == "}":
            depth -= 1
            if depth == 0:
                return index
            index += 1
        else:
            index += 1
    line = source.count("\n", 0, start) + 1
    raise ModuleGraphError(f"{path}:{line}: nicht abgeschlossener Template-Ausdruck")


def _tokens(source: str, path: Path) -> list[tuple[str, str, int]]:
    tokens: list[tuple[str, str, int]] = []
    index = 0
    line = 1
    length = len(source)
    while index < length:
        char = source[index]
        if char.isspace():
            line += char == "\n"
            index += 1
            continue
        if source.startswith("//", index):
            end = source.find("\n", index + 2)
            index = length if end < 0 else end
            continue
        if source.startswith("/*", index):
            end = source.find("*/", index + 2)
            if end < 0:
                raise ModuleGraphError(f"{path}:{line}: nicht abgeschlossener Kommentar")
            line += source[index:end + 2].count("\n")
            index = end + 2
            continue
        if char == "`":
            start_line = line
            index += 1
            value = []
            while index < length:
                if source[index] == "\\":
                    value.append(source[index:index + 2])
                    line += source[index:index + 2].count("\n")
                    index += 2
                elif source.startswith("${", index):
                    expression_start = index + 2
                    expression_end = _find_expression_end(source, expression_start, path)
                    expression_line = line
                    nested = _tokens(source[expression_start:expression_end], path)
                    tokens.extend((kind, value, token_line + expression_line - 1) for kind, value, token_line in nested)
                    segment = source[index:expression_end + 1]
                    value.append(segment)
                    line += segment.count("\n")
                    index = expression_end + 1
                elif source[index] == "`":
                    index += 1
                    tokens.append(("template", "".join(value), start_line))
                    break
                else:
                    value.append(source[index])
                    line += source[index] == "\n"
                    index += 1
            else:
                raise ModuleGraphError(f"{path}:{start_line}: nicht abgeschlossenes Template")
            continue
        if char in "'\"":
            quote = char
            start_line = line
            index += 1
            value = []
            escaped = False
            while index < length:
                char = source[index]
                if escaped:
                    value.extend(("\\", char))
                    escaped = False
                elif char == "\\":
                    escaped = True
                elif char == quote:
                    index += 1
                    tokens.append(("template" if quote == "`" else "string", "".join(value), start_line))
                    break
                else:
                    value.append(char)
                line += char == "\n"
                index += 1
            else:
                raise ModuleGraphError(f"{path}:{start_line}: nicht abgeschlossene Zeichenkette")
            continue
        if char.isalpha() or char in "_$":
            start = index
            index += 1
            while index < length and (source[index].isalnum() or source[index] in "_$"):
                index += 1
            tokens.append(("identifier", source[start:index], line))
            continue
        tokens.append(("punctuation", char, line))
        index += 1
    return tokens


def static_imports(path: Path) -> list[tuple[str, int]]:
    source = path.read_text(encoding="utf-8")
    dynamic_import = RAW_DYNAMIC_IMPORT.search(source)
    if dynamic_import:
        line = source.count("\n", 0, dynamic_import.start()) + 1
        raise ModuleGraphError(f"{path}:{line}: dynamischer Import ist nicht erlaubt")
    tokens = _tokens(source, path)
    imports: list[tuple[str, int]] = []
    for index, (kind, value, line) in enumerate(tokens):
        if kind != "identifier" or value not in {"import", "export"}:
            continue
        if value == "import" and index > 0 and tokens[index - 1][1] == ".":
            continue
        following = tokens[index + 1:index + 2]
        if value == "import" and following and following[0][1] == ".":
            continue
        if value == "import" and following and following[0][1] == "(":
            raise ModuleGraphError(f"{path}:{line}: dynamischer Import ist nicht erlaubt")
        if value == "import" and following and following[0][0] == "string":
            imports.append((following[0][1], following[0][2]))
            continue
        if value == "export" and (not following or following[0][1] not in {"{", "*"}):
            continue
        depth = 0
        for candidate_index in range(index + 1, len(tokens) - 1):
            candidate = tokens[candidate_index]
            if candidate[1] in {"(", "[", "{"}:
                depth += 1
                continue
            if candidate[1] in {")", "]", "}"}:
                depth -= 1
                continue
            if candidate[1] == ";" and depth == 0:
                break
            if depth == 0 and candidate[0] == "identifier" and candidate[1] == "from":
                specifier = tokens[candidate_index + 1]
                if specifier[0] != "string":
                    raise ModuleGraphError(f"{path}:{candidate[2]}: Importpfad muss eine Zeichenkette sein")
                imports.append((specifier[1], specifier[2]))
                break
    return imports


def _assert_exact_case(root: Path, path: Path) -> None:
    current = root
    for part in path.relative_to(root).parts:
        entries = {entry.name for entry in current.iterdir()}
        if part not in entries:
            raise ModuleGraphError(f"Groß-/Kleinschreibung stimmt nicht: {path.relative_to(root)}")
        current /= part


def module_graph(js_root: Path, entry_name: str = "main.js") -> frozenset[Path]:
    root = js_root.resolve()
    entry = (root / entry_name).resolve()
    if not entry.is_file():
        raise ModuleGraphError(f"Moduleinstieg fehlt: {js_root / entry_name}")
    _assert_exact_case(root, entry)

    visited: set[Path] = set()
    pending = [entry]
    while pending:
        current = pending.pop()
        if current in visited:
            continue
        visited.add(current)
        for specifier, line in static_imports(current):
            if "\\" in specifier or not specifier.startswith(("./", "../")):
                raise ModuleGraphError(f"{current}:{line}: nur relative Imports sind erlaubt: {specifier}")
            if "?" in specifier or "#" in specifier:
                raise ModuleGraphError(f"{current}:{line}: Importparameter sind nicht erlaubt: {specifier}")
            lexical_path = Path(os.path.abspath(current.parent / specifier))
            if lexical_path.is_relative_to(root):
                _assert_exact_case(root, lexical_path)
            imported = lexical_path.resolve()
            if not imported.is_relative_to(root):
                raise ModuleGraphError(f"{current}:{line}: Import verlässt assets/js: {specifier}")
            if imported.suffix != ".js" or not imported.is_file():
                raise ModuleGraphError(f"{current}:{line}: importiertes JS-Modul fehlt: {specifier}")
            pending.append(imported)

    all_javascript = {path.resolve() for path in root.rglob("*") if path.is_file() and path.suffix.lower() == ".js"}
    unreachable = sorted(path.relative_to(root).as_posix() for path in all_javascript - visited)
    if unreachable:
        raise ModuleGraphError(f"Nicht vom Moduleinstieg erreichbar: {', '.join(unreachable)}")
    return frozenset(path.relative_to(root) for path in visited)


def main() -> None:
    parser = argparse.ArgumentParser(description="Prüft den statischen Frontend-Modulgraphen.")
    parser.add_argument("js_root", type=Path)
    args = parser.parse_args()
    graph = module_graph(args.js_root)
    print(f"Frontend-Modulgraph geprüft: {len(graph)} Module erreichbar.")


if __name__ == "__main__":
    main()
