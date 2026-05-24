from openai import OpenAI
from app.config import settings

_has_valid_key = settings.openai_api_key and not settings.openai_api_key.startswith("your_")
client = OpenAI(api_key=settings.openai_api_key, timeout=10.0) if _has_valid_key else None
