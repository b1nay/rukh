FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Demo data is generated at build time: three logins (superadmin@rukh.com, company@rukh.com,
# landowner@rukh.com, password rukh@123) on a platform with a year of activity. See app/demo.py.
# Build with --build-arg RUKH_DEMO_DATA=false for an empty platform.
ARG RUKH_DEMO_DATA=true
RUN if [ "$RUKH_DEMO_DATA" = "true" ]; then \
      mkdir -p /app/demo && RUKH_DATABASE_URL=sqlite:////app/demo/rukh.db python -m app.demo; \
    fi

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# SQLite lives on a volume so accounts survive rebuilds.
ENV RUKH_DATABASE_URL=sqlite:////data/rukh.db
VOLUME /data

EXPOSE 8000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
