"""Polite scraping toolkit (Grupo B).

Shared machinery so the crawlers are as gentle as possible and it is very
unlikely the sites ban us:

- Realistic rotating User-Agents (standard browser strings, no fake auth).
- Jittered delays between requests (no fixed intervals -> no sync load spikes).
- Exponential backoff + honoring Retry-After on 429/5xx (never hammer).
- Single-threaded, low frequency.
- Logging to pruebas/logs/.

Legal posture (see REPORTE_GrupoB_Solves.md §7):
- Public data, no login, no paywall, no bypass of any technical barrier.
- Honor robots.txt: reco.nz has none; cuberoot.me allows /recon with
  Crawl-delay: 5 (crawl_cuberoot.py defaults to >=5s).
- Raw HTML stays in pruebas/ (gitignored); the product only ships
  derived/aggregated data with attribution.
"""
import logging
import os
import random
import threading
import time

import requests

LOG_DIR = os.path.join(os.path.dirname(__file__), "..", "logs")

# Realistic modern browser user agents (rotated per request).
UA_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
]

_ua_idx = 0
_ua_lock = threading.Lock()


def next_ua() -> str:
    """Rotating UA, thread-safe (used by multi-worker crawlers)."""
    global _ua_idx
    with _ua_lock:
        ua = UA_POOL[_ua_idx % len(UA_POOL)]
        _ua_idx += 1
    return ua


def polite_sleep(base: float, jitter: float) -> None:
    """Sleep for base + random[0, jitter) seconds (jittered pacing)."""
    time.sleep(base + random.random() * jitter)


def setup_logger(name: str) -> logging.Logger:
    os.makedirs(LOG_DIR, exist_ok=True)
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        fh = logging.FileHandler(os.path.join(LOG_DIR, f"{name}.log"), encoding="utf-8")
        fh.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
        sh = logging.StreamHandler()
        sh.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
        logger.addHandler(fh)
        logger.addHandler(sh)
    return logger


def fetch(url: str, *, timeout: int = 30, max_retries: int = 5,
          base_backoff: float = 4.0) -> requests.Response | None:
    """GET with UA rotation, exponential backoff and Retry-After support.

    Returns the response on success (2xx), None on hard failure, and retries
    with backoff on 429/5xx. Never parallel, never hammers.
    """
    for attempt in range(max_retries):
        try:
            r = requests.get(
                url,
                headers={"User-Agent": next_ua(),
                         "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                         "Accept-Language": "en-US,en;q=0.9"},
                timeout=timeout,
            )
        except requests.RequestException as e:
            wait = base_backoff * (2 ** attempt)
            logging.getLogger("polite").warning(
                "request error %s (attempt %d) -> backoff %.0fs", e, attempt, wait)
            time.sleep(wait + random.random() * 2)
            continue

        if r.status_code == 200:
            return r
        if r.status_code in (429, 500, 502, 503, 504):
            retry_after = r.headers.get("Retry-After")
            wait = float(retry_after) if retry_after and retry_after.isdigit() \
                else base_backoff * (2 ** attempt)
            logging.getLogger("polite").warning(
                "HTTP %d (attempt %d) -> backoff %.0fs", r.status_code, attempt, wait)
            time.sleep(wait + random.random() * 2)
            continue
        # 404 or any other status: not retryable.
        return r
    return None
