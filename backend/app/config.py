from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_anon_key: str = ""
    openai_api_key: str = ""
    database_url: str = ""
    app_secret: str = ""
    cors_origins: str = "http://localhost:3000"
    storage_bucket: str = "datasets"

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()
