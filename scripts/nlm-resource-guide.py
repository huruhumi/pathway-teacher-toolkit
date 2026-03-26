#!/usr/bin/env python3
"""
NotebookLM Notebook Operations Helper

Checks/generates resource guide, and queries notebook sources.

Usage:
    python nlm-resource-guide.py check <notebook_id>
    python nlm-resource-guide.py generate <notebook_id> [--user-input <json>]
    python nlm-resource-guide.py read <notebook_id>
    python nlm-resource-guide.py query <notebook_id> --prompts <json_array>

Output: JSON to stdout
"""

import asyncio
import json
import os
import sys
from pathlib import Path


GUIDE_TITLE = "\U0001f4da Resource Guide"
GUIDE_TITLE_ALT = "Resource Guide"  # Without emoji fallback


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
            for line in env_path.read_text(encoding='utf-8').splitlines():
                for prefix in ('VITE_GEMINI_API_KEY=', 'GEMINI_API_KEY=', 'GOOGLE_API_KEY='):
                    if line.startswith(prefix):
                        api_key = line.split('=', 1)[1].strip().strip('"').strip("'")
                        break
    if not api_key:
        raise ValueError("No GEMINI_API_KEY or GOOGLE_API_KEY found")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.5-flash')

    # Load the reference example guide for few-shot prompting
    example_path = Path(__file__).parent.parent / 'packages' / 'shared' / 'config' / 'resource-guide-example.md'
    example_text = ""
    if example_path.exists():
        example_text = example_path.read_text(encoding='utf-8')
        print(f"[guide] Loaded example guide: {len(example_text)} chars", file=sys.stderr)

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

    prompt = f"""You are an expert ESL curriculum designer. Generate a comprehensive **Resource Guide** for AI-assisted lesson planning.

## YOUR TASK

Based on the notebook analysis below, generate a Resource Guide that is **AT LEAST as detailed** as the reference example.

## REFERENCE EXAMPLE (follow this format and level of detail EXACTLY):

{example_text}

---

## NOTEBOOK ANALYSIS (use this data to generate the guide):

{analysis_text}

## SOURCE FILES IN THIS NOTEBOOK:

{json.dumps(source_names, ensure_ascii=False, indent=2)}
{user_context}

## CRITICAL REQUIREMENTS:

1. **Match the reference example's detail level** — every unit must have ACTUAL vocabulary words, grammar points, phonics, reading titles, listening topics, and output activities extracted from the analysis
2. **Use EXACT source file names** from the notebook
3. **Include complete Scope & Sequence** with real vocabulary lists (10+ words per trail per unit)
4. **Include full lesson scheduling tables** with specific stage-by-stage breakdowns (Plan A, B, C)
5. **Include AI Generation Strategy** with specific step-by-step instructions for curriculum, lesson plan, and assignment generation
6. **The guide MUST be in English** (the reference uses Chinese section headers — translate those to English equivalents)
7. **Notebook ID**: `{notebook_id}`
8. Do NOT invent content — all vocabulary, grammar, reading titles must come from the analysis data
9. If the analysis doesn't provide enough detail for a section, query will be needed — mark those sections with [NEEDS VERIFICATION] but still include your best extraction from available data
"""

    response = await model.generate_content_async(prompt)
    return response.text


async def read_guide(notebook_id: str):
    """Read the full content of the Resource Guide from the notebook via chat."""
    client = await get_client()
    try:
        # First, confirm the guide exists
        sources = await client.sources.list(notebook_id)
        guide_source = None
        for s in sources:
            title = getattr(s, 'title', '') or ''
            if GUIDE_TITLE in title or GUIDE_TITLE_ALT in title:
                guide_source = s
                break

        if not guide_source:
            return {"status": "not_found", "error": "Resource Guide source not found in notebook"}

        # Ask NLM to output the full content of the Resource Guide
        print(f"[read] Found guide source: {getattr(guide_source, 'id', 'unknown')}", file=sys.stderr)
        read_query = (
            f'Please output the COMPLETE and FULL text content of the source titled "{GUIDE_TITLE}" '
            'or "Resource Guide" verbatim, without summarizing or truncating. '
            'Include every section, every table, every list item exactly as written.'
        )
        result = await client.chat.ask(notebook_id, read_query)
        content = getattr(result, 'text', '') or getattr(result, 'content', '') or str(result)
        print(f"[read] Retrieved {len(content)} chars", file=sys.stderr)

        if not content or len(content) < 100:
            return {"status": "error", "error": "Resource Guide content was empty or too short"}

        return {
            "status": "ok",
            "content": content,
            "sourceId": getattr(guide_source, 'id', None),
            "charCount": len(content),
        }
    finally:
        await client.__aexit__(None, None, None)


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
        elif action == 'read':
            result = await read_guide(notebook_id)
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
