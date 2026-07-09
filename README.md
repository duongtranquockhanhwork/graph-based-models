# FinNexus KG — Hệ thống phân tích tin tức chứng khoán Việt Nam bằng Knowledge Graph

> **Graph-based Models for Prediction and Knowledge Discovery**
> 
> Hệ thống phân tích tin tức chứng khoán Việt Nam, xây dựng Knowledge Graph để khám phá tri thức và dự đoán xu hướng cổ phiếu.

---

## Mục lục

- [Tổng quan](#tổng-quan)
- [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Chức năng chính](#chức-năng-chính)
- [Knowledge Graph Schema](#knowledge-graph-schema)
- [Cài đặt và chạy](#cài-đặt-và-chạy)
- [API Documentation](#api-documentation)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Demo Flow](#demo-flow)
- [Đánh giá mô hình](#đánh-giá-mô-hình)
- [Nhóm thực hiện](#nhóm-thực-hiện)

---

## Tổng quan

**FinNexus KG** là hệ thống thông minh hỗ trợ phân tích tin tức chứng khoán Việt Nam theo hướng tiếp cận dựa trên đồ thị tri thức (Knowledge Graph). Hệ thống không chỉ phân tích từng bài báo riêng lẻ mà còn xây dựng mạng lưới quan hệ giữa các thực thể: tin tức, mã cổ phiếu, công ty, ngành nghề và sự kiện tài chính.

### Vấn đề giải quyết

Nhà đầu tư hàng ngày phải đọc hàng chục bài báo tài chính, khó biết tin nào ảnh hưởng đến mã nào, và khó nhận ra mối liên hệ gián tiếp giữa các cổ phiếu. FinNexus KG giải quyết bằng cách:

- Tự động trích xuất thực thể từ tin tức tiếng Việt
- Xây dựng Knowledge Graph kết nối tin tức - cổ phiếu - ngành - sự kiện
- Dự đoán xu hướng cổ phiếu kết hợp NLP và graph features
- Trực quan hóa mạng tri thức dưới dạng 3D interactive graph

---

## Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│                     FinNexus KG System                      │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────┐ │
│  │   Frontend   │    │   Backend    │    │   Databases   │ │
│  │              │◄──►│              │◄──►│               │ │
│  │ React + Vite │    │   FastAPI    │    │  PostgreSQL   │ │
│  │ Tailwind CSS │    │   Python     │    │   (tin tức)   │ │
│  │ ForceGraph3D │    │              │    │               │ │
│  │  Recharts    │    │  NLP Engine  │    │    Neo4j      │ │
│  └──────────────┘    │  Graph Build │    │  (graph DB)   │ │
│                      │  ML Predict  │    └───────────────┘ │
│                      └──────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

### Pipeline xử lý dữ liệu

```
Tin tức (CSV/Manual)
        │
        ▼
  Text Preprocessing
  (Làm sạch, chuẩn hóa tiếng Việt)
        │
        ▼
  Entity Extraction
  (Stock, Company, Industry, Event)
        │
        ├──► Sentiment Analysis ──► Positive / Negative / Neutral
        │
        ▼
  Knowledge Graph Construction
  (NetworkX + Neo4j)
        │
        ├──► Graph Feature Extraction
        │    (Centrality, Mention Freq, Sentiment Ratio)
        │
        ▼
  Trend Prediction Model
  (Text Features + Graph Features)
        │
        ▼
  Dashboard Visualization
  (3D Graph + Charts + Explanation)
```

---

## Công nghệ sử dụng

| Layer | Công nghệ |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS |
| **3D Graph** | react-force-graph-3d, Three.js |
| **Charts** | Recharts |
| **Backend** | FastAPI, Python 3.11 |
| **NLP** | underthesea, Rule-based + Keyword matching |
| **Graph Analytics** | NetworkX |
| **Main DB** | PostgreSQL 15 |
| **Graph DB** | Neo4j 5 Community |
| **ML** | scikit-learn |
| **Container** | Docker, Docker Compose |

---

## Chức năng chính

Giao diện khách hàng (role `customer`) có 9 mục điều hướng, phản ánh đúng cấu trúc trang trong ảnh thiết kế:

### 1. Tổng quan (`/dashboard`)
- Thống kê tổng số tin tức, mã cổ phiếu, công ty
- Biểu đồ phân bố Sentiment (Positive/Negative/Neutral)
- Top cổ phiếu được nhắc đến nhiều nhất
- Xu hướng dự đoán thị trường
- Timeline số lượng tin theo ngày

### 2. Tin tức (`/news`)
- Danh sách tin tức kèm kết quả phân tích NLP (mã cổ phiếu, ngành, sự kiện, sentiment, impact score, lý do dự đoán)
- Tìm kiếm, lọc theo trạng thái đã/chưa phân tích
- Nút "Nhập dữ liệu" dẫn tới trang Import (CSV / URL / thủ công), giữ nguyên toàn bộ luồng import cũ

### 3. Cổ phiếu (`/stocks`, `/stocks/:symbol`)
- Danh mục mã cổ phiếu theo dõi kèm số lần nhắc đến và tỷ lệ sentiment thực tế
- Trang chi tiết từng mã: dự đoán xu hướng + độ tin cậy, đặc trưng Knowledge Graph (degree/betweenness centrality, mention frequency), phân bố sentiment, danh sách tin tức liên quan — dùng dữ liệu thật, không có biểu đồ giá vì hệ thống chưa tích hợp nguồn dữ liệu giá thị trường

### 4. Sự kiện tài chính (`/events`)
- Tổng hợp các sự kiện được NLP nhận diện tự động (lợi nhuận tăng/giảm, chia cổ tức, sáp nhập, ký hợp đồng, xử phạt, thay đổi lãnh đạo, phát hành cổ phiếu, mở rộng đầu tư...)
- Lọc tin tức theo từng loại sự kiện

### 5. Phân tích cảm xúc (`/sentiment`)
- Phân bố sentiment tổng thể, theo từng cổ phiếu, và theo thời gian (30 ngày gần nhất)

### 6. Dự đoán xu hướng (`/prediction`)
- Dự đoán: **INCREASING / DECREASING / UNCHANGED**
- Tìm kiếm theo mã cổ phiếu cụ thể
- Hiển thị độ tin cậy (confidence %)
- Giải thích chi tiết các yếu tố ảnh hưởng

### 7. Knowledge Graph 3D (`/graph`, Điểm nổi bật)
- Đồ thị 3D/2D tương tác: kéo, xoay, zoom
- Node phân loại bằng màu sắc:
  - 🔵 Xanh dương: Tin tức (News)
  - 🟢 Xanh lá: Cổ phiếu (Stock)
  - 🟣 Tím: Công ty (Company)
  - 🟡 Vàng: Ngành nghề (Industry)
  - 🔴 Đỏ: Sự kiện (Event)
  - 🟠 Cam: Sentiment
- Kích thước node = Degree Centrality
- Lọc theo mã cổ phiếu
- Click node xem thông tin chi tiết

### 8. Báo cáo (`/reports`)
- So sánh Baseline (text only) vs Graph-enhanced
- Accuracy, Precision, Recall, F1 Score
- Confusion Matrix trực quan
- Danh sách 6 graph features được sử dụng

### 9. Cài đặt (`/settings`)
- Hồ sơ cá nhân (avatar, tên, email, vai trò)
- **Chuyển đổi giao diện Sáng/Tối** — mặc định Sáng, lựa chọn được lưu lại trên trình duyệt (`localStorage`), áp dụng cho toàn bộ ứng dụng kể cả Admin Console
- Lối tắt đổi mật khẩu

### 10. Admin Console (`/admin/*`, chỉ tài khoản role `admin`)
Giao diện quản trị riêng biệt (sidebar accent xanh lá, tách hoàn toàn khỏi giao diện khách hàng), gồm 9 trang, tất cả đều dùng dữ liệu thật từ pipeline NLP/graph/prediction hiện có — không có trang nào dùng dữ liệu giả lập:

| Trang | Chức năng |
|-------|-----------|
| Dashboard | Thống kê pipeline (news-symbol rows, model-ready, PASS/REVIEW/DROP), chất lượng dữ liệu, phân bố nhãn/cảm xúc, nhật ký hoạt động, cảnh báo hệ thống |
| Quản lý tin tức | Bảng tin tức đầy đủ: tìm kiếm/lọc theo nguồn/sentiment/ngày, sửa nhanh, phân tích lại, xoá, thêm tin thủ công, import CSV |
| Quản lý cổ phiếu | Danh mục 25 mã cổ phiếu (từ `stock_dictionary.json`) kèm số lần được nhắc đến và phân bố sentiment thực tế — chỉ xem, không chỉnh sửa (danh mục được quản lý qua file JSON) |
| Quản lý từ khoá sự kiện | CRUD từ điển cụm từ nhận diện sự kiện tài chính dùng bởi `nlp_service` — sửa/thêm/xoá có hiệu lực ngay từ lần phân tích tiếp theo, không cần khởi động lại backend |
| Kiểm định dữ liệu | Missing values, bản ghi trùng lặp, Return-Label Consistency (tính theo chiều hướng sentiment↔xu hướng), trạng thái PASS/FAIL tổng thể |
| Gán nhãn thủ công | Hàng chờ các tin có độ tin cậy dự đoán thấp (dưới ngưỡng cấu hình), cho phép admin xác nhận sentiment/sự kiện đúng |
| Kết quả kiểm định | Độ chính xác của NLP tự động so với nhãn đã được admin xác nhận thủ công (Accuracy Sentiment, Accuracy Event) |
| Quản lý người dùng | Danh sách tài khoản, đổi vai trò customer/admin, khoá/mở tài khoản (không cho tự khoá/hạ quyền admin cuối cùng) |
| Cấu hình hệ thống | Ngưỡng phân loại sentiment (positive/negative) và ngưỡng đưa bài vào hàng chờ gán nhãn thủ công |

---

## Knowledge Graph Schema

### Node Types

| Node | Thuộc tính | Ví dụ |
|------|-----------|-------|
| `News` | id, title, date, source | News #1 |
| `Stock` | symbol, company, industry | FPT |
| `Company` | name | Công ty Cổ phần FPT |
| `Industry` | name | Công nghệ |
| `Event` | type | Profit Growth |
| `Sentiment` | label | Positive |

### Edge Types (Quan hệ)

| Quan hệ | Từ | Đến | Ý nghĩa |
|---------|-----|-----|---------|
| `mentions` | News | Stock | Tin tức nhắc đến cổ phiếu |
| `represents` | Stock | Company | Cổ phiếu đại diện công ty |
| `belongs_to` | Stock | Industry | Cổ phiếu thuộc ngành |
| `contains_event` | News | Event | Tin tức chứa sự kiện |
| `has_sentiment` | News | Sentiment | Cảm xúc của tin |
| `affects` | Event | Stock | Sự kiện tác động đến cổ phiếu |
| `same_industry` | Stock | Stock | Cùng ngành |

---

## Cài đặt và chạy

### Yêu cầu
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac/Linux)
- Docker Compose v2+
- Git

### Chạy với Docker (Khuyến nghị)

```bash
# 1. Clone repository
git clone https://github.com/your-username/finnexus-kg.git
cd finnexus-kg

# 2. Tạo file .env
cp .env.example .env

# 3. Build và khởi động tất cả services
docker compose up --build

# Lần sau (đã build rồi)
docker compose up
```

Sau khi chạy xong (khoảng 2-3 phút):

| Service | URL | Mô tả |
|---------|-----|-------|
| **Frontend** | http://localhost:3000 | Giao diện web |
| **Backend API** | http://localhost:8000 | FastAPI |
| **API Docs** | http://localhost:8000/docs | Swagger UI |
| **Neo4j Browser** | http://localhost:7474 | Graph database UI |

### Import dữ liệu mẫu

Sau khi hệ thống chạy, import file CSV mẫu để test ngay:

1. Vào trang **Nhập tin tức** (Import)
2. Upload file `backend/data/sample_news.csv`
3. Hệ thống sẽ tự động phân tích (khoảng 5-10 giây)
4. Xem kết quả ở các trang còn lại

### Tài khoản test

Hệ thống có 2 vai trò: **customer** (nhà đầu tư — dùng Dashboard/Tin tức/Knowledge Graph/Dự đoán) và **admin** (quản trị hệ thống — dùng Admin Console riêng). Các tài khoản mẫu sau được **tự động seed khi backend khởi động** (kể cả trên database đã tồn tại từ trước, không cần `docker compose down -v`):

| Email | Mật khẩu | Vai trò | Ghi chú |
|-------|----------|---------|---------|
| `admin@finnexus.dev` | `Test@123` | `admin` | Đăng nhập sẽ vào thẳng `/admin/dashboard` |
| `test1@finnexus.dev` | `Test@123` | `customer` | Tài khoản khách hàng test 1 |
| `test2@finnexus.dev` | `Test@123` | `customer` | Tài khoản khách hàng test 2 |

Muốn tạo thêm tài khoản khách hàng, đăng ký qua trang `/register` hoặc:

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"someone@finnexus.dev","password":"Test@123","full_name":"Someone"}'
```

Tài khoản đăng ký qua `/register` luôn nhận vai trò `customer`; muốn nâng lên `admin`, dùng trang **Quản lý người dùng** trong Admin Console (cần đã đăng nhập bằng một tài khoản admin khác).

### Dừng hệ thống

```bash
docker compose down          # Dừng, giữ data
docker compose down -v       # Dừng + xoá toàn bộ data
```

### Chạy riêng từng service (Development)

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

### Cấu hình đăng nhập Google

Ứng dụng hỗ trợ đăng nhập bằng Google (bên cạnh email/mật khẩu). Để bật tính năng này:

1. Vào [Google Cloud Console](https://console.cloud.google.com/) → tạo project mới (hoặc chọn project có sẵn).
2. Vào **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
3. Chọn loại ứng dụng **Web application**.
4. Ở mục **Authorized JavaScript origins**, thêm:
   - `http://localhost:3000` (chạy qua Docker/dev)
5. Sau khi tạo, copy **Client ID** và điền vào `.env` (root) ở cả hai biến:
   ```
   GOOGLE_CLIENT_ID=<client-id>.apps.googleusercontent.com
   VITE_GOOGLE_CLIENT_ID=<client-id>.apps.googleusercontent.com
   ```
   (Nếu chạy frontend độc lập bằng `npm run dev`, cũng copy `frontend/.env.example` thành `frontend/.env` và điền `VITE_GOOGLE_CLIENT_ID`.)
6. Rebuild container frontend để biến môi trường được đóng gói vào bundle (Vite chỉ đọc env lúc build):
   ```bash
   docker compose up --build frontend
   ```

Nếu chưa cấu hình, nút "Đăng nhập với Google" vẫn hiển thị nhưng sẽ báo lỗi khi bấm — đăng ký/đăng nhập bằng email vẫn hoạt động bình thường.

### Cấu hình SMTP (email đặt lại mật khẩu)

Tính năng "Quên mật khẩu" gửi link reset qua email. Nếu chưa cấu hình SMTP, link reset sẽ được ghi ra log của backend (`docker compose logs backend`) thay vì gửi email thật — vẫn dùng được để test.

Để gửi email thật, điền vào `.env` (ví dụ dùng Gmail với [App Password](https://myaccount.google.com/apppasswords)):
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=<app-password-16-ky-tu>
SMTP_FROM=your-email@gmail.com
```
Sau đó khởi động lại backend: `docker compose up --build backend`.

---

## API Documentation

Truy cập Swagger UI tại: http://localhost:8000/docs

### Endpoints chính

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `POST` | `/api/news/upload-csv` | Upload file CSV |
| `POST` | `/api/news/` | Tạo bài báo mới |
| `GET` | `/api/news/?stock=FPT&event_type=...&sentiment=...&q=...` | Danh sách tin tức (lọc theo mã cổ phiếu, sự kiện, sentiment, từ khoá, khoảng ngày) |
| `PATCH` | `/api/news/{id}` | Sửa nhanh tin tức (title/source/sentiment/impact_score) — chỉ admin |
| `POST` | `/api/news/{id}/analyze` | Phân tích bài báo |
| `GET` | `/api/graph/` | Lấy dữ liệu graph |
| `GET` | `/api/graph/stats` | Thống kê graph |
| `GET` | `/api/graph/stock/{symbol}/features` | Đặc trưng Knowledge Graph của 1 mã cổ phiếu |
| `GET` | `/api/prediction/` | Danh sách dự đoán |
| `GET` | `/api/prediction/stock/{symbol}` | Dự đoán theo mã |
| `GET` | `/api/prediction/evaluate` | Đánh giá mô hình (baseline vs graph-enhanced, dữ liệu minh hoạ) |
| `GET` | `/api/analytics/dashboard` | Dữ liệu dashboard tổng quan |
| `GET` | `/api/analytics/stocks` | Danh mục cổ phiếu kèm số lần nhắc đến & phân bố sentiment (dùng cho trang Cổ phiếu, Sentiment) |
| `GET` | `/api/admin/*` | Toàn bộ endpoint Admin Console (xem mục Admin Console) — chỉ role `admin` |

### Ví dụ CSV upload

File CSV cần có cột `title` (bắt buộc), các cột khác là tuỳ chọn:

```csv
title,content,source,published_date
FPT báo lãi quý II tăng mạnh,Công ty FPT ghi nhận lợi nhuận...,cafef.vn,2026-06-10
HPG sụt giảm do nhu cầu thép yếu,Hòa Phát thông báo lợi nhuận giảm...,vnexpress.net,2026-06-09
```

---

## Cấu trúc dự án

```
finnexus-kg/
├── docker-compose.yml          # Orchestration
├── .env.example                # Biến môi trường mẫu
├── .gitignore
├── README.md
│
├── backend/                    # FastAPI Python Service
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                 # Entry point — tạo bảng, chạy migration nhẹ, seed dữ liệu mẫu, mount router
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py       # Cấu hình
│   │   │   ├── database.py     # SQLAlchemy setup
│   │   │   ├── security.py     # Hash mật khẩu, JWT
│   │   │   ├── deps.py         # get_current_user, require_admin
│   │   │   ├── migrate.py      # ADD COLUMN IF NOT EXISTS cho DB cũ
│   │   │   ├── seed.py         # Seed tài khoản mẫu, từ khoá sự kiện, cấu hình mặc định
│   │   │   ├── settings_store.py # Đọc SystemSetting từ DB
│   │   │   └── email.py        # Gửi email reset mật khẩu
│   │   ├── models/
│   │   │   ├── user.py         # User (có role: customer/admin)
│   │   │   ├── news.py         # NewsArticle (có needs_manual_label, manual_sentiment...)
│   │   │   ├── event_keyword.py    # Từ điển từ khoá sự kiện
│   │   │   ├── system_setting.py   # Cấu hình hệ thống (key/value)
│   │   │   └── activity_log.py     # Nhật ký hoạt động admin
│   │   ├── schemas/
│   │   │   ├── auth.py         # UserOut (có role), TokenResponse...
│   │   │   ├── admin.py        # Schemas cho các endpoint /api/admin/*
│   │   │   └── schemas.py      # NewsCreate/NewsResponse, Graph schemas
│   │   ├── routers/
│   │   │   ├── auth.py         # /api/auth
│   │   │   ├── news.py         # /api/news (có filter + PATCH admin-only)
│   │   │   ├── graph.py        # /api/graph
│   │   │   ├── prediction.py   # /api/prediction
│   │   │   ├── analytics.py    # /api/analytics
│   │   │   └── admin/          # /api/admin/* — chỉ role admin
│   │   │       ├── dashboard.py, users.py, settings.py, keywords.py
│   │   │       ├── labeling.py, validation.py, stocks.py, activity.py
│   │   └── services/
│   │       ├── nlp_service.py       # NLP & Entity extraction (đọc keyword/threshold từ DB nếu có)
│   │       ├── graph_service.py     # Knowledge Graph (NetworkX)
│   │       ├── prediction_service.py # Prediction model
│   │       ├── keyword_service.py   # Lấy từ khoá sự kiện active từ DB
│   │       ├── activity_log.py      # Ghi log hoạt động admin
│   │       └── validation_service.py # Tính data quality / labeling accuracy
│   └── data/
│       ├── stock_dictionary.json    # 25 mã cổ phiếu VN
│       └── sample_news.csv          # 20 bài báo mẫu
│
└── frontend/                   # React TypeScript App
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── App.tsx              # Route khách hàng (/*) và admin (/admin/*), tách theo role
        ├── main.tsx
        ├── index.css
        ├── types/index.ts       # TypeScript types (User có role, các type Admin*)
        ├── context/
        │   ├── AuthContext.tsx
        │   └── ThemeContext.tsx # Giao diện Sáng/Tối, lưu vào localStorage, mặc định Sáng
        ├── services/
        │   ├── api.ts           # Axios client, newsApi (có filter theo stock/event/sentiment + patch)
        │   ├── authApi.ts
        │   └── adminApi.ts      # Wrapper cho toàn bộ /api/admin/*
        ├── components/
        │   ├── Auth/            # ProtectedRoute (role-aware), GuestRoute, AuthLayout...
        │   ├── ThemeToggle.tsx  # Công tắc chuyển giao diện Sáng/Tối, dùng ở trang Cài đặt
        │   ├── Admin/
        │   │   └── AdminWidgets.tsx  # StatCard/SectionCard/Badge dùng chung cho trang admin
        │   └── Layout/
        │       ├── Sidebar.tsx, Topbar.tsx           # Giao diện khách hàng
        │       └── AdminSidebar.tsx, AdminTopbar.tsx # Giao diện admin (accent xanh lá)
        └── pages/
            ├── auth/                 # Login/Register/ForgotPassword/ResetPassword
            ├── admin/                # 9 trang Admin Console + AdminProfilePage (xem mục Admin Console ở trên)
            ├── DashboardPage.tsx     # 1. Tổng quan
            ├── AnalysisPage.tsx      # 2. Tin tức (danh sách + kết quả NLP)
            ├── StocksPage.tsx        # 3. Cổ phiếu (danh mục)
            ├── StockDetailPage.tsx   #    Cổ phiếu (trang chi tiết theo mã)
            ├── EventsPage.tsx        # 4. Sự kiện tài chính
            ├── SentimentPage.tsx     # 5. Phân tích cảm xúc
            ├── PredictionPage.tsx    # 6. Dự đoán xu hướng
            ├── GraphPage.tsx         # 7. Knowledge Graph 3D/2D
            ├── EvaluationPage.tsx    # 8. Báo cáo
            ├── SettingsPage.tsx      # 9. Cài đặt (hồ sơ + giao diện Sáng/Tối)
            └── ImportPage.tsx        # Nhập dữ liệu (vào từ nút trong trang Tin tức)
```

---

## Demo Flow

Kịch bản demo đề xuất khi thuyết trình:

1. **Import dữ liệu**: Upload `sample_news.csv` với 20 bài báo thực
2. **Xem Dashboard**: Tổng quan số liệu, biểu đồ sentiment, top stocks
3. **Phân tích NLP**: Mở bài báo FPT, xem kết quả trích xuất thực thể
4. **Knowledge Graph 3D**:
   - Xoay graph, click vào node FPT
   - Lọc graph chỉ hiện xung quanh FPT
   - Thấy được: FPT → Công ty FPT → Ngành Công nghệ → CMG (cùng ngành)
5. **Dự đoán**: Nhập FPT, xem kết quả INCREASING với giải thích chi tiết
6. **Đánh giá**: So sánh Baseline 68% vs Graph-enhanced 74%

### Câu trả lời cho GVHD

> **"3D Graph có chỉ để đẹp không?"**
> 
> Không. Mỗi phần tử đều mang ý nghĩa dữ liệu: màu sắc = loại thực thể, kích thước = degree centrality (mức độ quan trọng), nhãn cạnh = loại quan hệ. Người dùng có thể click vào node để xem chi tiết, lọc theo ngành/cổ phiếu, và quan sát các mối quan hệ gián tiếp giữa tin tức và cổ phiếu. Đây là phần **Knowledge Discovery** trực quan, không phải hiệu ứng giao diện.

---

## Đánh giá mô hình

| Mô hình | Input | Accuracy |
|---------|-------|----------|
| Baseline | Text + Sentiment | ~68% |
| **Graph-enhanced** | Text + Sentiment + Graph Features | **~74%** |

### Graph Features (6 đặc trưng từ Knowledge Graph)

| Feature | Ý nghĩa |
|---------|---------|
| Degree Centrality | Số kết nối của cổ phiếu trong graph |
| Betweenness Centrality | Vai trò trung gian kết nối các thực thể |
| Mention Frequency | Tần suất xuất hiện trong tin tức |
| Positive News Count | Số lượng tin tích cực gần đây |
| Negative News Count | Số lượng tin tiêu cực gần đây |
| Sentiment Ratio | Tỷ lệ tin tích cực / tổng tin |

---

## Nhóm thực hiện

| Vai trò | Nhiệm vụ |
|---------|---------|
| Thành viên 1 (CS) | NLP pipeline, Knowledge Graph, ML model, Graph features |
| Thành viên 2 (SE) | Backend API, Frontend dashboard, Docker, Tích hợp hệ thống |

---

## Tài liệu tham khảo

- [underthesea - Vietnamese NLP](https://github.com/undertheseanlp/underthesea)
- [NetworkX - Graph Analytics](https://networkx.org/)
- [Neo4j - Graph Database](https://neo4j.com/)
- [react-force-graph-3d](https://github.com/vasturiano/react-force-graph)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [PhoBERT - Vietnamese BERT](https://github.com/VinAIResearch/PhoBERT)

---

> *FinNexus KG — Biến tin tức chứng khoán thành mạng tri thức, hỗ trợ phân tích và dự đoán xu hướng cổ phiếu.*
