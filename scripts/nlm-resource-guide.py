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

    prompt = f"""You are an expert ESL curriculum designer. Based on the analysis of a NotebookLM notebook's source materials, generate a comprehensive **Resource Guide** for AI-assisted lesson planning.

## Notebook Analysis Results:
{analysis_text}

## Source Files in Notebook:
{json.dumps(source_names, ensure_ascii=False, indent=2)}
{user_context}

## Required Output Format:

Generate the guide following this EXACT structure:

# \U0001f4da Resource Guide: [Textbook Name] ([Level])

**Notebook ID**: `{notebook_id}`
**Textbook**: [Full textbook name, edition, level]
**Structure**: [X thematic units + Y review lessons, structure per unit]
**Recommended Teaching Period**: [X weeks]

---

## 1. Source File Inventory & Usage Rules

### \U0001f534 Core Sources (MUST reference for curriculum/lesson plan generation)

Table with columns: #, Filename, Type, Usage Scenario

### \U0001f7e1 Auxiliary Sources (reference as needed)

Similar table.

### \u26aa Reference Sources (rarely needed)

Similar table.

---

## 2. Unit Internal Structure

Show the internal structure of each unit (trails, sections, etc.) as a tree diagram.

---

## 3. Lesson Scheduling Options

### Plan A: [schedule option, e.g. 2 sessions/week]
### Plan B: [schedule option, e.g. 3 sessions/week]
### Plan C: Adaptive (custom lesson count)

For each session, provide a detailed table with columns: Stage, Duration, Objective, Activity Design

---

## 4. Learning Companion Interactive Tasks (Interactive type only)

Table with: Task Type, Example, Trigger Timing

---

## 5. Scope & Sequence

For EACH unit, create a table with Trail 1 and Trail 2 (or equivalent), listing:
- Vocabulary
- Grammar
- Phonics
- Reading
- Listening
- Output (speaking/project)

---

## 6. Review Lessons

Table with: Review, Week, Coverage, Structure Focus

---

## 7. AI Generation Strategy

### When generating Curriculum
### When generating Lesson Plans
### When generating Assignments
### When generating LC Interactive Tasks

---

## 8. Cross-Level Adaptation Notes

CRITICAL RULES:
1. ALL content must be derived from the actual source materials analysis — do NOT invent vocabulary, grammar points, or unit topics
2. Use the EXACT source file names from the notebook
3. The guide must be in ENGLISH
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
