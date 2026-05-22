from supabase import create_client, Client
from app.config import settings

_supabase: Client | None = None
_supabase_admin: Client | None = None


def get_supabase() -> Client:
    """Returns a Supabase client with limited DB permissions (or service key fallback).
    
    Uses SUPABASE_LIMITED_KEY if set, otherwise falls back to SUPABASE_SERVICE_KEY.
    For storage operations, use get_supabase_admin() instead.
    """
    global _supabase
    if _supabase is None:
        key = settings.supabase_limited_key or settings.supabase_service_key
        _supabase = create_client(
            settings.supabase_url,
            key,
        )
    return _supabase


def get_supabase_admin() -> Client:
    """Returns a Supabase client with the service key (admin access).
    
    Only use this for operations that require elevated privileges,
    such as storage uploads/downloads and auth verification.
    """
    global _supabase_admin
    if _supabase_admin is None:
        _supabase_admin = create_client(
            settings.supabase_url,
            settings.supabase_service_key,
        )
    return _supabase_admin


def get_supabase_storage():
    sb = get_supabase_admin()
    return sb.storage.from_(settings.storage_bucket)
