#!/usr/bin/env python3
"""
NotebookLM Notebook Operations Helper

Checks/generates resource guide, and queries notebook sources.

Usage:
    python nlm-resource-guide.py check <notebook_id>
    python nlm-resource-guide.py generate <notebook_id> [--user-input <json>]
    python nlm-resource-guide.py query <notebook_id> --prompts <json_array>

Output: JSON to stdout
"""

import asyncio
import json
import os
import sys
from pathlib import Path


GUIDE_TITLE = "📚 资源调用指南"
GUIDE_TITLE_ALT = "资源调用指南"  # Without emoji fallback


async def get_client():
    """Create a NotebookLMClient from stored auth."""
    from notebooklm import NotebookLMClient
    client = await NotebookLMClient.from_storage()
    await client.__aenter__()
    return client


async def check_guide(notebook_id: str):
    """Check if a resource guide source exists in the notebook."""
    client = await get_client()
    try:
        sources = await client.sources.list(notebook_id)
        for s in sources:
            title = getattr(s, 'title', '') or ''
            if GUIDE_TITLE in title or GUIDE_TITLE_ALT in title:
                return {
                    "exists": True,
                    "sourceId": s.id,
                    "title": title,
                    "sourcesCount": len(sources),
                }
        return {
            "exists": False,
            "sourcesCount": len(sources),
            "sourceNames": [getattr(s, 'title', 'unknown') for s in sources],
        }
    finally:
        await client.__aexit__(None, None, None)


async def generate_guide(notebook_id: str, user_input: dict | None = None):
    """Generate a resource guide and add it to the notebook."""
    client = await get_client()
    try:
        # Step 1: List existing sources
        sources = await client.sources.list(notebook_id)
        
        # Check if guide already exists
        for s in sources:
            title = getattr(s, 'title', '') or ''
            if GUIDE_TITLE in title or GUIDE_TITLE_ALT in title:
                return {
                    "status": "already_exists",
                    "sourceId": s.id,
                }

        source_names = [getattr(s, 'title', 'unknown') for s in sources]
        print(f"[guide] Found {len(sources)} sources: {source_names}", file=sys.stderr)

        # Step 2: Query notebook to understand its contents
        print("[guide] Querying notebook to analyze contents...", file=sys.stderr)
        analysis_query = (
            "Please provide a comprehensive analysis of ALL source materials in this notebook:\n"
            "1. List every source file with its exact name\n"
            "2. For each source, describe its type (Lesson Planner, Student's Book, Workbook, etc.)\n"
            "3. What textbook series and level is this?\n"
            "4. How many units are there?\n"
            "5. What is the internal structure of each unit? (trails, sections, lessons)\n"
            "6. List the main topics/themes for each unit\n"
            "7. What vocabulary, grammar, phonics content is covered per unit?\n"
            "8. Are there assessment rubrics? What types?\n"
        )
        analysis = await client.chat.ask(notebook_id, analysis_query)
        analysis_text = getattr(analysis, 'text', '') or getattr(analysis, 'content', '') or str(analysis)
        print(f"[guide] Analysis complete ({len(analysis_text)} chars)", file=sys.stderr)

        # Step 3: Generate resource guide using Gemini
        print("[guide] Generating resource guide with Gemini...", file=sys.stderr)
        guide_text = await _generate_guide_with_gemini(
            notebook_id, source_names, analysis_text, user_input
        )
        print(f"[guide] Guide generated ({len(guide_text)} chars)", file=sys.stderr)

        # Step 4: Add guide as text source
        print("[guide] Adding guide to notebook...", file=sys.stderr)
        source = await client.sources.add_text(
            notebook_id, GUIDE_TITLE, guide_text, wait=True, wait_timeout=60
        )
        source_id = getattr(source, 'id', None)
        print(f"[guide] Guide added as source: {source_id}", file=sys.stderr)

        return {
            "status": "created",
            "sourceId": source_id,
            "guideLength": len(guide_text),
        }
    finally:
        await client.__aexit__(None, None, None)


async def _generate_guide_with_gemini(
    notebook_id: str,
    source_names: list[str],
    analysis_text: str,
    user_input: dict | None = None,
) -> str:
    """Use Gemini to generate the resource guide markdown."""
    import google.generativeai as genai

    api_key = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY')
    if not api_key:
        # Try loading from .env
        env_path = Path(__file__).parent.parent / '.env'
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith('GEMINI_API_KEY=') or line.startswith('GOOGLE_API_KEY='):
                    api_key = line.split('=', 1)[1].strip().strip('"').strip("'")
                    break
    if not api_key:
        raise ValueError("No GEMINI_API_KEY or GOOGLE_API_KEY found")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.5-flash')

    user_context = ""
    if user_input:
        parts = []
        if user_input.get('level'):
            parts.append(f"Target Level: {user_input['level']}")
        if user_input.get('duration'):
            parts.append(f"Lesson Duration: {user_input['duration']} minutes")
        if user_input.get('studentCount'):
            parts.append(f"Student Count: {user_input['studentCount']}")
        if user_input.get('lessonCount'):
            parts.append(f"Total Lessons: {user_input['lessonCount']}")
        if user_input.get('customInstructions'):
            parts.append(f"Teacher's Custom Instructions: {user_input['customInstructions']}")
        if parts:
            user_context = "\n\nTeacher's Input:\n" + "\n".join(parts)

    prompt = f"""You are an expert ESL curriculum designer. Based on the analysis of a NotebookLM notebook's source materials, generate a comprehensive **资源调用指南** (Resource Guide).

## Notebook Analysis Results:
{analysis_text}

## Source Files in Notebook:
{json.dumps(source_names, ensure_ascii=False, indent=2)}
{user_context}

## Required Output Format (in Chinese):

Generate the guide following this EXACT structure:

# 📚 资源调用指南：[Textbook Name] ([Level])

**Notebook ID**: `{notebook_id}`
**教材**: [Full textbook name, edition, level]
**结构**: [X 个主题单元 + Y 个复习课, structure per unit]
**推荐教学周期**: [X 周]

---

## 一、来源文件清单与调用规则

### 🔴 核心来源（生成大纲/课件必须调用）

Table with columns: #, 文件名, 类型, 调用场景

### 🟡 辅助来源（按需调用）

Similar table.

### ⚪ 参考来源（一般不需调用）

Similar table.

---

## 二、单元内部结构

Show the internal structure of each unit (trails, sections, etc.) as a tree diagram.

---

## 三、课时安排方案

### 方案 A: [schedule option]
### 方案 B: [schedule option]
### 方案 C: 智能判断（自定义课时）

For each session, provide a detailed table with columns: 阶段, 时长, 目标, 活动设计

---

## 四、Learning Companion 互动任务（仅互动型）

Table with: 任务类型, 示例, 触发时机

---

## 五、Scope & Sequence

For EACH unit, create a table with Trail 1 and Trail 2 (or equivalent), listing:
- 词汇 (vocabulary)
- 语法 (grammar)
- 语音 (phonics)
- 阅读 (reading)
- 听力 (listening)
- 输出 (output: speaking/project)

---

## 六、复习课

Table with: 复习, 周次, 覆盖, 结构重点

---

## 七、AI 生成调用策略

### 生成大纲（Curriculum）时
### 生成 Lesson Plan 时
### 生成 Assignment 时
### 生成 LC 互动任务时

---

## 八、跨级别适配说明

CRITICAL RULES:
1. ALL content must be derived from the actual source materials analysis — do NOT invent vocabulary, grammar points, or unit topics
2. Use the EXACT source file names from the notebook
3. The guide must be in Chinese (中文)
4. Be thorough — include ALL units from the textbook
5. Vocabulary lists should contain the ACTUAL words found in the source materials
6. Grammar points should match what's taught in each unit
7. Reading titles should be the EXACT titles from the textbook
"""

    response = await model.generate_content_async(prompt)
    return response.text


async def query_notebook(notebook_id: str, prompts: list[str]):
    """Query the notebook's sources for each prompt, returning factSheets."""
    client = await get_client()
    try:
        fact_sheets = []
        all_source_refs = []

        for i, prompt in enumerate(prompts):
            print(f"[query] Querying {i+1}/{len(prompts)}: {prompt[:80]}...", file=sys.stderr)
            try:
                result = await client.chat.ask(notebook_id, prompt)
                content = getattr(result, 'text', '') or getattr(result, 'content', '') or str(result)
                
                # Extract citation count from [N] markers
                import re
                citations = re.findall(r'\[\d+\]', content)
                citation_count = len(set(citations))
                
                # Extract source references if available
                source_refs = []
                if hasattr(result, 'sources'):
                    source_refs = [getattr(s, 'title', '') for s in (result.sources or [])]
                    all_source_refs.extend(source_refs)
                
                quality = 'good' if citation_count >= 3 else ('low' if citation_count >= 1 else 'insufficient')
                
                fact_sheets.append({
                    'content': content[:20000],
                    'citationCount': citation_count,
                    'quality': quality,
                    'sourceRefs': source_refs[:10],
                })
                print(f"[query] Result {i+1}: {len(content)} chars, {citation_count} citations, quality={quality}", file=sys.stderr)
            except Exception as e:
                print(f"[query] Error on prompt {i+1}: {e}", file=sys.stderr)
                fact_sheets.append({
                    'content': f'Query failed: {str(e)}',
                    'citationCount': 0,
                    'quality': 'insufficient',
                    'sourceRefs': [],
                })
            
            # Small delay between queries to avoid rate limiting
            if i < len(prompts) - 1:
                import asyncio as _asyncio
                await _asyncio.sleep(1)

        # List sources for metadata
        sources = await client.sources.list(notebook_id)
        source_list = [
            {'title': getattr(s, 'title', 'unknown'), 'type': getattr(s, 'source_type', 'unknown')}
            for s in sources
        ]

        return {
            'factSheets': fact_sheets,
            'sources': source_list,
            'notebookId': notebook_id,
        }
    finally:
        await client.__aexit__(None, None, None)


async def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: nlm-resource-guide.py <check|generate|query> <notebook_id>"}))
        sys.exit(1)

    action = sys.argv[1]
    notebook_id = sys.argv[2]

    user_input = None
    if '--user-input' in sys.argv:
        idx = sys.argv.index('--user-input')
        if idx + 1 < len(sys.argv):
            user_input = json.loads(sys.argv[idx + 1])

    prompts = None
    if '--prompts' in sys.argv:
        idx = sys.argv.index('--prompts')
        if idx + 1 < len(sys.argv):
            prompts = json.loads(sys.argv[idx + 1])

    try:
        if action == 'check':
            result = await check_guide(notebook_id)
        elif action == 'generate':
            result = await generate_guide(notebook_id, user_input)
        elif action == 'query':
            if not prompts:
                result = {"error": "Missing --prompts argument"}
            else:
                result = await query_notebook(notebook_id, prompts)
        else:
            result = {"error": f"Unknown action: {action}"}
        
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e), "type": type(e).__name__}))
        sys.exit(1)


if __name__ == '__main__':
    asyncio.run(main())
