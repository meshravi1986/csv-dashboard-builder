import json
from typing import Optional
from openai import OpenAI
from app.config import settings
from app.prompts.semantic import SEMANTIC_SUGGESTION_PROMPT

_has_valid_key = settings.openai_api_key and not settings.openai_api_key.startswith("your_")
client = OpenAI(api_key=settings.openai_api_key, timeout=10.0) if _has_valid_key else None

_ai_cache: dict[str, Optional[list]] = {}


def get_ai_semantic_suggestions(profile_json: dict, dataset_id: Optional[str] = None) -> Optional[list]:
    if dataset_id and dataset_id in _ai_cache:
        return _ai_cache[dataset_id]

    if not client:
        return None

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SEMANTIC_SUGGESTION_PROMPT},
                {"role": "user", "content": json.dumps(profile_json, indent=2)},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=1000,
        )
        content = response.choices[0].message.content
        if content:
            result = json.loads(content)
            suggestions = result.get("fields", [])
            if dataset_id:
                _ai_cache[dataset_id] = suggestions
            return suggestions
    except Exception:
        return None

    return None
