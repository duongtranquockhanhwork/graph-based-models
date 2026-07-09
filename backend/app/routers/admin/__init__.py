from fastapi import APIRouter

from app.routers.admin import activity, dashboard, keywords, labeling, settings, stocks, users, validation

router = APIRouter()

router.include_router(dashboard.router, tags=["admin-dashboard"])
router.include_router(users.router, prefix="/users", tags=["admin-users"])
router.include_router(settings.router, prefix="/settings", tags=["admin-settings"])
router.include_router(keywords.router, prefix="/event-keywords", tags=["admin-keywords"])
router.include_router(labeling.router, prefix="/labeling", tags=["admin-labeling"])
router.include_router(validation.router, tags=["admin-validation"])
router.include_router(stocks.router, prefix="/stocks", tags=["admin-stocks"])
router.include_router(activity.router, prefix="/activity", tags=["admin-activity"])
