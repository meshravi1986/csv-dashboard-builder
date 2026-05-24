import json
from typing import Optional
from app.utils.openai_client import client
from app.prompts.metric_sql import METRIC_SQL_PROMPT


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
