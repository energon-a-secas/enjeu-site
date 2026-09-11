#!/usr/bin/env python3
"""OAuth1 access to the Noun Project API, with no third-party dependency.

    from tools.nounproject import search, download

`requests_oauthlib` is not installed and the signing is forty lines, so it is
here instead of in the environment. Nothing in this module prints, logs, or
returns a credential: the key and secret are read from .env into local
variables, used to compute one signature, and never leave this file. That is
deliberate, and it is the second time it has had to be: this project's
credentials were previously echoed into a session transcript by a masking
attempt that assumed .env used `NAME=value` when it uses `NAME: value`. The
reader below accepts either and prints neither.

.env is gitignored. Rotate the pair at thenounproject.com/developers if it has
ever been pasted anywhere.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = "https://api.thenounproject.com/v2"


def _creds() -> tuple[str, str]:
    """The key and secret from .env. Accepts `NAME: value` and `NAME=value`."""
    env = ROOT / ".env"
    if not env.exists():
        raise SystemExit(".env not found; the Noun Project key and secret live there")
    found: dict[str, str] = {}
    for line in env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r"^([A-Za-z0-9_]+)\s*[:=]\s*(.*)$", line)
        if m:
            found[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    try:
        return found["NOUNPROJECT_KEY"], found["NOUNPROJECT_SECRET"]
    except KeyError as e:
        raise SystemExit(f"missing {e.args[0]} in .env") from None


def _quote(s: str) -> str:
    return urllib.parse.quote(str(s), safe="~")


def _signed_url(url: str, params: dict) -> str:
    """A GET URL carrying an OAuth1 HMAC-SHA1 signature (two-legged, no token)."""
    key, secret = _creds()
    oauth = {
        "oauth_consumer_key": key,
        "oauth_nonce": hashlib.sha1(str(time.time_ns()).encode()).hexdigest(),
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_timestamp": str(int(time.time())),
        "oauth_version": "1.0",
    }
    everything = {**{k: str(v) for k, v in params.items()}, **oauth}
    normalised = "&".join(f"{_quote(k)}={_quote(everything[k])}" for k in sorted(everything))
    base = "&".join(["GET", _quote(url), _quote(normalised)])
    signing_key = f"{_quote(secret)}&"          # no token secret in two-legged OAuth
    sig = base64.b64encode(hmac.new(signing_key.encode(), base.encode(), hashlib.sha1).digest()).decode()
    everything["oauth_signature"] = sig
    return url + "?" + urllib.parse.urlencode(everything)


def get(path: str, **params) -> dict:
    """One signed GET. Raises with the server's own message on a non-200."""
    url = f"{API}{path}"
    req = urllib.request.Request(_signed_url(url, params), headers={"User-Agent": "enjeu-art/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")[:400]
        raise SystemExit(f"noun project {e.code} on {path}: {body}") from None


def search(term: str, limit: int = 6) -> list[dict]:
    """Icons matching a term, newest API shape, oldest fields tolerated."""
    data = get("/icon", query=term, limit=limit, thumbnail_size=200)
    return data.get("icons") or data.get("data") or []


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "enjeu-art/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()
