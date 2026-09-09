# FinNexus temporal Knowledge Graph

Pipeline này tạo Knowledge Graph từ dataset V17 theo hai lớp tách biệt:

- `nodes.csv`, `edges.csv`: tri thức có thể dùng tại thời điểm công bố tin;
- `outcome_nodes.csv`, `outcome_edges.csv`: phản ứng giá tương lai, chỉ dùng làm
  target và đánh giá.

Sinh graph:

```powershell
& D:\Python3.12\python.exe scripts\kg\build_knowledge_graph.py
```

Kiểm định ontology, khóa ngoại và rò rỉ thời gian:

```powershell
& D:\Python3.12\python.exe scripts\kg\validate_knowledge_graph.py
```

Các graph feature trong `temporal_graph_features.csv` chỉ sử dụng bài báo có
`published_date` nhỏ hơn nghiêm ngặt ngày của mẫu hiện tại. Tin cùng ngày không
được dùng vì dataset chưa có giờ xuất bản.

Các cạnh `MENTIONS`, `CONTAINS_EVENT`, `AFFECTS`, `HAS_SENTIMENT` hiện được sinh
từ weak rule và luôn mang trạng thái `AUTO_EXTRACTED_UNREVIEWED`. Semantic gold
holdout chỉ dùng để đánh giá, không được nhập ngược vào training graph.
# FinNexus Knowledge Graph

## Kiểm chứng khoa học

Chạy theo đúng thứ tự sau từ thư mục gốc project:

```powershell
& D:\Python3.12\python.exe scripts\kg\validate_knowledge_graph.py
& D:\Python3.12\python.exe scripts\kg\evaluate_semantic_edges.py
& D:\Python3.12\python.exe scripts\kg\evaluate_graph_ablation.py
& D:\Python3.12\python.exe scripts\kg\summarize_kg_readiness.py
```

Protocol và ngưỡng được khóa tại
`config/kg_evaluation_protocol.yaml`. Kết quả thí nghiệm được ghi riêng vào
`outputs/kg_evaluation_v1`; các script không sửa dataset canonical.

Ba lớp bằng chứng phải được đọc riêng:

1. `validate_knowledge_graph.py`: cấu trúc, ontology, provenance và temporal leakage;
2. `evaluate_semantic_edges.py`: entity precision và benchmark semantic trên Gold;
3. `evaluate_graph_ablation.py`: giá trị dự báo tăng thêm của graph so với text/market.

Kết luận tổng hợp nằm trong
`outputs/kg_evaluation_v1/KG_SCIENTIFIC_READINESS_REPORT.md`.

## Entity-only graph V2

Profile V2 loại bỏ toàn bộ event/sentiment/impact yếu khỏi graph feature:

```powershell
& D:\Python3.12\python.exe scripts\kg\build_entity_temporal_features.py
& D:\Python3.12\python.exe scripts\kg\evaluate_graph_ablation.py `
  --protocol config\kg_evaluation_protocol_entity_v2.yaml `
  --graph_features data\knowledge_graph\entity_temporal_features_v2.csv `
  --output_dir outputs\kg_evaluation_entity_v2
& D:\Python3.12\python.exe scripts\kg\select_entity_graph_profile.py
& D:\Python3.12\python.exe scripts\kg\compare_kg_feature_profiles.py
```

Profile compact được chọn bằng rolling-origin chỉ trong tập train. Validation
được mở một lần sau selection; test không được dùng để chọn profile. Báo cáo
quyết định cuối nằm tại
`outputs/kg_evaluation_comparison/KG_FEATURE_PROFILE_DECISION_REPORT.md`.

## Layered KG V3

Để tránh trộn quan hệ đã đủ bằng chứng với weak semantic labels, bản V3 chia
prediction graph thành `CORE`, `DERIVED` và `SEMANTIC_EXPERIMENTAL`:

```powershell
& D:\Python3.12\python.exe scripts\kg\build_layered_knowledge_graph.py
& D:\Python3.12\python.exe scripts\kg\validate_layered_knowledge_graph.py
& D:\Python3.12\python.exe scripts\kg\query_layered_knowledge_graph.py `
  --symbol VIC --limit 10
```

Ứng dụng và demo phải đọc `data/knowledge_graph/layered/core_nodes.csv` và
`core_edges.csv` mặc định. Chỉ bật semantic experimental bằng cờ
`--include_semantic_experimental`; kết quả semantic không phải Gold.

Kiểm thử competency questions và xuất Neo4j:

```powershell
& D:\Python3.12\python.exe scripts\kg\evaluate_kg_competency_questions.py
& D:\Python3.12\python.exe scripts\kg\export_layered_kg_to_neo4j.py
```

Gói Neo4j mặc định chỉ chứa CORE tại
`data/knowledge_graph/neo4j_import/`.

## Semantic Quality V4

V4 giữ nguyên CORE và dataset canonical, nhưng tách semantic weak-rule thành hai
nhóm để tránh đưa nhãn fallback `OTHER` vào truy vấn hoặc graph model mặc định:

- `INFORMATIVE_CANDIDATE`: sự kiện khác `OTHER`, confidence `HIGH`, entity tier
  `HIGH_PRECISION`; vẫn là experimental và chưa phải Gold;
- `FALLBACK_QUARANTINE`: nhãn `OTHER` được giữ cho lineage/error analysis nhưng
  bị tắt khỏi semantic profile mặc định.

Chạy build và validation:

```powershell
& D:\Python3.12\python.exe scripts\kg\build_semantic_quality_release.py
& D:\Python3.12\python.exe scripts\kg\validate_semantic_quality_release.py
& D:\Python3.12\python.exe scripts\kg\export_semantic_quality_v4_to_neo4j.py
& D:\Python3.12\python.exe scripts\kg\evaluate_semantic_quality_v4_review.py
& D:\Python3.12\python.exe scripts\kg\summarize_kg_v4_readiness.py
```

Mẫu kiểm định độc lập được tạo tại
`data/knowledge_graph/semantic_quality_v4/semantic_review_sample.csv`. Các cột
review để trống; không được tự động xem nhãn máy là Gold.

Truy vấn profile V4 đã lọc fallback:

```powershell
& D:\Python3.12\python.exe scripts\kg\query_layered_knowledge_graph.py `
  --symbol VIC --semantic_profile v4_informative --limit 10
```
