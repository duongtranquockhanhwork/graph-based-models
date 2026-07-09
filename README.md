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

### 1. Dashboard Tổng quan
- Thống kê tổng số tin tức, mã cổ phiếu, công ty
- Biểu đồ phân bố Sentiment (Positive/Negative/Neutral)
- Top cổ phiếu được nhắc đến nhiều nhất
- Xu hướng dự đoán thị trường
- Timeline số lượng tin theo ngày

### 2. Nhập dữ liệu tin tức
- Upload file CSV (hỗ trợ kéo thả)
- Nhập thủ công từng bài báo
- Phân tích tự động sau khi import
- File CSV mẫu có sẵn (20 bài báo)

### 3. Phân tích NLP
- Trích xuất mã cổ phiếu từ tiêu đề và nội dung
- Mapping tự động: mã → công ty → ngành nghề
- Nhận diện sự kiện: lợi nhuận tăng, hợp đồng mới, xử phạt, v.v.
- Phân loại Sentiment với Impact Score
- Hiển thị lý do dự đoán (Explainable AI)

### 4. Knowledge Graph 3D (Điểm nổi bật)
- Đồ thị 3D tương tác: kéo, xoay, zoom
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

### 5. Dự đoán xu hướng
- Dự đoán: **INCREASING / DECREASING / UNCHANGED**
- Tìm kiếm theo mã cổ phiếu cụ thể
- Hiển thị độ tin cậy (confidence %)
- Giải thích chi tiết các yếu tố ảnh hưởng

### 6. Đánh giá mô hình
- So sánh Baseline (text only) vs Graph-enhanced
- Accuracy, Precision, Recall, F1 Score
- Confusion Matrix trực quan
- Danh sách 6 graph features được sử dụng

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

Dùng các tài khoản sau để đăng nhập thử hệ thống (email/mật khẩu):

| Email | Mật khẩu | Ghi chú |
|-------|----------|---------|
| `test1@finnexus.dev` | `Test@123` | Tài khoản test 1 |
| `test2@finnexus.dev` | `Test@123` | Tài khoản test 2 |
| `admin@finnexus.dev` | `Test@123` | Tài khoản test 3 |

Nếu database chưa có các tài khoản này (ví dụ sau khi chạy `docker compose down -v`), tạo lại bằng lệnh:

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test1@finnexus.dev","password":"Test@123","full_name":"Test User 1"}'
```

(đổi `email` và `full_name` để tạo thêm các tài khoản còn lại)

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
| `GET` | `/api/news/` | Danh sách tin tức |
| `POST` | `/api/news/{id}/analyze` | Phân tích bài báo |
| `GET` | `/api/graph/` | Lấy dữ liệu graph |
| `GET` | `/api/graph/stats` | Thống kê graph |
| `GET` | `/api/prediction/` | Danh sách dự đoán |
| `GET` | `/api/prediction/stock/{symbol}` | Dự đoán theo mã |
| `GET` | `/api/prediction/evaluate` | Đánh giá mô hình |
| `GET` | `/api/analytics/dashboard` | Dữ liệu dashboard |

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
│   ├── main.py                 # Entry point
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py       # Cấu hình
│   │   │   └── database.py     # SQLAlchemy setup
│   │   ├── models/
│   │   │   └── news.py         # Database model
│   │   ├── schemas/
│   │   │   └── schemas.py      # Pydantic schemas
│   │   ├── routers/
│   │   │   ├── news.py         # /api/news
│   │   │   ├── graph.py        # /api/graph
│   │   │   ├── prediction.py   # /api/prediction
│   │   │   └── analytics.py    # /api/analytics
│   │   └── services/
│   │       ├── nlp_service.py       # NLP & Entity extraction
│   │       ├── graph_service.py     # Knowledge Graph (NetworkX)
│   │       └── prediction_service.py # Prediction model
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
        ├── App.tsx
        ├── main.tsx
        ├── index.css
        ├── types/index.ts       # TypeScript types
        ├── services/api.ts      # Axios API client
        ├── components/
        │   └── Layout/
        │       └── Sidebar.tsx
        └── pages/
            ├── DashboardPage.tsx    # Tổng quan
            ├── ImportPage.tsx       # Nhập dữ liệu
            ├── AnalysisPage.tsx     # Phân tích NLP
            ├── GraphPage.tsx        # 3D Knowledge Graph
            ├── PredictionPage.tsx   # Dự đoán xu hướng
            └── EvaluationPage.tsx   # Đánh giá mô hình
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
