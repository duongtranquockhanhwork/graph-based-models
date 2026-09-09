# FinNexus KG — Phân tích tin tức chứng khoán Việt Nam bằng Knowledge Graph

Ứng dụng web đọc bài báo tài chính tiếng Việt, nhận diện mã cổ phiếu / công ty /
ngành / sự kiện trong bài, dựng thành đồ thị tri thức, và chấm hướng phản ứng
giá sau tin bằng mô hình đã kiểm chứng.

> **Đây là công cụ nghiên cứu, không phải khuyến nghị đầu tư.** Hệ thống không
> sinh tín hiệu mua bán, và từ chối trả lời khi độ tin cậy nằm dưới ngưỡng vận
> hành. Xem [Ranh giới tuyên bố](#ranh-giới-tuyên-bố).

---

## Mục lục

- [Hệ thống làm gì](#hệ-thống-làm-gì)
- [Kiến trúc](#kiến-trúc)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Mô hình dự đoán](#mô-hình-dự-đoán)
- [Ranh giới tuyên bố](#ranh-giới-tuyên-bố)
- [Chạy hệ thống](#chạy-hệ-thống)
- [Chức năng](#chức-năng)
- [API](#api)
- [Test](#test)
- [Bảo mật](#bảo-mật)
- [Giới hạn đã biết](#giới-hạn-đã-biết)

---

## Hệ thống làm gì

Một nhà đầu tư cá nhân đọc hàng chục bài tin tài chính mỗi ngày và không có
công cụ nào tổng hợp: bài này nói về mã nào, thuộc loại sự kiện gì, tích cực hay
tiêu cực, các mã liên quan gián tiếp qua ngành là gì, và thị trường thường phản
ứng ra sao với loại tin này.

```
Bài báo (CSV / URL / nhập tay)
   ↓
Trích thực thể   mã cổ phiếu · công ty · ngành · sự kiện · cảm xúc
   ↓             (từ điển 57 mã + luật từ khoá tiếng Việt)
Knowledge Graph  quan hệ giữa tin, mã, công ty, ngành, sự kiện
   ↓
Mô hình dự đoán     → hướng abnormal return 3 phiên (±2%)
   ↓                     hoặc TỪ CHỐI TRẢ LỜI kèm lý do
Hiển thị         dự đoán + bằng chứng + đường đi trong đồ thị
```

---

## Kiến trúc

```
Trình duyệt (React 18 + Vite, code-split theo route)
   │  JWT trong localStorage, có token_version để thu hồi phiên
   ▼  nginx (production) proxy /api/
FastAPI
   ├── Bảo vệ ở tầng router: get_current_user / require_admin
   ├── Rate limit cho login, register, forgot-password, import, upload
   ├── url_guard  — chặn SSRF cho tính năng import từ URL
   │
   ├── nlp_service     từ điển + luật từ khoá tiếng Việt
   ├── graph_service   NetworkX DiGraph trong tiến trình (đồ thị hiển thị)
   ├── finnexus_service ──► repo nghiên cứu FinNexus KG (FINNEXUS_ROOT)
   │                        XGBoost · bảng giá · đồ thị tri thức
   └── vnstock         giá thị trường thời gian thực
   ▼
PostgreSQL
```

**Mô hình không nằm trong repo này.** Bảng giá, đồ thị tri thức và artifact cộng
lại ~51 MB và được cập nhật theo nhịp nghiên cứu. Nhân đôi chúng sẽ tạo ra hai
bản có thể lệch nhau, và bản lệch sẽ chấm điểm bằng dữ liệu cũ mà không báo lỗi.
Vì vậy `FINNEXUS_ROOT` trỏ tới một nguồn duy nhất.

Nếu `FINNEXUS_ROOT` để trống, hệ thống vẫn chạy: nó dùng bộ luật heuristic và
**nói rõ điều đó** trên giao diện, thay vì trình bày kết quả của bộ luật như
dự đoán của một mô hình.

---

## Cấu trúc thư mục

```
finnexus-kg-web/
├── backend/
│   ├── main.py                  điểm khởi động FastAPI
│   ├── app/
│   │   ├── core/                cấu hình, CSDL, JWT, rate limit, chặn SSRF, migrate, seed
│   │   ├── models/              bảng SQLAlchemy
│   │   ├── schemas/             hợp đồng dữ liệu vào/ra của API
│   │   ├── routers/             các endpoint HTTP
│   │   └── services/            nghiệp vụ (trích thực thể, đồ thị, chấm điểm, giá)
│   ├── ground_truth/            sinh nhãn "giá thật đã chạy thế nào" từ lịch sử giá
│   ├── data/
│   │   ├── stock_dictionary.json     từ điển 57 mã
│   │   └── knowledge_graph/
│   │       ├── exports/core/         đồ thị lõi đã xuất (nút + cạnh)
│   │       ├── exports/semantic/     lớp sự kiện ngữ nghĩa đã lọc chất lượng
│   │       ├── config/               ontology + giao thức đánh giá đồ thị
│   │       └── build_scripts/        mã dựng và kiểm định đồ thị (tham chiếu)
│   ├── tools/                   script chạy tay: nạp dữ liệu, bù nội dung bài
│   └── tests/                   pytest — phân quyền, SSRF, phiên đăng nhập, hợp đồng API
├── frontend/
│   ├── public/                  icon, favicon, manifest
│   └── src/
│       ├── pages/               mỗi trang trả lời một câu hỏi của người dùng
│       ├── pages/admin/         khu quản trị
│       ├── components/          khối giao diện dùng lại (biểu đồ, thẻ tin, bố cục)
│       ├── context/             trạng thái dùng chung (đăng nhập, bố cục, việc nền)
│       ├── hooks/               logic tái sử dụng (tự làm mới bảng giá)
│       └── types/               kiểu TypeScript khớp với schema backend
├── docker-compose.yml
└── README.md
```

**Vì sao không có "V56", "V4" trong tên thư mục.** Tên phiên bản là mã tra cứu
của quá trình nghiên cứu, không mô tả thứ nằm bên trong: đọc `SEMANTIC_V4/`
không ai đoán được đó là lớp sự kiện đã lọc chất lượng. Trong repo ứng dụng này
mọi thư mục được đặt theo *nội dung*.

Ngược lại, **repo nghiên cứu `FinNexus KG` giữ nguyên tên phiên bản** (V17, V39,
V48, V56, V76). Ở đó chúng là dòng dõi bằng chứng: `docs/thesis/*.md` và
`claim_evidence_matrix.csv` trích dẫn đúng những mã đó để chỉ ra mỗi kết luận
dựa trên thí nghiệm nào. Đổi tên chúng sẽ cắt đứt liên kết giữa tuyên bố và bằng
chứng — thứ làm cho phần nghiên cứu có thể bảo vệ được.

---

## Mô hình dự đoán

`FINNEXUS_V56_DEPLOYABLE_MODEL_V1` — XGBoost, 33 đặc trưng thị trường trước sự
kiện, 3 lớp `POSITIVE` / `NEUTRAL` / `NEGATIVE`.

**Biến mục tiêu:** hướng abnormal return 3 phiên, đã điều chỉnh theo chỉ số sàn,
với ngưỡng cố định ±2%. Đây là kết quả thị trường thật, **không** suy ra từ nhãn
cảm xúc — nên huấn luyện và đánh giá trên nó không vòng tròn.

| Chỉ số | Giá trị | Dùng làm bằng chứng? |
|---|---:|---|
| Macro-F1 out-of-fold | 0.3995 | **Có** |
| Baseline một biến trước sự kiện | 0.3533 | Có |
| **Chênh lệch** | **+0.0462** | KTC hiệu chỉnh [+0.0180; +0.0745] |
| Macro-F1 in-sample | 0.4826 | **Không** — fit và chấm trên cùng dữ liệu |
| Accuracy vượt lớp đa số | **Không** | Ưu thế nằm ở recall lớp thiểu số |

Xác nhận trên tập test dùng-một-lần (2026-09-02): Δ +0.0727, KTC [+0.0201; +0.1191].

**Điểm vận hành.** Dưới độ tin cậy **0.4425**, hệ thống trả `ABSTAIN` thay vì
đưa ra một dự đoán yếu. Trên dữ liệu phát triển, ngưỡng này phủ 40% số ca. Giao
diện **hiển thị đầy đủ** các ca bị từ chối — "chưa đủ tin cậy để trả lời" là một
trạng thái chính của sản phẩm, không phải lỗi cần giấu.

Mọi con số ở bảng trên được phục vụ tại `GET /api/prediction/model-info`, và giao
diện đọc từ đó. Không có con số hiệu năng nào được viết cứng trong mã nguồn hay
trong tài liệu này mà không có nguồn.

---

## Ranh giới tuyên bố

Đọc kỹ phần này trước khi diễn giải bất kỳ đầu ra nào.

- **Không phải khuyến nghị đầu tư.** `tradeable: false` trên mọi phản hồi. Cổng
  hành động BUY hiện **không thể đạt được**: 6/8 cổng chính sách chưa đạt, và hệ
  thống báo cáo đúng trạng thái bằng chứng đó thay vì để trống chờ sẵn.
- **Không xếp hạng mức độ ảnh hưởng.** Ở bài toán xếp hạng "mã nào bị ảnh hưởng
  mạnh nhất trong bài", mô hình **không vượt baseline** (AUC cặp 0.5973). Vì vậy
  hệ thống nêu chủ thể của bài viết, không xếp hạng.
- **Không phải tuyên bố nhân quả.** Biến mục tiêu là quan hệ quan sát được giữa
  tin và biến động giá sau đó, không phải quan hệ nhân quả.
- **Không dự đoán giá.** Mô hình dự đoán *hướng* của abnormal return so với một
  ngưỡng cố định, không dự đoán mức giá.
- **Tổng hợp ở cấp mã là theo luật.** `/api/prediction/stock/{symbol}` gộp các
  tin gần đây bằng một hàm cộng điểm viết tay — mô hình chấm theo cặp bài–mã tại
  một thời điểm, nó không có khái niệm "xu hướng chung của một mã". Kết quả này
  được đánh dấu `engine: "heuristic"` và giao diện cảnh báo tương ứng.

---

## Chạy hệ thống

### Yêu cầu

- Docker + Docker Compose, hoặc Python 3.11+ và Node 20+
- Repo nghiên cứu [FinNexus KG](../FinNexus%20KG) nếu muốn dùng mô hình dự đoán

### Docker (khuyến nghị)

```bash
cp .env.example .env
```

Điền hai giá trị **bắt buộc** trong `.env` — compose sẽ từ chối khởi động nếu thiếu:

```bash
# Sinh JWT secret
python -c "import secrets; print(secrets.token_hex(32))"
```

```ini
POSTGRES_PASSWORD=<mật khẩu bạn chọn>
JWT_SECRET_KEY=<chuỗi vừa sinh>
FINNEXUS_ROOT=../FinNexus KG
```

```bash
docker compose up -d --build
```

| Dịch vụ | Địa chỉ |
|---|---|
| Giao diện | http://localhost:3000 |
| API | http://localhost:8000 |
| API docs | http://localhost:8000/docs *(tự động tắt khi `ENVIRONMENT=production`)* |

### Chạy từng phần (development)

```bash
# Backend
cd backend
pip install -r requirements.txt
export DATABASE_URL="sqlite:///./dev.db"
export JWT_SECRET_KEY="chuoi-bat-ky-cho-dev"
export FINNEXUS_ROOT="../../FinNexus KG"
uvicorn main:app --reload --port 8000

# Frontend (cửa sổ khác)
cd frontend
cp .env.example .env
npm install
npm run dev
```

Dev server proxy `/api` tới `http://localhost:8000` theo mặc định. Đổi bằng
`VITE_API_TARGET` trong `frontend/.env`.

### Tài khoản

Tài khoản test **chỉ được tạo khi `ENVIRONMENT` khác `production`**:

| Email | Mật khẩu | Vai trò |
|---|---|---|
| `admin@finnexus.dev` | `Test@123456` | admin |
| `test1@finnexus.dev` | `Test@123456` | customer |
| `test2@finnexus.dev` | `Test@123456` | customer |

Trong production, tạo quản trị viên đầu tiên bằng tay. Không có tài khoản mặc
định nào được seed, và `ENVIRONMENT=production` với `JWT_SECRET_KEY` mặc định sẽ
làm ứng dụng **từ chối khởi động**.

### Dữ liệu mẫu

Đăng nhập → **Nhập dữ liệu** → tải `frontend/public/sample_news.csv`.

---

## Chức năng

### Người dùng

Điều hướng gom theo **câu hỏi người dùng đang hỏi**, không theo bảng dữ liệu.
Bản trước có 11 mục phẳng, trong đó ba mục (Tin tức / Sự kiện tài chính / Phân
tích cảm xúc) đọc cùng bảng `news_articles` và chỉ khác bộ lọc chạy trong trình
duyệt, còn Cổ phiếu và Bảng giá Live cùng liệt kê mã mà không dẫn sang nhau.

| Nhóm | Trang | Trả lời câu hỏi |
|---|---|---|
| **Theo dõi** | Tổng quan | Hôm nay thị trường có gì? Mỗi ô số liệu, mỗi lát cắt cảm xúc, mỗi ngành đều là một liên kết dẫn tới đúng lát cắt đó. |
| | **Dòng tin** | Tin nào đáng đọc? Gộp ba trang cũ. Lọc bằng facet (cảm xúc · 9 loại sự kiện · mã · nguồn), chạy trên server và **phản ánh vào URL** nên chia sẻ và bấm Back đều đúng. |
| | **Cổ phiếu** | Mã nào đáng chú ý? Hai tab: *Đang theo dõi* (bảng giá thời gian thực) và *Tất cả mã* (số tin, phân bố cảm xúc). Mọi dòng dẫn tới hồ sơ mã. |
| **Khám phá** | Knowledge Graph | Các mã liên quan nhau thế nào? Đồ thị 2D/3D, lọc theo mã hoặc ngành. |
| | Bằng chứng mô hình | Có đáng tin không? Hiệu năng chính thức kèm baseline, và phần đo lại trên dữ liệu của bạn. |
| **Dữ liệu** | Nhập dữ liệu | CSV · URL · thủ công. Phân tích chạy nền; thanh trên cùng hiện tiến trình ở mọi trang, xong thì báo kèm đường dẫn tới kết quả. |
| | Cài đặt | Hồ sơ cá nhân và giao diện. |

**Hồ sơ mã** (`/stocks/:symbol`) là điểm hội tụ. Trước đây thông tin về một mã
nằm rải ở bốn nơi và không nơi nào dẫn sang nơi kia; hồ sơ công ty, cổ đông và
báo cáo tài chính thì chỉ xem được trong một cửa sổ bật lên không chia sẻ được
đường dẫn. Nay một trang gồm: giá thời gian thực và nút theo dõi · biểu đồ giá
tương tác · từng bài báo hệ thống đã nhận định cho mã này kèm đường đi trong đồ
thị · mã lân cận · tin liên quan · và tab chi tiết doanh nghiệp (sổ lệnh, hồ sơ,
thống kê, cổ đông, vốn và cổ tức, lịch sự kiện, tài chính).

**Biểu đồ giá** có 5 kiểu hiển thị (nến, thanh OHLC, đường, vùng, cột), MA20/MA50
và khối lượng, cùng các thao tác quen thuộc của một bảng giá: lăn chuột phóng to
quanh vị trí con trỏ · kéo ngang để trượt thời gian · nhấp đúp xem lại toàn bộ ·
chụm hai ngón trên điện thoại · crosshair hiện mức giá theo con trỏ · dải tổng
quan bên dưới để chọn khoảng. Trục giá tự bám vùng đang xem, còn đường trung
bình động luôn tính trên toàn bộ chuỗi nên không bị đứt ở mép trái khi phóng to.

**Mắt xích nối các trang:** mọi mã cổ phiếu xuất hiện ở bất kỳ đâu đều là một
liên kết tới hồ sơ mã; mọi nhãn sự kiện và cảm xúc đều lọc được dòng tin.
Đường dẫn cũ (`/news`, `/events`, `/sentiment`, `/prediction`, `/live`) vẫn
chuyển hướng đúng chỗ.

### Quản trị (`/admin/*`)

Gom theo việc quản trị viên thực sự làm, không theo bảng dữ liệu. Bản trước có
10 mục phẳng trong đó 9 mục không có liên kết đi tiếp nào.

| Nhóm | Trang | Nội dung |
|---|---|---|
| **Vận hành** | Tổng quan | Phễu xử lý dữ liệu, chất lượng, nhật ký. Mỗi cảnh báo là một liên kết dẫn thẳng tới nơi khắc phục nó. |
| | Dữ liệu tin tức | Nhập, sửa, xoá, phân tích lại. |
| | Gán nhãn | Hàng chờ những bài mô hình không đủ chắc chắn. Ô nhãn để trống và dự đoán bị ẩn cho tới khi người gán nhãn chủ động mở. |
| **Chất lượng** | Chất lượng dữ liệu | Gộp *Kiểm định dữ liệu* + *Kết quả kiểm định* — hai trang cũ cùng đọc `validation_service` và cùng trả lời một câu hỏi. Nối tới hai đòn bẩy thay đổi được kết quả: gán nhãn và cấu hình. |
| | Cấu hình phân tích | Gộp *Cấu hình hệ thống* + *Từ khoá sự kiện* — cả hai đều thay đổi cách phân tích diễn giải bài báo. Mỗi ngưỡng nói rõ đổi nó thì cái gì thay đổi ở đâu. |
| **Hệ thống** | Người dùng · Cổ phiếu · Hồ sơ của tôi | Phân quyền, bảng giá, thông tin cá nhân. |

*Quản lý cổ phiếu* đã bị gỡ: nó là bảng chỉ-đọc từ cùng service với trang Cổ
phiếu, không có thao tác quản trị nào, và kém hơn trang Cổ phiếu đã có.

Đường dẫn cũ (`/admin/data-validation`, `/admin/validation-results`,
`/admin/keywords`, `/admin/settings`, `/admin/stocks`) vẫn chuyển hướng đúng chỗ.

---

## API

Toàn bộ `/api/*` (trừ `/api/auth/*`) yêu cầu `Authorization: Bearer <token>`.
`/api/admin/*` yêu cầu vai trò admin.

| Method | Endpoint | Ghi chú |
|---|---|---|
| `POST` | `/api/auth/register` · `/login` · `/google` | có rate limit |
| `POST` | `/api/auth/change-password` | thu hồi mọi token cũ, trả token mới |
| `POST` | `/api/auth/forgot-password` · `/reset-password` | link reset dùng **một lần** |
| `GET` | `/api/news/` | lọc `q`, `source`, `sentiment`, `event_type`, `stock`, `date_from`, `date_to` |
| `POST` | `/api/news/upload-csv` · `/import-url` | giới hạn dung lượng và số dòng; import URL chặn địa chỉ nội bộ |
| `POST` | `/api/news/analysis-status` | tiến trình phân tích nền của một lô bài vừa nhập |
| `DELETE` | `/api/news/{id}` | **admin** |
| `POST` | `/api/news/{id}/analyze` · `/analyze-all` | **admin** |
| `GET` | `/api/graph/` · `/stats` · `/stock/{symbol}/features` | dữ liệu đồ thị |
| `GET` | `/api/prediction/model-info` | **nguồn duy nhất** cho mọi con số hiệu năng |
| `POST` | `/api/prediction/score` | chấm thử một bài, không lưu; trả cả trạng thái từ chối |
| `GET` | `/api/prediction/evaluate` | đo trên nhãn giá thật, luôn kèm baseline |
| `GET` | `/api/watchlist/` · `/live` | watchlist và giá thời gian thực |
| `GET` | `/api/stock-detail/{symbol}/…` | lịch sử, khớp lệnh, hồ sơ, cổ đông, tài chính |

Kết quả `POST /api/prediction/score` khi mô hình từ chối:

```json
{
  "status": "REFUSED",
  "stage": "link",
  "reason": "no_symbol_found",
  "message": "Không nhận ra mã cổ phiếu nào thuộc từ điển 257 mã của mô hình."
}
```

Từ chối là **kết quả**, không phải sự cố. Nó trả về `200`, không phải `500`.

---

## Test

```bash
cd backend && pytest          # 42 test
cd frontend && npx tsc --noEmit && npm run build
```

Bộ test tập trung vào các bất biến dễ vỡ nhất, không nhằm đạt độ phủ:

- Phân quyền: người dùng thường không xoá được dữ liệu của người khác
- Chặn SSRF: loopback, link-local, IP riêng, scheme không phải http(s)
- Thông điệp lỗi không lộ chi tiết upstream (chống dò quét mạng nội bộ)
- Đổi mật khẩu thu hồi token cũ; link reset dùng một lần
- Rate limit thực sự chặn
- **Mô hình từ chối không được biến thành dự đoán** — `predicted_trend` phải là
  `None`, không được âm thầm rơi về heuristic
- Ground truth không bao giờ lấy từ nhãn cảm xúc gán tay
- Đánh giá luôn kèm baseline
- Bảng kiểm định chỉ báo ĐẠT khi tất cả phép kiểm tra đều đạt

CI (`.github/workflows/ci.yml`) chạy pytest, typecheck, build, và một kiểm tra
riêng rằng cấu hình `production` từ chối JWT secret mặc định.

---

## Bảo mật

| Hạng mục | Cách xử lý |
|---|---|
| Mật khẩu | bcrypt; tối thiểu 10 ký tự, ≥2 loại ký tự, chặn danh sách phổ biến |
| Phiên | JWT + `token_version`; đổi/đặt lại mật khẩu thu hồi mọi phiên cũ |
| Reset mật khẩu | token dùng một lần, hết hạn 30 phút |
| Rate limit | login, register, forgot-password, import URL, upload |
| SSRF | chỉ http(s); từ chối IP riêng/loopback/link-local; kiểm tra lại ở mỗi chặng redirect; giới hạn dung lượng; không trả lỗi upstream |
| CORS | chỉ origin của giao diện; method và header liệt kê cụ thể |
| Phân quyền | ở tầng router, không rải rác từng handler |
| Bí mật | `ENVIRONMENT=production` từ chối khởi động nếu `JWT_SECRET_KEY` còn mặc định hoặc ngắn hơn 32 ký tự |
| Container | không chạy root, không `--reload`, không mount đè mã nguồn |
| API docs | tự động tắt trong production |

---

## Giới hạn đã biết

Ghi ra để không ai phải tự phát hiện.

- **Migration viết tay.** `app/core/migrate.py` bổ sung cột và index còn thiếu.
  Nó không có version và không lùi lại được. Nên chuyển sang Alembic.
- **Đồ thị hiển thị nằm trong RAM tiến trình.** Mất khi khởi động lại (được dựng
  lại từ CSDL), và không chia sẻ giữa nhiều worker. Đồ thị dùng cho dự đoán thì
  nằm trong repo nghiên cứu và không bị ảnh hưởng.
- **Rate limit đếm trong RAM.** Chạy N worker thì hạn mức thực tế nhân N. Thay
  `_MemoryBackend` bằng Redis khi triển khai nhiều worker.
- **`betweenness_centrality` tính lại mỗi lần.** Ở quy mô hàng chục nghìn bài,
  nên tính theo lịch và cache thay vì tính trong luồng phân tích.
- **Cache giá thị trường theo tiến trình.** N worker = N lần gọi vnstock.
- **Chưa có thu thập tin tự động.** Người dùng phải tự nhập CSV hoặc dán link.
- **Chỉ số gán nhãn có sai lệch chọn mẫu.** Hàng chờ gán nhãn chỉ nhận bài mô
  hình kém chắc chắn, nên độ chính xác đo trên đó không đại diện cho toàn bộ dữ
  liệu. API trả về kèm ghi chú này.

---

## Giấy phép

Xem [LICENSE](LICENSE). Dữ liệu và mô hình từ repo nghiên cứu FinNexus KG tuân
theo giấy phép riêng của repo đó.
