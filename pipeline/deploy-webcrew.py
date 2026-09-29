#!/usr/bin/env python3
"""Deploy webcrew/out to CF Pages via direct upload (manifest + files multipart)."""
import os, sys, json, hashlib, pathlib, mimetypes
import requests

ACCOUNT_ID = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
TOKEN      = os.environ.get("CLOUDFLARE_API_TOKEN")
PROJECT    = "webcrew-landing-backup"
OUT_DIR    = pathlib.Path(__file__).parent.parent / "webcrew" / "out"
BASE       = "https://api.cloudflare.com/client/v4"
HDRS       = {"Authorization": f"Bearer {TOKEN}"}

def sha256(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()

def walk(d: pathlib.Path):
    for p in d.rglob("*"):
        if p.is_file():
            yield p

def create_project():
    r = requests.post(
        f"{BASE}/accounts/{ACCOUNT_ID}/pages/projects",
        headers=HDRS,
        json={"name": PROJECT, "production_branch": "main"},
    )
    body = r.json()
    if not r.ok:
        msg = (body.get("errors") or [{}])[0].get("message", "")
        if "already exists" in msg or "taken" in msg:
            print("Project already exists — continuing")
            return
        raise RuntimeError(f"Create project: {body}")
    print(f'Project "{PROJECT}" created ✓')

def deploy():
    files_info = []  # (rel_path, abs_path, buf, hash, mime)
    seen = {}        # hash -> (rel_path, buf)

    for abs_path in walk(OUT_DIR):
        rel = "/" + abs_path.relative_to(OUT_DIR).as_posix()
        buf = abs_path.read_bytes()
        h   = sha256(buf)
        mt  = mimetypes.guess_type(str(abs_path))[0] or "application/octet-stream"
        files_info.append((rel, h, mt))
        seen[h] = (buf, mt)

    manifest = {rel: h for rel, h, _ in files_info}
    print(f"{len(files_info)} files, {len(seen)} unique blobs")

    # Build multipart: manifest + all file blobs keyed by hash
    # requests.post(files=...) sends multipart/form-data
    multipart = []
    multipart.append(
        ("manifest", (None, json.dumps(manifest), "application/json"))
    )
    for h, (buf, mt) in seen.items():
        multipart.append(
            (h, (h, buf, mt))
        )

    print("Uploading deployment…")
    r = requests.post(
        f"{BASE}/accounts/{ACCOUNT_ID}/pages/projects/{PROJECT}/deployments",
        headers=HDRS,
        files=multipart,
    )
    body = r.json()
    if not r.ok:
        raise RuntimeError(f"Deploy failed: {body}")

    result = body.get("result", {})
    url = result.get("url") or f"https://{PROJECT}.pages.dev"
    print(f"\nDeployed ✓")
    print(f"  Deployment URL : {url}")
    print(f"  Main URL       : https://{PROJECT}.pages.dev")

    # Show stage status
    for stage in result.get("stages", []):
        print(f"  Stage: {stage.get('name')} — {stage.get('status')}")

if __name__ == "__main__":
    if not ACCOUNT_ID or not TOKEN:
        raise SystemExit("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required")
    print(f"Deploying {OUT_DIR} → CF Pages '{PROJECT}'")
    create_project()
    deploy()
