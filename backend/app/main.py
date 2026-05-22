from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.upload import router as upload_router
from app.api.datasets import router as datasets_router
from app.api.dashboards import router as dashboards_router
from app.api.query import router as query_router

app = FastAPI(
    title="CSV Dashboard Builder API",
    version="0.1.0",
    docs_url="/docs",
)

print(f"CORS origins: {settings.cors_origins}", flush=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router)
app.include_router(datasets_router)
app.include_router(dashboards_router)
app.include_router(query_router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "0.1.0"}
