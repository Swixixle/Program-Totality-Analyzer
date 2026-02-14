import hashlib
from dataclasses import dataclass, asdict
from typing import Optional, List


@dataclass
class Evidence:
    path: str
    line_start: int
    line_end: int
    snippet_hash: str
    display: str

    def to_dict(self):
        return asdict(self)


def make_evidence(path: str, line_start: int, line_end: int, snippet: str) -> dict:
    snippet_hash = hashlib.sha256(snippet.encode("utf-8", errors="ignore")).hexdigest()[:12]
    display = f"{path}:{line_start}" if line_start == line_end else f"{path}:{line_start}-{line_end}"
    return Evidence(
        path=path,
        line_start=line_start,
        line_end=line_end,
        snippet_hash=snippet_hash,
        display=display,
    ).to_dict()


def make_evidence_from_line(path: str, line_num: int, line_text: str) -> dict:
    return make_evidence(path, line_num, line_num, line_text.strip())
