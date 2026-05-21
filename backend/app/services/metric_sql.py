import json
from typing import Optional
from openai import OpenAI
from app.config import settings
from app.prompts.metric_sql import METRIC_SQL_PROMPT

_has_valid_key = settings.openai_api_key and not settings.openai_api_key.startswith("your_")
client = OpenAI(api_key=settings.openai_api_key, timeout=10.0) if _has_valid_key else None


def suggest_sql(profile: dict, description: str) -> Optional[str]:
    if not client:
        return None

    schema_lines = []
    for field in profile.get("fields", []):
        samples = field.get("sample_values", [])
        sample_str = ", ".join(str(s) for s in samples[:3]) if samples else ""
        schema_lines.append(f"  {field['field_name']} ({field['detected_type']}) samples: [{sample_str}]")

    schema_str = "\n".join(schema_lines)

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": METRIC_SQL_PROMPT.format(schema=schema_str, description=description)},
            ],
            temperature=0.1,
            max_tokens=200,
        )
        sql = response.choices[0].message.content
        if sql:
            sql = sql.strip().strip("```sql").strip("```").strip()
            return sql
    except Exception:
        return None

    return None
