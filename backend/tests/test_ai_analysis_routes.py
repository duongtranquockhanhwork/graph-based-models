"""Route giải thích bằng Claude.

Ba điều phải đúng: không có khoá thì nói rõ vì sao; có bản còn hiệu lực thì trả
ngay mà không gọi API (mỗi lần gọi tốn tiền); và khi bài được phân tích lại, bản
cũ chỉ bị bỏ nếu đầu vào của nó thật sự đổi.
"""

import pytest

from app.core.database import SessionLocal
from app.models.news import NewsArticle
from app.routers.news import _run_analysis
from app.services import ai_analysis_service as svc
from app.services.finnexus_service import recommendation_evidence
from tests.conftest import auth


@pytest.fixture(autouse=True)
def no_credentials(monkeypatch):
    monkeypatch.setattr(svc.settings, "ANTHROPIC_API_KEY", "")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)


def _create(client, token, title="VNM công bố cổ tức tiền mặt"):
    response = client.post(
        "/api/news/", headers=auth(token), json={"title": title, "content": "Vinamilk chia cổ tức."}
    )
    assert response.status_code == 200
    return response.json()["id"]


def _store(news_id, record):
    with SessionLocal() as db:
        article = db.get(NewsArticle, news_id)
        article.ai_analysis = record
        db.commit()


def _fresh_record(news_id):
    with SessionLocal() as db:
        article = db.get(NewsArticle, news_id)
        digest = svc.fingerprint(svc.article_payload(article), recommendation_evidence())
    return {
        "version": svc.ANALYSIS_VERSION,
        "input_sha256": digest,
        "model": "test",
        "generated_at": "2026-09-11T00:00:00+00:00",
        "analysis": {"what_happened": "x", "affected": [], "model_reading": "y",
                     "risks_to_watch": [], "limits": "z"},
    }


def test_status_reports_missing_configuration(client, user_token):
    body = client.get("/api/news/ai-analysis/status", headers=auth(user_token)).json()
    assert body["configured"] is False


def test_without_a_key_the_user_is_told_why(client, user_token):
    news_id = _create(client, user_token)
    response = client.post(f"/api/news/{news_id}/ai-analysis", headers=auth(user_token))
    assert response.status_code == 503
    assert "ANTHROPIC_API_KEY" in response.json()["detail"]["message"]


def test_a_fresh_stored_analysis_is_returned_without_calling_claude(client, user_token, monkeypatch):
    news_id = _create(client, user_token)
    record = _fresh_record(news_id)
    _store(news_id, record)
    monkeypatch.setattr(
        svc, "analyze", lambda *a, **k: pytest.fail("không được gọi Claude khi đã có bản còn hiệu lực")
    )
    response = client.post(f"/api/news/{news_id}/ai-analysis", headers=auth(user_token))
    assert response.status_code == 200
    assert response.json()["input_sha256"] == record["input_sha256"]


def test_stored_analysis_is_served_with_the_article(client, user_token):
    news_id = _create(client, user_token)
    record = _fresh_record(news_id)
    _store(news_id, record)
    body = client.get(f"/api/news/{news_id}", headers=auth(user_token)).json()
    assert body["ai_analysis"]["input_sha256"] == record["input_sha256"]


def test_reanalysis_keeps_an_analysis_that_is_still_valid(client, user_token):
    news_id = _create(client, user_token)
    record = _fresh_record(news_id)
    _store(news_id, record)
    _run_analysis(news_id)
    with SessionLocal() as db:
        assert db.get(NewsArticle, news_id).ai_analysis == record


def test_reanalysis_drops_an_analysis_whose_inputs_changed(client, user_token):
    news_id = _create(client, user_token)
    _store(news_id, dict(_fresh_record(news_id), input_sha256="outdated"))
    _run_analysis(news_id)
    with SessionLocal() as db:
        assert db.get(NewsArticle, news_id).ai_analysis is None


def test_requires_login(client):
    assert client.post("/api/news/1/ai-analysis").status_code == 401


def test_unknown_article_is_404(client, user_token):
    assert client.post("/api/news/999999/ai-analysis", headers=auth(user_token)).status_code == 404
