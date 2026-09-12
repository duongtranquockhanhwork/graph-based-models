"""Import URL phải từ chối khi không trích được nội dung bài viết.

Trước bản vá này, một URL không phải trang bài báo (trang tra cứu mã chứng
khoán, trang danh mục, trang chủ...) vẫn được lưu thành một "bài báo" rỗng,
rồi bộ chấm điểm coi "không có từ khoá" là TRUNG LẬP — trông như hệ thống
chấm sai trong khi thực ra chẳng có gì để chấm. Giờ trường hợp này phải bị
chặn ở bước import, không lưu bài rỗng.
"""

from unittest.mock import patch

from app.routers.news import _strip_leading_metadata
from tests.conftest import auth

NOT_AN_ARTICLE_HTML = """
<html><head><title>VCB - Dữ liệu mã chứng khoán</title></head>
<body>
  <nav>Menu</nav>
  <div class="stock-quote"><span>72.7</span><span>+0.5</span></div>
  <footer>Footer</footer>
</body></html>
"""

REAL_ARTICLE_HTML = """
<html><head><title>Bài báo test</title></head>
<body>
  <h1 class="title-detail">VCB báo lãi kỷ lục quý 3</h1>
  <article class="fck_detail">
    <p>Ngân hàng Vietcombank vừa công bố kết quả kinh doanh quý 3 với lợi nhuận tăng mạnh so với cùng kỳ.</p>
    <p>Đây là mức lãi cao nhất trong lịch sử hoạt động của ngân hàng này, vượt xa kỳ vọng của giới phân tích.</p>
  </article>
</body></html>
"""


class TestImportUrlRejectsNonArticlePages:
    def test_page_with_no_extractable_content_is_rejected(self, client, user_token):
        with patch(
            "app.routers.news.safe_get",
            return_value=(NOT_AN_ARTICLE_HTML, "https://cafef.vn/du-lieu/hose/vcb.chn"),
        ):
            r = client.post(
                "/api/news/import-url",
                headers=auth(user_token),
                json={"url": "https://cafef.vn/du-lieu/hose/vcb.chn"},
            )
        assert r.status_code == 400
        assert "không trích xuất được nội dung" in r.json()["detail"].lower()

    def test_rejected_import_does_not_create_a_news_row(self, client, user_token, admin_token):
        with patch(
            "app.routers.news.safe_get",
            return_value=(NOT_AN_ARTICLE_HTML, "https://cafef.vn/du-lieu/hose/vcb.chn"),
        ):
            client.post(
                "/api/news/import-url",
                headers=auth(user_token),
                json={"url": "https://cafef.vn/du-lieu/hose/vcb.chn"},
            )
        listing = client.get("/api/news/", headers=auth(admin_token))
        titles = [n["title"] for n in listing.json()]
        assert "VCB - Dữ liệu mã chứng khoán" not in titles

    def test_real_article_page_is_still_accepted(self, client, user_token):
        with patch(
            "app.routers.news.safe_get",
            return_value=(REAL_ARTICLE_HTML, "https://cafef.vn/vcb-bao-lai-ky-luc.chn"),
        ):
            r = client.post(
                "/api/news/import-url",
                headers=auth(user_token),
                json={"url": "https://cafef.vn/vcb-bao-lai-ky-luc.chn"},
            )
        assert r.status_code == 200, r.text
        assert r.json()["title"] == "VCB báo lãi kỷ lục quý 3"

    def test_stored_url_is_exposed_in_the_article_response(self, client, user_token):
        """NewsResponse từng thiếu hẳn trường url — "Đọc bài gốc" ở giao diện
        luôn nhận None dù cột url trong DB có giá trị, vì response model
        chưa bao giờ khai báo trường này."""
        source_url = "https://cafef.vn/vcb-bao-lai-ky-luc.chn"
        with patch("app.routers.news.safe_get", return_value=(REAL_ARTICLE_HTML, source_url)):
            created = client.post(
                "/api/news/import-url",
                headers=auth(user_token),
                json={"url": source_url},
            )
        news_id = created.json()["id"]

        get_one = client.get(f"/api/news/{news_id}", headers=auth(user_token))
        assert get_one.json()["url"] == source_url

        listed = client.get("/api/news/", headers=auth(user_token)).json()
        found = next(n for n in listed if n["id"] == news_id)
        assert found["url"] == source_url


class TestStripLeadingMetadata:
    """vietstock.vn (và các trang tương tự) chèn tiêu đề + ngày đăng LẶP LẠI
    ngay trong khối chứa nội dung, trước đoạn văn thật — get_text() gom hết
    vào một khối, khiến người đọc thấy tiêu đề/ngày lặp 2 lần trước khi vào
    nội dung thật."""

    def test_strips_duplicated_title_and_date_lines(self):
        title = "Giá căn hộ dễ chịu hơn, người mua vẫn lo ngại một điều"
        raw = (
            f"{title}\n"
            "12/09/2026 08:44\n"
            "12-09-2026 08:44:46+07:00\n"
            f"{title}\n"
            "Giá đã hạ nhưng người mua vẫn chưa vội xuống tiền."
        )
        cleaned = _strip_leading_metadata(raw, title)
        assert cleaned == "Giá đã hạ nhưng người mua vẫn chưa vội xuống tiền."

    def test_leaves_normal_content_untouched(self):
        title = "Tiêu đề bài báo"
        raw = "Đoạn văn đầu tiên không liên quan gì tới tiêu đề hay ngày tháng."
        assert _strip_leading_metadata(raw, title) == raw

    def test_import_url_stores_cleaned_content(self, client, user_token):
        title = "VCB báo lãi kỷ lục quý 3"
        html = f"""
        <html><head><title>{title}</title></head>
        <body>
          <h1 class="title-detail">{title}</h1>
          <article class="fck_detail">
            <p>{title}</p>
            <p>12/09/2026 08:44</p>
            <p>Ngân hàng Vietcombank vừa công bố kết quả kinh doanh quý 3 với lợi nhuận tăng mạnh so với cùng kỳ.</p>
            <p>Đây là mức lãi cao nhất trong lịch sử hoạt động của ngân hàng này, vượt xa kỳ vọng của giới phân tích.</p>
          </article>
        </body></html>
        """
        with patch(
            "app.routers.news.safe_get",
            return_value=(html, "https://vietstock.vn/vcb-bao-lai-ky-luc.htm"),
        ):
            r = client.post(
                "/api/news/import-url",
                headers=auth(user_token),
                json={"url": "https://vietstock.vn/vcb-bao-lai-ky-luc.htm"},
            )
        assert r.status_code == 200, r.text
        stored = client.get(f"/api/news/{r.json()['id']}", headers=auth(user_token)).json()
        assert not stored["content"].startswith(title)
        assert "12/09/2026" not in stored["content"]
        assert stored["content"].startswith("Ngân hàng Vietcombank")
