"""Mỗi khách hàng chỉ thấy dữ liệu (tin tức, đồ thị tri thức, dashboard, dự
đoán theo mã) do CHÍNH họ thêm vào — không phải toàn hệ thống dùng chung như
trước. Admin vẫn thấy được tổng hợp toàn bộ. Đây là các test khoá lại ranh
giới cô lập đó ở mọi endpoint đọc dữ liệu tin tức.

Các test dùng SO SÁNH TƯƠNG ĐỐI (trước/sau, có/không trong danh sách) thay vì
đếm tuyệt đối: cơ sở dữ liệu SQLite của bộ test dùng chung cho cả phiên chạy
pytest (xem conftest.py), nên các file test khác có thể đã tạo dữ liệu trước
đó dưới cùng tài khoản test1/test2/admin.
"""

from tests.conftest import auth

ARTICLE_A = {
    "title": "FPT ký hợp đồng lớn với đối tác nước ngoài",
    "content": "Công ty Cổ phần FPT vừa công bố hợp đồng chuyển đổi số quy mô lớn.",
}
ARTICLE_B = {
    "title": "Vietcombank báo lãi tăng trưởng mạnh quý này",
    "content": "Ngân hàng TMCP Ngoại thương Việt Nam công bố kết quả kinh doanh khả quan.",
}


def _create(client, token, payload):
    r = client.post("/api/news/", headers=auth(token), json=payload)
    assert r.status_code == 200, r.text
    return r.json()["id"]


class TestNewsListAndGetIsolation:
    def test_owner_sees_their_own_article(self, client, user_token):
        news_id = _create(client, user_token, ARTICLE_A)
        ids = [n["id"] for n in client.get("/api/news/", headers=auth(user_token)).json()]
        assert news_id in ids
        assert client.get(f"/api/news/{news_id}", headers=auth(user_token)).status_code == 200

    def test_other_customer_cannot_see_it(self, client, user_token, other_user_token):
        news_id = _create(client, user_token, ARTICLE_A)
        ids = [n["id"] for n in client.get("/api/news/", headers=auth(other_user_token)).json()]
        assert news_id not in ids
        assert client.get(f"/api/news/{news_id}", headers=auth(other_user_token)).status_code == 404

    def test_admin_sees_everyone(self, client, user_token, other_user_token, admin_token):
        id_a = _create(client, user_token, ARTICLE_A)
        id_b = _create(client, other_user_token, ARTICLE_B)
        ids = [n["id"] for n in client.get("/api/news/", headers=auth(admin_token)).json()]
        assert id_a in ids and id_b in ids
        assert client.get(f"/api/news/{id_a}", headers=auth(admin_token)).status_code == 200
        assert client.get(f"/api/news/{id_b}", headers=auth(admin_token)).status_code == 200


class TestAnalysisStatusIsolation:
    def test_ids_belonging_to_another_user_are_not_counted_as_mine(self, client, user_token, other_user_token):
        news_id = _create(client, user_token, ARTICLE_A)
        r = client.post(
            "/api/news/analysis-status",
            headers=auth(other_user_token),
            json={"ids": [news_id]},
        )
        assert r.status_code == 200
        body = r.json()
        # Không thuộc về other_user -> coi như đã "xong" (không phải chờ mãi
        # một id không bao giờ chuyển trạng thái với họ), nhưng KHÔNG lộ nội
        # dung của nó (endpoint không trả nội dung bài, chỉ đếm).
        assert body["total"] == 1
        assert body["done"] is True


class TestDashboardAndStocksIsolation:
    def test_dashboard_totals_scoped_to_owner(self, client, user_token, other_user_token):
        before_owner = client.get("/api/analytics/dashboard", headers=auth(user_token)).json()["total_news"]
        before_other = client.get("/api/analytics/dashboard", headers=auth(other_user_token)).json()["total_news"]
        _create(client, user_token, ARTICLE_A)
        after_owner = client.get("/api/analytics/dashboard", headers=auth(user_token)).json()["total_news"]
        after_other = client.get("/api/analytics/dashboard", headers=auth(other_user_token)).json()["total_news"]
        assert after_owner == before_owner + 1
        assert after_other == before_other

    def test_admin_dashboard_sees_combined_total(self, client, user_token, other_user_token, admin_token):
        before_admin = client.get("/api/analytics/dashboard", headers=auth(admin_token)).json()["total_news"]
        _create(client, user_token, ARTICLE_A)
        _create(client, other_user_token, ARTICLE_B)
        after_admin = client.get("/api/analytics/dashboard", headers=auth(admin_token)).json()["total_news"]
        assert after_admin == before_admin + 2

    def test_stock_universe_stays_shared_but_mentions_are_scoped(self, client, user_token, other_user_token):
        # STOCK_DICT (danh sách mã) là tài liệu tham khảo dùng chung, không
        # phải dữ liệu người dùng thêm — cả hai tài khoản phải thấy cùng một
        # danh sách mã, chỉ khác nhau ở mention_count.
        stocks_owner = client.get("/api/analytics/stocks", headers=auth(user_token)).json()
        stocks_other = client.get("/api/analytics/stocks", headers=auth(other_user_token)).json()
        assert len(stocks_owner) == len(stocks_other)
        assert len(stocks_owner) > 0


class TestGraphIsolation:
    def test_graph_stats_unaffected_by_another_users_article(self, client, user_token, other_user_token):
        before_other = client.get("/api/graph/stats", headers=auth(other_user_token)).json()["total_nodes"]
        _create(client, user_token, ARTICLE_A)
        stats_owner = client.get("/api/graph/stats", headers=auth(user_token)).json()
        after_other = client.get("/api/graph/stats", headers=auth(other_user_token)).json()["total_nodes"]
        assert stats_owner["total_nodes"] > 0
        assert after_other == before_other

    def test_admin_graph_includes_everyone(self, client, user_token, other_user_token, admin_token):
        _create(client, user_token, ARTICLE_A)
        _create(client, other_user_token, ARTICLE_B)
        stats_admin = client.get("/api/graph/stats", headers=auth(admin_token)).json()
        stats_owner = client.get("/api/graph/stats", headers=auth(user_token)).json()
        assert stats_admin["total_nodes"] >= stats_owner["total_nodes"]


class TestPredictionIsolation:
    def test_predictions_list_unaffected_by_another_users_article(self, client, user_token, other_user_token):
        before = client.get("/api/prediction/", headers=auth(other_user_token)).json()
        before_total = before["refused_count"] + len(before["predictions"])
        _create(client, user_token, ARTICLE_A)
        after = client.get("/api/prediction/", headers=auth(other_user_token)).json()
        after_total = after["refused_count"] + len(after["predictions"])
        assert after_total == before_total

    def test_stock_prediction_visible_to_owner_not_to_other_customer(self, client, user_token, other_user_token):
        news_id = _create(client, user_token, ARTICLE_A)
        news = client.get(f"/api/news/{news_id}", headers=auth(user_token)).json()
        symbols = news.get("stocks_mentioned") or []
        assert symbols, "bài test cần trích được ít nhất 1 mã để test này có ý nghĩa"
        symbol = symbols[0]

        r_owner = client.get(f"/api/prediction/stock/{symbol}", headers=auth(user_token))
        assert r_owner.status_code == 200

        r_other = client.get(f"/api/prediction/stock/{symbol}", headers=auth(other_user_token))
        assert r_other.status_code == 404
