SEMANTIC_SUGGESTION_PROMPT = """You are a data analyst assistant. Given the following dataset profile, suggest semantic roles for each field.

Rules:
- "date" role: fields that contain dates, timestamps, or time periods
- "dimension" role: fields used for grouping, categories, text labels, IDs with low-medium cardinality
- "measure" role: numeric fields used for aggregation (SUM, AVG, COUNT)
- For measure fields, suggest an appropriate aggregation (SUM for additive values like revenue, AVG for rates/ratios, COUNT for IDs)
- For date fields, no aggregation needed
- For dimension fields, no aggregation needed

Return ONLY valid JSON with this structure:
{
  "fields": [
    {
      "field_name": "column_name",
      "suggested_role": "dimension|measure|date",
      "suggested_aggregation": "SUM|AVG|COUNT|null"
    }
  ]
}

Dataset Profile:
{profile_json}
"""
