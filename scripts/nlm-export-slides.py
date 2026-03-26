#!/usr/bin/env python3
"""
NotebookLM Slide Export Worker

Called by nlm-proxy.mjs to orchestrate the full slide deck export pipeline.
Uses notebooklm-py's async client for reliable API access with existing cookie auth.

Usage:
  python scripts/nlm-export-slides.py --input <json_file> --output <json_file>

Input JSON:
  { title, handbookPages, stylePrompt, factSheet?, structurePlan?, language }

Progress is written to the output file as JSON. The proxy polls this file.
"""

import asyncio
import json
import sys
import time
import argparse
import re
from pathlib import Path


def emit(output_path, data):
    """Write progress to output file (proxy polls this)"""
    Path(output_path).write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')


def split_text(text, max_len=50000):
    """Split text at sentence boundaries if too long."""
    if len(text) <= max_len:
        return [text]
    chunks = []
    while text:
        if len(text) <= max_len:
            chunks.append(text)
            break
        cut = max_len
        for sep in ['\n\n', '。', '. ', '\n']:
            idx = text.rfind(sep, 0, max_len)
            if idx > max_len // 2:
                cut = idx + len(sep)
                break
        chunks.append(text[:cut])
        text = text[cut:]
    return chunks


def sanitize_fact_sheet_for_slides(fact_sheet_text):
    """Remove freshness-risk metadata from fact sheet before NotebookLM ingestion."""
    if not isinstance(fact_sheet_text, str):
        return ''

    cleaned = fact_sheet_text
    cleaned = re.sub(r'##\s*FRESHNESS AUDIT[\s\S]*?(?=\n##\s*SOURCES|\n##\s*PART|\Z)', '\n', cleaned, flags=re.IGNORECASE)

    line_patterns = [
        r'^\s*⚠\s*Freshness Risk:.*$',
        r'^\s*⚠\s*时效风险提示：.*$',
        r'^\s*\[Freshness Risk\]\s*$',
        r'^\s*\[Freshness Audit\]\s*$',
        r'^\s*Theme Freshness Tier:.*$',
        r'^\s*Target Window:.*$',
        r'^\s*Effective Window:.*$',
        r'^\s*Risk Level:.*$',
        r'^\s*Coverage:.*$',
        r'^\s*-\s*Theme tier:.*$',
        r'^\s*-\s*Target window:.*$',
        r'^\s*-\s*Effective window:.*$',
        r'^\s*-\s*Risk level:.*$',
        r'^\s*-\s*Coverage:.*$',
    ]
    for pattern in line_patterns:
        cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE | re.MULTILINE)

    cleaned = re.sub(r'Some evidence is older than one year; please verify with up-to-date authoritative sources\.', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'部分信息可能不是近一年证据，请教师/家长结合最新权威信息复核。?', '', cleaned)
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned).strip()
    return cleaned


def format_chunk(pages, start_idx, style_prompt):
    """Format a chunk of handbook pages into rich source text."""
    lines = [f"=== GLOBAL STYLE PROMPT ===\n{style_prompt}\n"]
    lines.append(f"=== HANDBOOK PAGES {start_idx + 1}-{start_idx + len(pages)} ===\n")

    for i, page in enumerate(pages):
        n = start_idx + i + 1
        title = page.get('title', f'Page {n}')
        section = page.get('section', '')
        page_type = page.get('pageType', 'Content')
        content = page.get('contentPrompt', '')
        teacher_content = page.get('teacherContentPrompt', '')
        visual = page.get('visualPrompt', '')
        layout = page.get('layoutDescription', '')

        lines.append(f"--- Page {n}: {title} ---")
        if section:
            lines.append(f"Section: {section}")
        lines.append(f"Page Type: {page_type}")
        lines.append(f"\n📖 Content:\n{content}")
        if teacher_content:
            lines.append(f"\n👩‍🏫 Teacher Guide:\n{teacher_content}")
        if visual:
            lines.append(f"\n🎨 Visual Design:\n{visual}")
        if layout:
            lines.append(f"\n📐 Layout:\n{layout}")
        lines.append("")

    return '\n'.join(lines)




def build_focus_prompt(style_prompt, chunk_idx, total_chunks, version='teacher'):
    """Build the instructions for slide deck generation.

    version: 'teacher' | 'student' | 'parent' | 'child'
    """
    # Audience-specific instructions
    audience_prompts = {
        'teacher': (
            "TEACHER VERSION: Preserve ALL details from every page. "
            "Include teaching tips, background knowledge, assessment rubrics, "
            "time allocation, differentiation strategies, learning objectives, "
            "preparation notes, activity steps, vocabulary, safety rules, and quiz questions. "
            "Do NOT summarize or omit any information. "
            "Each page should become at least 1-2 detailed slides."
        ),
        'student': (
            "STUDENT VERSION: Include ONLY student-facing content. "
            "Focus on: activity instructions, worksheets, vocabulary cards, fun facts, "
            "quizzes, reflection prompts, and hands-on steps. "
            "EXCLUDE: teaching tips, teacher background info, assessment rubrics, "
            "time allocation, differentiation strategies, and preparation notes. "
            "Use simple, engaging language appropriate for the student age group. "
            "Each page should become 1 clear, visually appealing slide."
        ),
        'parent': (
            "PARENT GUIDE VERSION: Preserve ALL details from every page. "
            "Include activity overview, safety guidelines, learning objectives, "
            "facilitation tips, preparation checklist, discussion prompts, "
            "and background knowledge. "
            "Use warm, encouraging language for parents guiding their children. "
            "Each page should become at least 1-2 detailed slides."
        ),
        'child': (
            "CHILD VERSION: Include ONLY fun, child-friendly content. "
            "Focus on: activity steps, games, fun facts, vocabulary with pictures, "
            "exploration prompts, and sticker/reward sections. "
            "EXCLUDE: parent guidance, safety details for adults, prep checklists, "
            "and background knowledge sections. "
            "Use playful, simple language. Emphasize visuals and large text. "
            "Each page should become 1 colorful, engaging slide."
        ),
    }

    base = audience_prompts.get(version, audience_prompts['teacher'])

    if total_chunks == 1:
        return f"{base} {style_prompt}"
    elif chunk_idx == 0:
        return (f"{base} {style_prompt}. This is Part 1 of {total_chunks}. "
                "Include a title/cover slide at the beginning. "
                "Do NOT include an ending slide or back cover — the presentation continues in the next part.")
    elif chunk_idx == total_chunks - 1:
        return (f"{base} {style_prompt}. This is Part {chunk_idx + 1} of {total_chunks} (final). "
                f"Do NOT include a title/cover slide — this is a continuation from Part {chunk_idx}. "
                "Include an ending/back cover slide.")
    else:
        return (f"{base} {style_prompt}. This is Part {chunk_idx + 1} of {total_chunks}. "
                "Do NOT include a title/cover slide or ending slide — this is a continuation. "
                "Start directly with the content.")


# Override prompt-format helpers with freshness-risk support (keep latest definition).
def build_high_risk_footer(language, fact_sheet_meta):
    if not isinstance(fact_sheet_meta, dict):
        return None
    if str(fact_sheet_meta.get('riskLevel', '')).upper() != 'HIGH':
        return None

    target = fact_sheet_meta.get('targetWindow', '1y')
    effective = fact_sheet_meta.get('effectiveWindow', '5y')
    tier = fact_sheet_meta.get('themeTier', 'MEDIUM')
    coverage = fact_sheet_meta.get('coverage')
    coverage_text = f"{round(float(coverage) * 100)}%" if isinstance(coverage, (int, float)) else "N/A"

    if language == 'zh':
        return (
            f"⚠ 时效风险提示：主题分层={tier}；目标窗口={target}；实际窗口={effective}；覆盖率={coverage_text}。"
            "部分信息可能不是近一年证据，请教师/家长结合最新权威信息复核。"
        )
    return (
        f"⚠ Freshness Risk: tier={tier}; target window={target}; effective window={effective}; coverage={coverage_text}. "
        "Some evidence is older than one year; please verify with up-to-date authoritative sources."
    )


def format_chunk(pages, start_idx, style_prompt, mandatory_footer_label=None):
    lines = [f"=== GLOBAL STYLE PROMPT ===\n{style_prompt}\n"]
    lines.append(f"=== HANDBOOK PAGES {start_idx + 1}-{start_idx + len(pages)} ===\n")
    if mandatory_footer_label:
        lines.append("=== MANDATORY FOOTER LABEL (EVERY SLIDE) ===")
        lines.append(mandatory_footer_label)
        lines.append("")

    for i, page in enumerate(pages):
        n = start_idx + i + 1
        title = page.get('title', f'Page {n}')
        section = page.get('section', '')
        page_type = page.get('pageType', 'Content')
        content = page.get('contentPrompt', '')
        teacher_content = page.get('teacherContentPrompt', '')
        visual = page.get('visualPrompt', '')
        layout = page.get('layoutDescription', '')

        lines.append(f"--- Page {n}: {title} ---")
        if section:
            lines.append(f"Section: {section}")
        lines.append(f"Page Type: {page_type}")
        lines.append(f"\nStudent Content:\n{content}")
        if teacher_content:
            lines.append(f"\nTeacher/Parent Guide:\n{teacher_content}")
        if visual:
            lines.append(f"\nVisual Design:\n{visual}")
        if layout:
            lines.append(f"\nLayout:\n{layout}")
        lines.append("")

    return '\n'.join(lines)


def build_focus_prompt(style_prompt, chunk_idx, total_chunks, version='teacher', mandatory_footer_instruction=''):
    audience_prompts = {
        'teacher': (
            "TEACHER VERSION: Preserve ALL details from every page. "
            "Include teaching tips, background knowledge, assessment rubrics, "
            "time allocation, differentiation strategies, learning objectives, "
            "preparation notes, activity steps, vocabulary, safety rules, and quiz questions. "
            "Do NOT summarize or omit any information. "
            "Each page should become at least 1-2 detailed slides."
        ),
        'student': (
            "STUDENT VERSION: Include ONLY student-facing content. "
            "Focus on activity instructions, worksheets, vocabulary cards, fun facts, quizzes, reflection prompts, and hands-on steps. "
            "Exclude teaching tips, teacher background info, assessment rubrics, time allocation, differentiation strategies, and preparation notes. "
            "Use simple, engaging language appropriate for the student age group. "
            "Each page should become 1 clear, visually appealing slide."
        ),
        'parent': (
            "PARENT GUIDE VERSION: Preserve ALL details from every page. "
            "Include activity overview, safety guidelines, learning objectives, facilitation tips, preparation checklist, discussion prompts, and background knowledge. "
            "Use warm, encouraging language for parents guiding their children. "
            "Each page should become at least 1-2 detailed slides."
        ),
        'child': (
            "CHILD VERSION: Include ONLY fun, child-friendly content. "
            "Focus on activity steps, games, fun facts, vocabulary with pictures, exploration prompts, and reward sections. "
            "Exclude parent guidance, prep checklists, and adult-facing safety logistics. "
            "Use playful, simple language. Emphasize visuals and large text. "
            "Each page should become 1 colorful, engaging slide."
        ),
    }

    base = audience_prompts.get(version, audience_prompts['teacher'])
    footer = mandatory_footer_instruction or ''
    if total_chunks == 1:
        return f"{base} {style_prompt}{footer}"
    if chunk_idx == 0:
        return (
            f"{base} {style_prompt}. This is Part 1 of {total_chunks}. "
            "Include a title/cover slide at the beginning. "
            "Do NOT include an ending slide or back cover because the presentation continues in the next part."
            f"{footer}"
        )
    if chunk_idx == total_chunks - 1:
        return (
            f"{base} {style_prompt}. This is Part {chunk_idx + 1} of {total_chunks} (final). "
            f"Do NOT include a title/cover slide because this is a continuation from Part {chunk_idx}. "
            "Include an ending/back cover slide."
            f"{footer}"
        )
    return (
        f"{base} {style_prompt}. This is Part {chunk_idx + 1} of {total_chunks}. "
        "Do NOT include a title/cover slide or ending slide because this is a continuation. "
        f"Start directly with the content.{footer}"
    )


async def retry_async(fn, max_retries=2, backoff=60, label="operation"):
    """Retry an async function with backoff."""
    for attempt in range(max_retries + 1):
        try:
            return await fn()
        except Exception as e:
            if attempt < max_retries:
                print(f"[retry] {label} failed (attempt {attempt + 1}): {e}. Retrying in {backoff}s...", flush=True)
                await asyncio.sleep(backoff)
            else:
                raise


async def run_export(input_data, output_path):
    title = input_data['title']
    handbook_pages = input_data['handbookPages']
    style_prompt = input_data['stylePrompt']
    fact_sheet = input_data.get('factSheet') or ''
    fact_sheet_meta = input_data.get('factSheetMeta') or {}
    structure_plan = input_data.get('structurePlan') or ''
    roadmap_json = input_data.get('roadmapJson') or ''
    language = input_data.get('language', 'en')
    mode = input_data.get('mode', 'school')
    high_risk_footer_instruction = ""
    fact_sheet = sanitize_fact_sheet_for_slides(fact_sheet)

    import math
    roadmap_text = ""
    if roadmap_json:
        try:
            roadmap = json.loads(roadmap_json)
            roadmap_lines = ["=== COURSE ROADMAP ==="]
            for i, step in enumerate(roadmap):
                phase = step.get('phase', '')
                activity = step.get('activity', '')
                timeRange = step.get('timeRange', '')
                desc = step.get('description', '')
                roadmap_lines.append(f"\nPhase {i+1}: {phase} ({timeRange})")
                roadmap_lines.append(f"Activity: {activity}")
                if desc: roadmap_lines.append(f"Description: {desc}")
                # include teaching tips if they exist
                tips = step.get('teachingTips', [])
                if tips:
                    roadmap_lines.append("Teaching Tips:")
                    for tip in tips: roadmap_lines.append(f"- {tip}")
                bg_info = step.get('backgroundInfo', [])
                if bg_info:
                    roadmap_lines.append("Background Info:")
                    for info in bg_info: roadmap_lines.append(f"- {info}")
            roadmap_text = "\n".join(roadmap_lines)
        except Exception as e:
            print(f"Failed to parse roadmapJson: {e}", flush=True)
            roadmap_text = roadmap_json  # Fallback

    # Determine which version(s) to generate based on user preference
    version_pref = input_data.get('versionPref', 'both')
    if mode == 'family':
        all_versions = {'detailed': ['parent'], 'simple': ['child'], 'both': ['parent', 'child']}
        all_labels = {'parent': '家长版', 'child': '儿童版'}
    else:
        all_versions = {'detailed': ['teacher'], 'simple': ['student'], 'both': ['teacher', 'student']}
        all_labels = {'teacher': '教师版', 'student': '学生版'}
    versions = all_versions.get(version_pref, all_versions['both'])
    version_labels = {v: all_labels[v] for v in versions}
    if mode == 'family':
        all_labels = {'parent': 'Parent Guide', 'child': 'Child'}
    else:
        all_labels = {'teacher': 'Teacher', 'student': 'Student'}
    version_labels = {v: all_labels[v] for v in versions}

    from notebooklm.client import NotebookLMClient

    def has_valid_sid_cookie(storage_path: Path) -> bool:
        """Whether storage_state.json contains a usable SID cookie."""
        if not storage_path.exists():
            return False
        try:
            payload = json.loads(storage_path.read_text('utf-8'))
            cookies = payload.get('cookies') or []
            if not isinstance(cookies, list):
                return False
            for c in cookies:
                if not isinstance(c, dict):
                    continue
                if c.get('name') == 'SID' and '.google.com' in str(c.get('domain', '')) and str(c.get('value', '')):
                    return True
        except Exception:
            return False
        return False

    def is_auth_expired_error(err: str) -> bool:
        text = (err or '').lower()
        return (
            'authentication expired' in text
            or 'accounts.google.com' in text
            or 'redirected to:' in text
            or ('invalid' in text and 'auth' in text)
        )

    # --- Robust auth with auto-refresh ---
    async def try_auth_headless_refresh():
        """Use the persistent browser profile to headlessly refresh cookies.
        
        notebooklm login creates ~/.notebooklm/browser_profile/ which keeps
        Google session alive for weeks. We launch headless Chromium with that
        profile, navigate to NLM, and re-save the updated storage state.
        This avoids manual re-login.
        """
        try:
            from playwright.async_api import async_playwright
            profile_dir = Path.home() / ".notebooklm" / "browser_profile"
            storage_path = Path.home() / ".notebooklm" / "storage_state.json"
            
            if not profile_dir.exists():
                print("[auth] No browser_profile found. Run 'notebooklm login' once to create it.", flush=True)
                return False
            
            print("[auth] Attempting headless cookie refresh via persistent browser profile...", flush=True)
            async with async_playwright() as p:
                context = await p.chromium.launch_persistent_context(
                    user_data_dir=str(profile_dir),
                    headless=True,
                    args=[
                        "--disable-blink-features=AutomationControlled",
                        "--password-store=basic",
                    ],
                    ignore_default_args=["--enable-automation"],
                )
                page = context.pages[0] if context.pages else await context.new_page()
                await page.goto("https://notebooklm.google.com/", wait_until="networkidle", timeout=30000)
                
                final_url = page.url
                if "accounts.google.com" in final_url:
                    print(f"[auth] Headless refresh failed: redirected to login page ({final_url})", flush=True)
                    await context.close()
                    return False
                
                # Save refreshed cookies
                await context.storage_state(path=str(storage_path))
                await context.close()
                print("[auth] Cookies refreshed successfully via persistent browser profile!", flush=True)
                return True
        except Exception as e:
            print(f"[auth] Headless refresh error: {e}", flush=True)
            return False

    # Step 1: Auth — try from_storage, auto-refresh if needed
    emit(output_path, {'status': 'authenticating', 'progress': 0.05, 'message': '正在验证 NotebookLM 认证...'})

    # Sync from notebooklm-mcp auth only when local storage session is missing.
    # Do NOT overwrite a valid storage_state on every export.
    auth_file = Path.home() / ".notebooklm-mcp" / "auth.json"
    storage_state_path = Path.home() / ".notebooklm" / "storage_state.json"
    should_sync_from_mcp = not has_valid_sid_cookie(storage_state_path)
    if auth_file.exists() and should_sync_from_mcp:
        try:
            auth_data = json.loads(auth_file.read_text('utf-8'))
            cookies_dict = auth_data.get('cookies', {})
            pw_cookies = []
            import time as time_module
            for name, value in cookies_dict.items():
                pw_cookies.append({
                    "name": name,
                    "value": str(value),
                    "domain": ".google.com",
                    "path": "/",
                    "expires": int(time_module.time()) + 86400 * 30,
                    "httpOnly": "1PSID" in name or "Secure" in name,
                    "secure": True,
                    "sameSite": "None"
                })
            storage_state_path.parent.mkdir(exist_ok=True)
            storage_state_path.write_text(json.dumps({"cookies": pw_cookies}, ensure_ascii=False))
            print("[auth] Synced cookies from notebooklm-mcp", flush=True)
        except Exception as e:
            print(f"[auth] Failed to sync cookies: {e}", flush=True)
    elif auth_file.exists():
        print("[auth] Skip notebooklm-mcp cookie sync (existing storage session looks valid).", flush=True)

    # Try to create client, auto-refresh on auth failure
    max_auth_attempts = 2
    client_ctx = None
    for attempt in range(max_auth_attempts):
        try:
            client_ctx = await NotebookLMClient.from_storage(timeout=240)
            client = await client_ctx.__aenter__()
            await client.notebooks.list()
            print(f"[auth] [OK] Auth valid (attempt {attempt + 1})", flush=True)
            break
        except Exception as e:
            error_str = str(e)
            print(f"[auth] Auth failed (attempt {attempt + 1}): {error_str}", flush=True)
            if client_ctx:
                try:
                    await client_ctx.__aexit__(None, None, None)
                except:
                    pass
                client_ctx = None
            
            friendly_error = (
                'NotebookLM authentication expired. Run "notebooklm login" and retry export.'
                if is_auth_expired_error(error_str)
                else error_str
            )
            if attempt < max_auth_attempts - 1:
                emit(output_path, {
                    'status': 'authenticating',
                    'progress': 0.05,
                    'message': 'Authentication expired, trying auto-refresh...'
                })
                refreshed = await try_auth_headless_refresh()
                if not refreshed:
                    emit(output_path, {
                        'status': 'error',
                        'progress': 0,
                        'message': 'NotebookLM auth expired and auto-refresh failed. Run "notebooklm login" and retry export.',
                        'error': friendly_error,
                    })
                    return
                continue
            else:
                emit(output_path, {
                    'status': 'error',
                    'progress': 0,
                    'message': 'NotebookLM authentication failed. Run "notebooklm login" and retry export.',
                    'error': friendly_error,
                })
                return

            if attempt < max_auth_attempts - 1:
                emit(output_path, {'status': 'authenticating', 'progress': 0.05, 'message': '认证过期，正在自动刷新...'})
                refreshed = await try_auth_headless_refresh()
                if not refreshed:
                    emit(output_path, {
                        'status': 'error', 'progress': 0,
                        'message': f'NotebookLM 认证过期且自动刷新失败。请在终端运行 "notebooklm login" 重新登录。',
                        'error': error_str
                    })
                    return
            else:
                emit(output_path, {
                    'status': 'error', 'progress': 0,
                    'message': f'NotebookLM 认证失败。请运行 "notebooklm login" 重新登录。\n错误: {error_str}',
                    'error': error_str
                })
                return

    if not client_ctx:
        emit(output_path, {'status': 'error', 'progress': 0, 'message': 'NotebookLM 认证失败', 'error': 'Auth failed after all attempts'})
        return

    try:  # client is already entered via __aenter__ in the loop above

        # Step 2: Create notebook
        emit(output_path, {'status': 'creating_notebook', 'progress': 0.1, 'message': f'创建笔记本: {title}'})
        nb = await retry_async(
            lambda: client.notebooks.create(title=f"{title} — Handbook Slides"),
            label="create notebook"
        )
        notebook_id = nb.id
        notebook_url = f"https://notebooklm.google.com/notebook/{notebook_id}"
        print(f"[notebook] Created: {notebook_id}", flush=True)

        emit(output_path, {
            'status': 'uploading_sources', 'progress': 0.15,
            'message': '笔记本已创建，准备上传...',
            'notebookId': notebook_id, 'notebookUrl': notebook_url
        })

        # New chunking logic: max 15 per chunk, fewest chunks
        max_chunk = 15
        total_pages = len(handbook_pages)
        num_chunks = math.ceil(total_pages / max_chunk) if total_pages > 0 else 0
        if num_chunks > 0:
            base_size = total_pages // num_chunks
            remainder = total_pages % num_chunks
            chunk_sizes = [base_size + 1 if i < remainder else base_size for i in range(num_chunks)]
        else:
            chunk_sizes = []

        has_fact_sheet = bool(fact_sheet and fact_sheet.strip())
        total_uploads = (1 if has_fact_sheet else 0) + (1 if structure_plan else 0) + (1 if roadmap_text else 0) + num_chunks
        uploaded = 0

        shared_source_ids = []   # fact sheet + structure plan (shared across all decks)
        roadmap_source_id = None
        handbook_source_ids = []  # one per chunk

        # Step 3a: Upload fact sheet as single merged source
        if has_fact_sheet:
            fs_title = f"知识底稿 / Fact Sheet: {title}"
            pct = 0.15 + 0.3 * (uploaded / total_uploads)
            emit(output_path, {
                'status': 'uploading_sources', 'progress': pct,
                'message': '上传合并知识底稿...',
                'notebookId': notebook_id, 'notebookUrl': notebook_url
            })
            src = await retry_async(
                lambda: client.sources.add_text(notebook_id, fs_title, fact_sheet),
                label="fact sheet (merged)"
            )
            shared_source_ids.append(src.id)
            uploaded += 1
            await asyncio.sleep(3)

        # Step 3b: Upload structure plan
        if structure_plan:
            pct = 0.15 + 0.3 * (uploaded / total_uploads)
            emit(output_path, {
                'status': 'uploading_sources', 'progress': pct,
                'message': '上传手册结构规划...',
                'notebookId': notebook_id, 'notebookUrl': notebook_url
            })
            src = await retry_async(
                lambda: client.sources.add_text(notebook_id, "Handbook Structure Plan", structure_plan),
                label="structure plan"
            )
            shared_source_ids.append(src.id)
            uploaded += 1
            await asyncio.sleep(3)

        # Step 3b-2: Upload roadmap
        if roadmap_text:
            pct = 0.15 + 0.3 * (uploaded / total_uploads)
            emit(output_path, {
                'status': 'uploading_sources', 'progress': pct,
                'message': '上传教学路线图...',
                'notebookId': notebook_id, 'notebookUrl': notebook_url
            })
            src = await retry_async(
                lambda: client.sources.add_text(notebook_id, "Teaching Roadmap", roadmap_text),
                label="roadmap"
            )
            roadmap_source_id = src.id
            uploaded += 1
            await asyncio.sleep(3)

        # Step 3c: Upload handbook chunks
        chunk_start_idx = 0
        for ci in range(num_chunks):
            count = chunk_sizes[ci]
            end = chunk_start_idx + count
            chunk_pages = handbook_pages[chunk_start_idx:end]
            chunk_text = format_chunk(
                chunk_pages,
                chunk_start_idx,
                style_prompt,
            )
            chunk_title = f"Handbook Pages {chunk_start_idx + 1}-{end}"

            pct = 0.15 + 0.3 * (uploaded / total_uploads)
            emit(output_path, {
                'status': 'uploading_sources', 'progress': pct,
                'message': f'上传 {chunk_title}...',
                'notebookId': notebook_id, 'notebookUrl': notebook_url
            })

            src = await retry_async(
                lambda ct=chunk_text, ctitle=chunk_title: client.sources.add_text(notebook_id, ctitle, ct),
                label=chunk_title
            )
            handbook_source_ids.append(src.id)
            uploaded += 1
            chunk_start_idx = end
            await asyncio.sleep(3)

        # Step 4: Generate slide decks
        slide_decks = []
        student_versions = [v for v in versions if v in ['student', 'child']]
        teacher_versions = [v for v in versions if v in ['teacher', 'parent']]
        
        total_decks = (num_chunks * len(student_versions)) + len(teacher_versions)
        deck_idx = 0

        # 4a. Teacher versions (one deck total per version, using roadmap)
        for version in teacher_versions:
            vlabel = version_labels[version]
            focus = f"TEACHER VERSION: Based on the Teaching Roadmap, Fact Sheet, and Handbook pages (especially the \ud83d\udc69\u200d\ud83c\udfeb Teacher Guide sections which contain teaching scripts, guided questions, differentiation tips, and time controls), generate a comprehensive lesson guide presentation. Each handbook page's Teacher Guide should become its own dedicated slide(s). Include background knowledge, teaching tips, time allocation, safety rules. Do NOT mention page numbers of a student handbook. Do NOT summarize or omit any information. Make it detailed. {style_prompt}{high_risk_footer_instruction}"
            if version == 'parent':
                 focus = f"PARENT GUIDE: Based on the Teaching Roadmap, Fact Sheet, and Handbook pages (especially the \ud83d\udc69\u200d\ud83c\udfeb Teacher Guide sections which contain parent dialogue, parent-child discussion prompts, adaptation tips, and pacing guidance), generate a comprehensive parent facilitation presentation. Each handbook page's Teacher Guide should become its own dedicated slide(s). Include activity overview, safety guidelines, facilitation tips for parents, and background knowledge. Use warm, encouraging language. Do NOT mention page numbers of a child workbook. Do NOT summarize or omit any information. Make it detailed. {style_prompt}{high_risk_footer_instruction}"
            
            deck_source_ids = shared_source_ids.copy()
            if roadmap_source_id:
                deck_source_ids.append(roadmap_source_id)
            # Include handbook sources so teacher version gets teacherContentPrompt
            deck_source_ids.extend(handbook_source_ids)
                
            pct = 0.50 + 0.4 * (deck_idx / total_decks)
            emit(output_path, {
                'status': 'generating_slides', 'progress': pct,
                'message': f'提交 {vlabel} Slide Deck (Full Course)...',
                'notebookId': notebook_id, 'notebookUrl': notebook_url
            })
            
            deck_title = f"{vlabel} - Full Course"
            try:
                await retry_async(
                    lambda sid=deck_source_ids, fp=focus: client.artifacts.generate_slide_deck(
                        notebook_id, source_ids=sid, language=language, instructions=fp
                    ),
                    label=f"{version} slide deck"
                )
                slide_decks.append({'title': deck_title, 'version': version, 'status': 'queued'})
                print(f"[slides] {vlabel} Deck queued", flush=True)
            except Exception as e:
                slide_decks.append({'title': deck_title, 'version': version, 'status': 'failed', 'error': str(e)})
                print(f"[slides] {vlabel} Deck FAILED: {e}", flush=True)
            
            deck_idx += 1
            if deck_idx < total_decks:
                await asyncio.sleep(5)

        # 4b. Student versions (one deck per chunk)
        chunk_start_idx = 0
        for ci in range(num_chunks):
            count = chunk_sizes[ci]
            end = chunk_start_idx + count
            
            deck_source_ids = [handbook_source_ids[ci]] + shared_source_ids
            
            for version in student_versions:
                vlabel = version_labels[version]
                focus = build_focus_prompt(style_prompt, ci, num_chunks, version, high_risk_footer_instruction)
                
                pct = 0.50 + 0.4 * (deck_idx / total_decks)
                emit(output_path, {
                    'status': 'generating_slides', 'progress': pct,
                    'message': f'提交 {vlabel} Slide Deck {ci + 1}/{num_chunks} (Pages {chunk_start_idx + 1}-{end})...',
                    'notebookId': notebook_id, 'notebookUrl': notebook_url
                })
                
                deck_title = f"{vlabel} - Pages {chunk_start_idx + 1}-{end}"
                try:
                    await retry_async(
                        lambda sid=deck_source_ids, fp=focus: client.artifacts.generate_slide_deck(
                            notebook_id, source_ids=sid, language=language, instructions=fp
                        ),
                        label=f"{version} slide deck {ci + 1}"
                    )
                    slide_decks.append({'title': deck_title, 'version': version, 'status': 'queued'})
                    print(f"[slides] {vlabel} Deck {ci + 1}/{num_chunks} queued", flush=True)
                except Exception as e:
                    slide_decks.append({'title': deck_title, 'version': version, 'status': 'failed', 'error': str(e)})
                    print(f"[slides] {vlabel} Deck {ci + 1}/{num_chunks} FAILED: {e}", flush=True)
                
                deck_idx += 1
                if deck_idx < total_decks:
                    await asyncio.sleep(5)
            
            chunk_start_idx = end

        # Step 5: Done
        queued = len([d for d in slide_decks if d['status'] == 'queued'])
        failed = len([d for d in slide_decks if d['status'] == 'failed'])

        version_summary = ' + '.join(version_labels.values())
        emit(output_path, {
            'status': 'done', 'progress': 1.0,
            'message': f'完成！已提交 {queued} 个 Slide Deck（{version_summary}，{failed} 个失败）',
            'notebookId': notebook_id, 'notebookUrl': notebook_url,
            'slideDecks': slide_decks,
            'stats': {
                'factSheetSources': 1 if has_fact_sheet else 0,
                'structureSources': 1 if structure_plan else 0,
                'handbookSources': len(handbook_source_ids),
                'slideDecksQueued': queued,
                'slideDecksFailed': failed,
                'versions': versions,
            }
        })
        print(f"[done] {queued} queued, {failed} failed ({version_summary})", flush=True)
    finally:
        # Clean up client context
        if client_ctx:
            try:
                await client_ctx.__aexit__(None, None, None)
            except:
                pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True, help='Input JSON file path')
    parser.add_argument('--output', required=True, help='Output JSON file path')
    args = parser.parse_args()

    input_data = json.loads(Path(args.input).read_text('utf-8'))

    try:
        asyncio.run(run_export(input_data, args.output))
    except Exception as e:
        import traceback
        emit(args.output, {
            'status': 'error', 'progress': 0,
            'message': f'导出失败: {e}',
            'error': str(e),
            'traceback': traceback.format_exc(),
        })


if __name__ == '__main__':
    main()
