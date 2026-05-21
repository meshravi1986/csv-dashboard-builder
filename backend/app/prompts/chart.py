CHART_TITLE_PROMPT = """You are a dashboard designer. Given the following chart specification, suggest a polished, executive-quality title.

Chart Details:
- Type: {chart_type}
- X-axis: {x_field} ({x_role})
- Y-axis: {y_field} ({y_role})
- Aggregation: {aggregation}

Return a JSON object with:
{{
  "title": "Short, polished chart title (max 8 words)",
  "description": "One sentence explaining what this chart shows"
}}
"""


CHART_RANKING_PROMPT = """You are a dashboard designer. Given the following list of chart specifications, rank them by importance for an executive dashboard. Return the ordered list with each item having a score from 1-10.

Charts:
{charts_json}

Return ONLY a JSON array:
[
  {{
    "x_field": "...",
    "y_field": "...",
    "relevance_score": 8,
    "reasoning": "Why this chart is important"
  }}
]
"""


DASHBOARD_COMPOSITION_PROMPT = """You are a dashboard designer. Create a dashboard title and description for a dataset with these semantics.

Fields:
{semantics_json}

Return a JSON object with:
{{
  "title": "Executive dashboard title (max 10 words)",
  "description": "One sentence describing what this dashboard reveals"
}}
"""
