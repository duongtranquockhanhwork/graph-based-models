"""Dựng lại backend/data/stock_dictionary.json từ bảng mã của repo nghiên cứu.

Trước bản này, ứng dụng chỉ biết **57 mã** trong khi mô hình biết **257**. Hậu
quả không phải "thiếu vài mã": bộ nhận diện của app là thứ cung cấp
``linked_symbols`` cho mô hình, nên một bài về mã ngoài 57 mã đó bị mô hình từ
chối với lý do ``no_symbol_found`` — dù chính nó thừa sức chấm mã ấy.

Vì sao không đơn giản là đổ cả 257 mã vào rồi khớp như cũ
=========================================================
Mã cổ phiếu Việt Nam dài ba ký tự, và khi so trên văn bản đã viết hoa thì rất
nhiều mã trùng với từ thường hoặc từ viết tắt tài chính: ``TIN``, ``HAI``,
``CAN``, ``PAN``, ``TOP``, ``HOT``, ``VAT``, ``CEO``, ``GDP``, ``USD``… Đổ thẳng
vào sẽ biến mọi bài có chữ "tin" thành bài về mã TIN.

Repo nghiên cứu đã giải bài này và ta dùng lại đúng lời giải của nó
(``config/v45_expanded_dictionary_v1.yaml``), gồm ba phần:

1. **Blocklist 56 mục** — các mã trùng từ viết tắt/từ thường.
2. **Ngữ cảnh chứng khoán trong bán kính 40 ký tự** — chỉ tính là nhắc tới mã khi
   quanh đó có "cổ phiếu", "mã ", "chứng khoán", "cp ", "hose", "hnx", "sàn ".
3. **Không tự sinh alias thương hiệu.** Bỏ tiền tố pháp lý khỏi "CTCP Trang" ra
   "trang" — một từ tiếng Việt thông thường — từng khớp 148 bài trong một lần
   dò. 57 alias hiện có là làm tay; script này không giả mạo công việc đó.

Kết quả là từ điển hai tầng:

``curated``  57 mã làm tay, có alias thương hiệu, khớp như cũ (không cần ngữ cảnh)
``expanded`` phần còn lại, CHỈ khớp theo mã và CHỈ khi có ngữ cảnh chứng khoán

Bảy mã nằm trong cả blocklist lẫn nhóm curated (GAS, HSG, MSN, MWG, PVS, REE,
VND) được **giữ lại**: chúng đã được kiểm bằng tay và có alias riêng, nên không
phải là loại trùng từ mà blocklist muốn chặn.

Chạy:
    python -m tools.build_stock_dictionary
    python -m tools.build_stock_dictionary --check   # chỉ so, không ghi
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(BACKEND, "data", "stock_dictionary.json")

# Bảng mã nằm trong repo nghiên cứu / bản mô hình đóng gói. Thử lần lượt.
SOURCE_RELATIVE = os.path.join(
    "data", "reference", "v45_expanded", "stocks_master_expanded.csv"
)

# Nguyên văn từ config/v45_expanded_dictionary_v1.yaml. Chép lại thay vì đọc file
# YAML để script vẫn chạy được khi không có repo nghiên cứu — và mọi thay đổi ở
# đây là một thay đổi có thể nhìn thấy trong diff, không phải một hiệu ứng phụ.
BLOCKLIST = {
    "NAV", "CEO", "CFO", "CTO", "COO", "ROE", "ROA", "ROS", "EPS", "PES",
    "GDP", "CPI", "IPO", "ETF", "USD", "VND", "EUR", "JPY", "CNY", "HSX",
    "HNX", "HSG", "GAS", "API", "ITC", "SMC", "PVC", "PVS", "TIN", "VAT",
    "TNS", "MSN", "SAM", "TOP", "BOT", "BCC", "MWG", "ATO", "ATC", "OTC",
    "REE", "LNG", "VIP", "SAF", "TVB", "DNA", "CAN", "PAN", "HAI", "TNT",
    "HOT", "ART", "ABS", "IDC", "TAR", "TIP",
}


def find_source() -> str:
    """Tìm bảng mã: ưu tiên bản đóng gói trong kho, rồi tới FINNEXUS_ROOT."""
    candidates = [
        os.path.join(os.path.dirname(BACKEND), "model", SOURCE_RELATIVE),
        os.path.join(os.environ.get("FINNEXUS_ROOT", ""), SOURCE_RELATIVE),
        os.path.join(os.path.dirname(BACKEND), "..", "FinNexus KG", SOURCE_RELATIVE),
    ]
    for path in candidates:
        if path and os.path.isfile(path):
            return os.path.abspath(path)
    raise SystemExit(
        "Không tìm thấy stocks_master_expanded.csv. Đặt FINNEXUS_ROOT trỏ tới "
        "repo nghiên cứu, hoặc để bản mô hình ở <gốc kho>/model."
    )


def load_current() -> dict:
    if not os.path.isfile(OUT_PATH):
        return {}
    with open(OUT_PATH, "r", encoding="utf-8") as handle:
        return json.load(handle)


def build(source: str, current: dict) -> tuple[dict, dict]:
    with open(source, "r", encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))

    result: dict = {}
    stats = {"curated": 0, "expanded": 0, "blocked": 0, "blocked_symbols": []}

    for row in rows:
        symbol = row["symbol"].strip().upper()
        if not symbol:
            continue

        existing = current.get(symbol)
        if existing is not None:
            # Mã đã làm tay: giữ NGUYÊN alias và tên công ty đang dùng. Bảng của
            # repo nghiên cứu chỉ có 1 alias cho FPT, còn app có 5 — ghi đè sẽ là
            # một bước lùi âm thầm.
            entry = dict(existing)
            entry["tier"] = "curated"
            entry.setdefault("industry", row.get("industry", "").strip())
            exchange = row.get("exchange", "").strip()
            if exchange:
                entry["exchange"] = exchange
            result[symbol] = entry
            stats["curated"] += 1
            continue

        if symbol in BLOCKLIST:
            # Trùng từ viết tắt hoặc từ tiếng Việt thông thường. Bỏ hẳn thay vì
            # thêm rồi lọc, để từ điển không chứa thứ ta biết là sẽ báo sai.
            stats["blocked"] += 1
            stats["blocked_symbols"].append(symbol)
            continue

        result[symbol] = {
            "company": row.get("company", "").strip(),
            "industry": row.get("industry", "").strip(),
            "exchange": row.get("exchange", "").strip(),
            # Cố ý rỗng: xem ghi chú ở đầu file về việc không tự sinh alias.
            "aliases": [],
            "tier": "expanded",
        }
        stats["expanded"] += 1

    return dict(sorted(result.items())), stats


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true",
                        help="chỉ báo cáo khác biệt, không ghi file")
    args = parser.parse_args()

    source = find_source()
    current = load_current()
    built, stats = build(source, current)

    print(f"Nguồn : {source}")
    print(f"Trước : {len(current)} mã")
    print(f"Sau   : {len(built)} mã "
          f"({stats['curated']} curated + {stats['expanded']} expanded)")
    print(f"Chặn  : {stats['blocked']} mã trùng từ viết tắt/từ thường")
    if stats["blocked_symbols"]:
        print("        " + ", ".join(sorted(stats["blocked_symbols"])))

    missing = sorted(set(current) - set(built))
    if missing:
        # Không bao giờ được xảy ra: mọi mã làm tay đều phải sống sót.
        print(f"LỖI: {len(missing)} mã đang có bị mất: {missing}")
        return 1

    if args.check:
        added = sorted(set(built) - set(current))
        print(f"Sẽ thêm {len(added)} mã: {', '.join(added[:12])}"
              + (" …" if len(added) > 12 else ""))
        return 0

    with open(OUT_PATH, "w", encoding="utf-8") as handle:
        json.dump(built, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(f"Đã ghi {OUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
