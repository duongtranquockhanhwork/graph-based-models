"""Test cho pipeline NLP, bộ dự đoán và hợp đồng đánh giá.

Trọng tâm là các bất biến mà kiểm định đã chỉ ra là dễ vỡ nhất: hệ thống không
được bịa dự đoán khi mô hình không trả lời được, và không được lấy nhãn do
chính nó sinh ra làm ground truth.
"""

import pytest

from tests.conftest import auth


class TestNlpExtraction:
    def test_extracts_symbol_company_and_industry(self):
        from app.services.nlp_service import analyze_article

        result = analyze_article(
            "VNM báo lãi tăng 21% nhờ hợp đồng mới",
            "Công ty báo lãi tăng 21%, doanh thu tăng mạnh, ký kết hợp đồng mới.",
        )
        assert "VNM" in result["stocks"]
        assert result["companies"]
        assert "profit_growth" in result["events"]
        assert "new_contract" in result["events"]
        assert result["sentiment"] == "Positive"

    def test_direction_words_beat_bare_profit_words(self):
        """"lãi" trần không nằm trong danh sách tích cực: nó có nghĩa "lợi
        nhuận" mà không có chiều, nên "lãi giảm" từng bị nhận nhầm là tích cực."""
        from app.services.nlp_service import analyze_sentiment

        sentiment, _ = analyze_sentiment("Công ty báo lãi giảm mạnh, lợi nhuận giảm sâu")
        assert sentiment == "Negative"

    def test_quantified_magnitude_moves_the_score(self):
        from app.services.nlp_service import analyze_sentiment

        _, plain = analyze_sentiment("Doanh thu tăng")
        _, quantified = analyze_sentiment("Doanh thu tăng 33%")
        assert quantified > plain


class TestPredictionHonesty:
    def test_refusal_does_not_become_a_prediction(self):
        """Bất biến quan trọng nhất của toàn hệ thống.

        Khi mô hình không trả lời được, ``predicted_trend`` phải là ``None``.
        Không được rơi về heuristic rồi trình bày kết quả đó như dự đoán của
        mô hình — người dùng sẽ không phân biệt được hai thứ.
        """
        from app.services.prediction_service import predict_for_article

        result = predict_for_article(
            analysis={"sentiment": "Positive", "events": ["profit_growth"], "impact_score": 90.0, "reasons": []},
            graph_features={},
            title="Bài không nhắc mã nào",
            content="Nội dung chung chung",
            published_date="2024-01-05",
        )
        assert result["predicted_trend"] is None
        assert result["prediction_confidence"] is None
        assert result["prediction_explanation"]["engine"] == "finnexus"
        assert result["prediction_explanation"]["status"] in ("REFUSED", "UNAVAILABLE")

    def test_heuristic_output_is_labelled_as_heuristic(self):
        """Bộ luật không được huấn luyện và không có số đo hiệu năng nào. Kết
        quả của nó phải mang nhãn để giao diện cảnh báo đúng mức."""
        from app.services.prediction_service import predict_trend

        result = predict_trend(
            {"sentiment": "Positive", "events": ["profit_growth"], "impact_score": 90.0}, {}
        )
        assert result["explanation"]["engine"] == "heuristic"
        assert "warning" in result["explanation"]
        assert result["explanation"]["is_investment_advice"] is False

    def test_heuristic_direction_is_coherent(self):
        from app.services.prediction_service import predict_trend

        good = predict_trend({"sentiment": "Positive", "events": ["profit_growth"], "impact_score": 90.0}, {})
        bad = predict_trend({"sentiment": "Negative", "events": ["profit_decline"], "impact_score": 10.0}, {})
        assert good["trend"] == "INCREASING"
        assert bad["trend"] == "DECREASING"

    def test_no_endpoint_claims_investment_advice(self, client, user_token):
        for path in ["/api/prediction/", "/api/prediction/model-info"]:
            body = client.get(path, headers=auth(user_token)).json()
            assert body.get("is_investment_advice") is False
            assert body.get("tradeable") in (False, None)


class TestEvaluationContract:
    def test_ground_truth_never_comes_from_manual_sentiment(self, client, admin_token, user_token):
        """Bản trước, khi thiếu ``actual_trend``, lấy ``manual_sentiment`` ánh
        xạ qua đúng bảng mà bộ dự đoán cũng dùng — tức đo mô hình với chính nó.

        Ở đây: tạo bài, gán nhãn cảm xúc thủ công, KHÔNG có nhãn giá thật.
        Đánh giá phải báo thiếu dữ liệu chứ không được sinh ra một accuracy.
        """
        created = client.post(
            "/api/news/",
            headers=auth(user_token),
            json={"title": "VNM tang truong manh", "content": "loi nhuan tang"},
        )
        news_id = created.json()["id"]
        client.post(
            f"/api/admin/labeling/{news_id}",
            headers=auth(admin_token),
            json={"manual_sentiment": "Positive", "manual_event_type": "profit_growth"},
        )

        body = client.get("/api/prediction/evaluate", headers=auth(user_token)).json()
        assert body["insufficient_data"] is True
        assert "giá thật" in body["ground_truth"]

    def test_evaluation_always_reports_a_baseline(self, client, user_token):
        """Một Macro-F1 đứng một mình không cho biết mô hình có hơn đoán bừa
        hay không. Hợp đồng của endpoint này là luôn kèm baseline."""
        body = client.get("/api/prediction/evaluate", headers=auth(user_token)).json()
        assert "baseline" in body or body["insufficient_data"] is True

    def test_model_info_reports_baseline_alongside_score(self, client, user_token):
        body = client.get("/api/prediction/model-info", headers=auth(user_token)).json()
        if body["available"]:
            perf = body["performance"]
            assert perf["baseline_macro_f1"] is not None
            assert perf["delta_vs_baseline"] == pytest.approx(
                perf["out_of_fold_macro_f1"] - perf["baseline_macro_f1"], abs=1e-4
            )
        else:
            # Không có mô hình thì phải nói thẳng là đang chạy bằng bộ luật.
            assert body["active_model"] == "heuristic_rules"
            assert body["reason"]


class TestDataValidationContract:
    def test_pass_status_requires_usable_rows(self, client, admin_token):
        """Bảng kiểm định từng báo ``overall_status: PASS`` trong khi
        ``pass_pct: 0.0`` — không một bản ghi nào đạt."""
        body = client.get("/api/admin/data-validation", headers=auth(admin_token)).json()
        assert "checks" in body
        assert "enough_usable_rows" in body["checks"]
        if body["overall_status"] == "PASS":
            assert all(body["checks"].values())
        assert "split_leakage" not in body, "Chỉ số hardcode bằng 0 đã được gỡ"


class TestNewsApiContract:
    def test_search_is_applied_server_side(self, client, user_token, admin_token):
        client.post("/api/news/", headers=auth(user_token), json={"title": "ZZTEST mot bai rieng biet"})
        client.post("/api/news/", headers=auth(user_token), json={"title": "Bai khong lien quan"})

        rows = client.get("/api/news/?q=ZZTEST", headers=auth(user_token)).json()
        assert len(rows) >= 1
        assert all("ZZTEST" in r["title"] for r in rows)

    def test_csv_row_limit_enforced(self, client, user_token):
        from app.core.config import settings

        oversized = "title\n" + "\n".join(f"bai {i}" for i in range(settings.MAX_CSV_ROWS + 5))
        r = client.post(
            "/api/news/upload-csv",
            headers=auth(user_token),
            files={"file": ("big.csv", oversized, "text/csv")},
        )
        assert r.status_code == 413


class TestAnalysisStatus:
    """Phân tích chạy nền, nên giao diện cần biết lúc nào xong. Trước đây không
    có cách nào: người dùng phải tự bấm Làm mới và đoán."""

    def test_reports_progress_for_a_batch(self, client, user_token):
        ids = [
            client.post(
                "/api/news/", headers=auth(user_token), json={"title": f"VNM tin so {i}"}
            ).json()["id"]
            for i in range(3)
        ]
        body = client.post(
            "/api/news/analysis-status", headers=auth(user_token), json={"ids": ids}
        ).json()

        assert body["total"] == 3
        assert body["analyzed"] + body["pending"] == 3
        assert set(body) >= {"done", "scored", "refused", "needs_review", "symbols"}

    def test_empty_batch_is_done(self, client, user_token):
        body = client.post(
            "/api/news/analysis-status", headers=auth(user_token), json={"ids": []}
        ).json()
        assert body["done"] is True

    def test_deleted_articles_count_as_finished(self, client, user_token, admin_token):
        """Một id đã bị xoá giữa chừng phải tính là xong, nếu không giao diện
        sẽ chờ mãi một bài không bao giờ xuất hiện."""
        created = client.post(
            "/api/news/", headers=auth(user_token), json={"title": "Bai se bi xoa"}
        ).json()["id"]
        client.delete(f"/api/news/{created}", headers=auth(admin_token))

        body = client.post(
            "/api/news/analysis-status", headers=auth(user_token), json={"ids": [created]}
        ).json()
        assert body["done"] is True
        assert body["pending"] == 0

    def test_requires_authentication(self, client):
        assert client.post("/api/news/analysis-status", json={"ids": [1]}).status_code == 401
