FROM python:3.11-slim

# gcc chỉ cần lúc build wheel; gỡ ngay sau đó để image production không mang
# theo trình biên dịch.
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && apt-get purge -y gcc && apt-get autoremove -y

COPY . .

# Không chạy bằng root. Một lỗ hổng thực thi mã trong tiến trình web không nên
# đồng thời là quyền root trong container.
RUN useradd --create-home --uid 10001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Không --reload: đó là chế độ phát triển, nó theo dõi thay đổi file và chạy
# thêm một tiến trình giám sát. Bản trước để nguyên cờ này trong image production.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
