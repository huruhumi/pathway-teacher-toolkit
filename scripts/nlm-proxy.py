"""
Local NotebookLM deep research proxy.

Runs on http://localhost:3199

Actions:
  - full-pipeline: create notebook -> deep research -> import -> query
  - video-url-only: create notebook -> import ONLY input video URLs -> extract transcript evidence
  - resume: reuse existing notebook and query
"""

from __future__ import annotations

import asyncio
import json
import re
import sys
import traceback
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

from notebooklm.client import NotebookLMClient

PORT = 3199
BATCH_SIZE = 5
CLIENT_TIMEOUT = 120
MAX_EXCERPT_CHARS = 1800


class PipelineError(Exception):
    """Error with notebook_id context for resume."""

    def __init__(self, message: str, notebook_id: str = ""):
        super().__init__(message)
        self.notebook_id = notebook_id


async def import_sources_batched(client: NotebookLMClient, notebook_id: str, task_id: str, sources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    imported: list[dict[str, Any]] = []
    for i in range(0, len(sources), BATCH_SIZE):
        batch = sources[i : i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        print(f"[NLM] importing batch {batch_num} ({len(batch)} sources)")

        success = False
        for attempt in range(3):
            try:
                result = await client.research.import_sources(
                    notebook_id=notebook_id,
                    task_id=task_id,
                    sources=batch,
                )
                imported.extend(result)
                success = True
                break
            except Exception as exc:
                wait = (attempt + 1) * 5
                print(f"[NLM] warning: batch {batch_num} attempt {attempt + 1} failed: {exc}; retry in {wait}s")
                await asyncio.sleep(wait)

        if not success:
            print(f"[NLM] fallback: importing batch {batch_num} one-by-one")
            for source in batch:
                try:
                    result = await client.research.import_sources(
                        notebook_id=notebook_id,
                        task_id=task_id,
                        sources=[source],
                    )
                    imported.extend(result)
                except Exception as exc:
                    print(f"[NLM] warning: single source import failed: {exc}")
                await asyncio.sleep(2)

        await asyncio.sleep(2)
    return imported


async def query_fact_sheets(
    client: NotebookLMClient,
    notebook_id: str,
    lesson_prompts: list[str],
    source_refs: list[str] | None = None,
) -> list[dict[str, Any]]:
    fact_sheets: list[dict[str, Any]] = []
    refs = source_refs or []
    for i, prompt in enumerate(lesson_prompts):
        print(f"[NLM] query {i + 1}/{len(lesson_prompts)}")
        await asyncio.sleep(2)

        try:
            response = await client.chat.ask(notebook_id=notebook_id, question=prompt)
            content = str(getattr(response, "text", getattr(response, "response", response)))
        except Exception as exc:
            print(f"[NLM] warning: query {i + 1} failed: {exc}")
            content = f"Query failed: {exc}"

        citations = set(re.findall(r"\[\d+\]", content))
        count = len(citations)
        quality = "good" if count >= 5 else ("low" if count >= 2 else "insufficient")

        fact_sheets.append(
            {
                "content": content[:20000],
                "citationCount": count,
                "quality": quality,
                "sourceRefs": refs[:50],
                "groundingUrls": [],
            }
        )
    return fact_sheets


async def list_notebook_sources(
    client: NotebookLMClient,
    notebook_id: str,
) -> list[dict[str, Any]]:
    try:
        listed = await client.sources.list(notebook_id)
    except Exception as exc:
        print(f"[NLM] warning: failed to list notebook sources: {exc}")
        return []

    sources: list[dict[str, Any]] = []
    for src in listed:
        title = getattr(src, "title", "") or ""
        url = getattr(src, "url", "") or ""
        status = str(getattr(src, "status", "") or "")
        source_id = getattr(src, "id", "") or ""
        source_type = str(getattr(src, "type", "") or "")
        sources.append(
            {
                "id": source_id,
                "title": title,
                "url": url,
                "status": status,
                "type": source_type,
            }
        )
    return sources


def _normalize_text_excerpt(content: str, limit: int = MAX_EXCERPT_CHARS) -> str:
    compact = re.sub(r"\s+", " ", content or "").strip()
    if len(compact) <= limit:
        return compact
    return f"{compact[:limit]}..."


def _extract_youtube_video_id(raw_url: str) -> str | None:
    try:
        parsed = urlparse(raw_url)
    except Exception:
        return None

    host = (parsed.netloc or "").replace("www.", "").lower()
    if host == "youtu.be":
        candidate = parsed.path.strip("/")
        return candidate or None
    if host == "youtube.com" or host.endswith(".youtube.com"):
        values = parse_qs(parsed.query).get("v", [])
        if values:
            return values[0].strip() or None
    return None


def _url_from_input_videos(candidate_url: str, input_urls: list[str]) -> bool:
    input_ids = {vid for vid in (_extract_youtube_video_id(u) for u in input_urls) if vid}
    candidate_id = _extract_youtube_video_id(candidate_url)
    if candidate_id and candidate_id in input_ids:
        return True
    return candidate_url in input_urls


async def video_url_only_pipeline(
    topic: str,
    lesson_prompts: list[str],
    video_urls: list[str],
) -> dict[str, Any]:
    notebook_id = ""
    async with await NotebookLMClient.from_storage(timeout=CLIENT_TIMEOUT) as client:
        try:
            print(f"[NLM][video] creating notebook: {topic}")
            notebook = await client.notebooks.create(title=f"Video URL Evidence: {topic}")
            notebook_id = notebook.id
            print(f"[NLM][video] notebook id: {notebook_id}")

            processed_rows: list[dict[str, Any]] = []
            imported_sources: list[dict[str, Any]] = []

            for raw_url in video_urls:
                print(f"[NLM][video] importing URL: {raw_url}")
                row: dict[str, Any] = {
                    "inputUrl": raw_url,
                    "status": "VIDEO_SOURCE_UNAVAILABLE",
                    "reason": "unknown",
                    "sourceId": "",
                    "sourceTitle": "",
                    "sourceUrl": raw_url,
                    "charCount": 0,
                    "excerpt": "",
                }
                try:
                    source = await client.sources.add_url(
                        notebook_id=notebook_id,
                        url=raw_url,
                        wait=True,
                        wait_timeout=180,
                    )
                    source_id = str(getattr(source, "id", "") or "")
                    source_title = str(getattr(source, "title", "") or "")
                    source_url = str(getattr(source, "url", "") or raw_url)

                    if source_url and not _url_from_input_videos(source_url, video_urls):
                        row.update(
                            {
                                "reason": f"non_input_source_url:{source_url}",
                                "sourceId": source_id,
                                "sourceTitle": source_title,
                                "sourceUrl": source_url,
                            }
                        )
                        processed_rows.append(row)
                        print(f"[NLM][video] rejected non-input source url for {raw_url}: {source_url}")
                        continue

                    fulltext = await client.sources.get_fulltext(notebook_id, source_id)
                    content = str(getattr(fulltext, "content", "") or "")
                    char_count = int(getattr(fulltext, "char_count", len(content)) or len(content))

                    if content.strip():
                        row.update(
                            {
                                "status": "READY",
                                "reason": "",
                                "sourceId": source_id,
                                "sourceTitle": source_title,
                                "sourceUrl": source_url,
                                "charCount": char_count,
                                "excerpt": _normalize_text_excerpt(content, MAX_EXCERPT_CHARS),
                            }
                        )
                    else:
                        row.update(
                            {
                                "reason": "empty_fulltext",
                                "sourceId": source_id,
                                "sourceTitle": source_title,
                                "sourceUrl": source_url,
                            }
                        )
                except Exception as exc:
                    row["reason"] = str(exc)
                    print(f"[NLM][video] import/get_fulltext failed for {raw_url}: {exc}")

                processed_rows.append(row)
                if row.get("status") == "READY":
                    imported_sources.append(
                        {
                            "id": row.get("sourceId", ""),
                            "title": row.get("sourceTitle", ""),
                            "url": row.get("sourceUrl", raw_url),
                            "status": "ready",
                            "type": "youtube",
                        }
                    )

            has_unavailable = any(r.get("status") != "READY" for r in processed_rows)
            ready_count = sum(1 for r in processed_rows if r.get("status") == "READY")

            lines: list[str] = []
            lines.append("VIDEO_URL_ONLY_MODE=TRUE")
            lines.append("Source policy: ONLY user-provided video URLs were imported via NotebookLM sources.add_url.")
            lines.append("")
            lines.append("Input URL verification:")
            for row in processed_rows:
                if row.get("status") == "READY":
                    lines.append(
                        f"- READY | input={row.get('inputUrl')} | source={row.get('sourceUrl')} | char_count={row.get('charCount')}"
                    )
                else:
                    lines.append(
                        f"- VIDEO_SOURCE_UNAVAILABLE | input={row.get('inputUrl')} | reason={row.get('reason')}"
                    )
            if has_unavailable:
                lines.append("")
                lines.append("VIDEO_SOURCE_UNAVAILABLE")

            lines.append("")
            lines.append("Transcript/key evidence excerpts (verbatim from NotebookLM indexed fulltext):")
            for idx, row in enumerate(processed_rows, start=1):
                if row.get("status") != "READY":
                    continue
                lines.append("")
                lines.append(f"[Source {idx}] {row.get('sourceTitle') or 'Untitled'}")
                lines.append(f"URL: {row.get('sourceUrl') or row.get('inputUrl')}")
                lines.append(f"char_count: {row.get('charCount')}")
                lines.append("excerpt:")
                lines.append(row.get("excerpt") or "")

            if ready_count == 0:
                lines.append("")
                lines.append("NO_USABLE_SOURCE")

            fact_content = "\n".join(lines)[:20000]
            quality = "good" if ready_count == len(video_urls) and ready_count > 0 else ("low" if ready_count > 0 else "insufficient")
            citation_count = ready_count
            source_refs = [s.get("url", "") for s in imported_sources if s.get("url")]
            fact_sheets = [
                {
                    "content": fact_content,
                    "citationCount": citation_count,
                    "quality": quality,
                    "sourceRefs": source_refs[:50],
                    "groundingUrls": source_refs[:50],
                }
                for _ in lesson_prompts
            ]
            if not fact_sheets:
                fact_sheets = [
                    {
                        "content": fact_content,
                        "citationCount": citation_count,
                        "quality": quality,
                        "sourceRefs": source_refs[:50],
                        "groundingUrls": source_refs[:50],
                    }
                ]
            print(f"[NLM][video] done: {len(fact_sheets)} fact sheets, ready={ready_count}/{len(video_urls)}")
            return {"notebookId": notebook_id, "factSheets": fact_sheets, "sources": imported_sources}
        except Exception as exc:
            raise PipelineError(str(exc), notebook_id) from exc


async def full_pipeline(topic: str, lesson_prompts: list[str]) -> dict[str, Any]:
    notebook_id = ""
    async with await NotebookLMClient.from_storage(timeout=CLIENT_TIMEOUT) as client:
        try:
            print(f"[NLM] creating notebook: {topic}")
            notebook = await client.notebooks.create(title=f"RAG: {topic}")
            notebook_id = notebook.id
            print(f"[NLM] notebook id: {notebook_id}")

            print("[NLM] starting deep research")
            task = await client.research.start(
                notebook_id=notebook_id,
                query=topic,
                source="web",
                mode="deep",
            )
            task_id = task["task_id"] if isinstance(task, dict) else str(task)
            print(f"[NLM] research task id: {task_id}")

            print("[NLM] polling deep research status")
            poll_result = None
            for attempt in range(40):
                await asyncio.sleep(15)
                poll_result = await client.research.poll(notebook_id)
                status = poll_result.get("status", "unknown")
                print(f"[NLM] poll {attempt + 1}: {status}")
                if status == "completed":
                    break
                if status == "no_research":
                    raise RuntimeError("Research task not found")
            else:
                raise RuntimeError("Research timed out")

            poll_sources = poll_result.get("sources", [])
            poll_task_id = poll_result.get("task_id", task_id)
            imported = await import_sources_batched(client, notebook_id, poll_task_id, poll_sources)
            print(f"[NLM] imported sources: {len(imported)}")

            source_list = await list_notebook_sources(client, notebook_id)
            source_refs = [s.get("title", "") for s in source_list if s.get("title")]
            fact_sheets = await query_fact_sheets(client, notebook_id, lesson_prompts, source_refs)
        except Exception as exc:
            raise PipelineError(str(exc), notebook_id) from exc

        if not source_list:
            source_list = [{"title": s.get("title", ""), "url": s.get("url", "")} for s in poll_sources]
        print(f"[NLM] done: {len(fact_sheets)} fact sheets, {len(source_list)} sources")
        return {"notebookId": notebook_id, "factSheets": fact_sheets, "sources": source_list}


async def resume_pipeline(notebook_id: str, lesson_prompts: list[str]) -> dict[str, Any]:
    async with await NotebookLMClient.from_storage(timeout=CLIENT_TIMEOUT) as client:
        print(f"[NLM] resuming notebook: {notebook_id}")

        poll_result = await client.research.poll(notebook_id)
        status = poll_result.get("status", "unknown")
        print(f"[NLM] research status: {status}")

        source_list: list[dict[str, Any]] = []
        if status == "completed":
            poll_sources = poll_result.get("sources", [])
            poll_task_id = poll_result.get("task_id", "")
            source_list = [{"title": s.get("title", ""), "url": s.get("url", "")} for s in poll_sources]
            if poll_sources and poll_task_id:
                print(f"[NLM] importing {len(poll_sources)} sources")
                await import_sources_batched(client, notebook_id, poll_task_id, poll_sources)
                print("[NLM] source import done")

        source_list = await list_notebook_sources(client, notebook_id)
        source_refs = [s.get("title", "") for s in source_list if s.get("title")]
        fact_sheets = await query_fact_sheets(client, notebook_id, lesson_prompts, source_refs)
        print(f"[NLM] done: {len(fact_sheets)} fact sheets")
        return {"notebookId": notebook_id, "factSheets": fact_sheets, "sources": source_list}


async def list_notebooks() -> list[dict[str, str]]:
    async with await NotebookLMClient.from_storage(timeout=CLIENT_TIMEOUT) as client:
        notebooks = await client.notebooks.list()
        return [{"id": nb.id, "title": getattr(nb, "title", str(nb))} for nb in notebooks[:10]]


class ProxyHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        try:
            notebooks = asyncio.run(list_notebooks())
            self._json(200, {"notebooks": notebooks})
        except Exception as exc:
            self._json(500, {"error": str(exc)})

    def do_POST(self) -> None:
        body = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode()
        notebook_id_ctx: str | None = None
        try:
            data = json.loads(body)
            action = data.get("action")
            prompts = data.get("lessonPrompts", [])

            if action == "full-pipeline":
                topic = data.get("topic", "")
                if not topic or not prompts:
                    raise ValueError("Missing topic or lessonPrompts")
                result = asyncio.run(full_pipeline(topic, prompts))
                notebook_id_ctx = result.get("notebookId")
            elif action == "video-url-only":
                topic = data.get("topic", "")
                video_urls = data.get("videoUrls", [])
                if not topic or not prompts:
                    raise ValueError("Missing topic or lessonPrompts")
                if not isinstance(video_urls, list) or not video_urls:
                    raise ValueError("Missing videoUrls")
                result = asyncio.run(video_url_only_pipeline(topic, prompts, video_urls))
                notebook_id_ctx = result.get("notebookId")
            elif action in ("resume", "notebook-query"):
                notebook_id_ctx = data.get("notebookId", "")
                if not notebook_id_ctx or not prompts:
                    raise ValueError("Missing notebookId or lessonPrompts")
                result = asyncio.run(resume_pipeline(notebook_id_ctx, prompts))
            elif action == "ensure-resource-guide":
                notebook_id_ctx = data.get("notebookId", "")
                if not notebook_id_ctx:
                    raise ValueError("Missing notebookId")
                result = asyncio.run(
                    _ensure_resource_guide(notebook_id_ctx, data.get("userInput"))
                )
            elif action == "read-resource-guide":
                notebook_id_ctx = data.get("notebookId", "")
                if not notebook_id_ctx:
                    raise ValueError("Missing notebookId")
                result = asyncio.run(_read_resource_guide(notebook_id_ctx))
            else:
                raise ValueError(f"Unknown action: {action}")

            self._json(200, result)
        except PipelineError as exc:
            print(f"[ERROR] {exc}")
            traceback.print_exc()
            self._json(500, {"error": str(exc), "notebookId": exc.notebook_id})
        except Exception as exc:
            print(f"[ERROR] {exc}")
            traceback.print_exc()
            data = {"error": str(exc)}
            if notebook_id_ctx:
                data["notebookId"] = notebook_id_ctx
            self._json(500, data)

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "content-type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def _json(self, status: int, data: dict[str, Any]) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())

    def log_message(self, *_args: Any) -> None:
        pass


GUIDE_TITLE = "\U0001f4da Resource Guide"
GUIDE_TITLE_ALT = "Resource Guide"


async def _read_resource_guide(notebook_id: str) -> dict[str, Any]:
    """Read the full text content of the Resource Guide source."""
    async with await NotebookLMClient.from_storage(timeout=CLIENT_TIMEOUT) as client:
        sources = await list_notebook_sources(client, notebook_id)
        guide_src = None
        for s in sources:
            title = s.get("title", "")
            if GUIDE_TITLE in title or GUIDE_TITLE_ALT in title:
                guide_src = s
                break
        if not guide_src:
            return {"status": "not_found", "content": None}

        source_id = guide_src["id"]
        print(f"[guide] Reading Resource Guide content: {source_id}")
        try:
            result = await client.sources.get_content(source_id)
            content = getattr(result, "content", None) or str(result)
            print(f"[guide] Read {len(content)} chars")
            return {"status": "ok", "content": content, "sourceId": source_id}
        except Exception as exc:
            print(f"[guide] Failed to read content: {exc}")
            return {"status": "error", "error": str(exc)}


async def _ensure_resource_guide(
    notebook_id: str, user_input: dict[str, Any] | None = None
) -> dict[str, Any]:
    """Check if resource guide exists; generate if missing."""
    import subprocess, os
    from pathlib import Path

    script = str(Path(__file__).parent / "nlm-resource-guide.py")
    env = {**os.environ, "PYTHONIOENCODING": "utf-8"}

    # Step 1: check
    print(f"[guide] Checking resource guide for {notebook_id}...")
    check = subprocess.run(
        [sys.executable, script, "check", notebook_id],
        capture_output=True, text=True, env=env, timeout=60,
    )
    if check.returncode != 0:
        return {"status": "error", "error": f"Check failed: {check.stderr.strip()}"}
    check_result = json.loads(check.stdout.strip())
    if check_result.get("exists"):
        print(f"[guide] Guide already exists: {check_result.get('sourceId')}")
        return {"status": "exists", "sourceId": check_result.get("sourceId")}

    # Step 2: generate
    print(f"[guide] Generating guide for {check_result.get('sourcesCount', '?')} sources...")
    cmd = [sys.executable, script, "generate", notebook_id]
    if user_input:
        cmd += ["--user-input", json.dumps(user_input)]
    gen = subprocess.run(
        cmd, capture_output=True, text=True, env=env, timeout=300,
    )
    if gen.returncode != 0:
        return {"status": "error", "error": f"Generate failed: {gen.stderr.strip()[-500:]}"}
    gen_result = json.loads(gen.stdout.strip())
    print(f"[guide] Guide created: {gen_result.get('sourceId')}")
    return gen_result


async def check_auth() -> bool:
    async with await NotebookLMClient.from_storage(timeout=CLIENT_TIMEOUT):
        return True


def main() -> None:
    try:
        asyncio.run(check_auth())
        print("Auth: OK")
    except Exception as exc:
        print(f"Auth: FAIL - {exc}")
        print("Run: notebooklm login")
        sys.exit(1)

    print("")
    print("NotebookLM Deep Research Proxy")
    print(f"http://localhost:{PORT}")
    print("GET  /    - list notebooks")
    print("POST full-pipeline - create + research + query")
    print("POST video-url-only - import ONLY input video URLs + extract transcript evidence")
    print("POST resume        - reuse existing notebook")
    print("")

    HTTPServer(("", PORT), ProxyHandler).serve_forever()


if __name__ == "__main__":
    main()
