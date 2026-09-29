#!/usr/bin/env python3
"""
Push webcrew/out to GitHub repo ranjeetsinghai79/webcrew-landing,
then connect CF Pages to that repo and deploy.
"""
import os, sys, json, base64, pathlib, time, mimetypes
import requests

GH_TOKEN   = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
GH_OWNER   = "ranjeetsinghai79"
GH_REPO    = "webcrew-landing"
CF_TOKEN   = os.environ.get("CLOUDFLARE_API_TOKEN")
CF_ACCOUNT = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
CF_PROJECT = "webcrew-landing-backup"
OUT_DIR    = pathlib.Path(__file__).parent.parent / "webcrew" / "out"

GH_HDRS    = {"Authorization": f"Bearer {GH_TOKEN}", "Accept": "application/vnd.github+json"}
CF_HDRS    = {"Authorization": f"Bearer {CF_TOKEN}", "Content-Type": "application/json"}
CF_BASE    = "https://api.cloudflare.com/client/v4"

def walk(d):
    for p in d.rglob("*"):
        if p.is_file():
            yield p

# ── 1. Create GitHub repo ─────────────────────────────────────────────────────
def create_gh_repo():
    r = requests.get(f"https://api.github.com/repos/{GH_OWNER}/{GH_REPO}", headers=GH_HDRS)
    if r.ok:
        print(f"GitHub repo already exists: {r.json()['html_url']}")
        return
    r = requests.post(
        "https://api.github.com/user/repos",
        headers=GH_HDRS,
        json={"name": GH_REPO, "private": False, "description": "WebCrew landing page"},
    )
    if not r.ok:
        raise RuntimeError(f"Create repo failed: {r.text}")
    print(f"GitHub repo created: {r.json()['html_url']}")

# ── 2. Push files to GitHub ───────────────────────────────────────────────────
def push_files():
    files = list(walk(OUT_DIR))
    print(f"Pushing {len(files)} files to GitHub…")
    ok = err = 0
    for abs_path in files:
        rel = abs_path.relative_to(OUT_DIR).as_posix()
        content = base64.b64encode(abs_path.read_bytes()).decode()

        # Check if file already exists (need its SHA for update)
        check = requests.get(
            f"https://api.github.com/repos/{GH_OWNER}/{GH_REPO}/contents/{rel}",
            headers=GH_HDRS
        )
        payload = {"message": f"deploy: {rel}", "content": content}
        if check.ok:
            payload["sha"] = check.json()["sha"]

        r = requests.put(
            f"https://api.github.com/repos/{GH_OWNER}/{GH_REPO}/contents/{rel}",
            headers=GH_HDRS,
            json=payload,
        )
        if r.ok:
            ok += 1
        else:
            print(f"  FAIL {rel}: {r.status_code} {r.text[:100]}")
            err += 1
    print(f"  {ok} uploaded, {err} failed")

# ── 3. Delete old CF project + create new one connected to GitHub ─────────────
def setup_cf_pages():
    # Delete existing direct-upload project (it has no source)
    r = requests.delete(
        f"{CF_BASE}/accounts/{CF_ACCOUNT}/pages/projects/{CF_PROJECT}",
        headers=CF_HDRS,
    )
    if r.ok:
        print(f"Deleted old CF project '{CF_PROJECT}'")

    # Create new project connected to GitHub
    body = {
        "name": CF_PROJECT,
        "production_branch": "main",
        "source": {
            "type": "github",
            "config": {
                "owner": GH_OWNER,
                "repo_name": GH_REPO,
                "production_branch": "main",
                "deployments_enabled": True,
            }
        },
        "build_config": {
            "build_command": "",
            "destination_dir": "",
        },
    }
    r = requests.post(f"{CF_BASE}/accounts/{CF_ACCOUNT}/pages/projects", headers=CF_HDRS, json=body)
    resp = r.json()
    if not r.ok:
        msg = (resp.get("errors") or [{}])[0].get("message", "")
        if "already exists" in msg or "taken" in msg:
            print("CF project already exists")
            return
        raise RuntimeError(f"CF project create failed: {resp}")
    print(f"CF Pages project created: https://{CF_PROJECT}.pages.dev")

# ── 4. Poll CF Pages for successful deployment ────────────────────────────────
def poll():
    print("Waiting for CF Pages to deploy (max 5 min)…")
    for i in range(30):
        time.sleep(10)
        r = requests.get(
            f"{CF_BASE}/accounts/{CF_ACCOUNT}/pages/projects/{CF_PROJECT}/deployments",
            headers=CF_HDRS,
        )
        if not r.ok:
            continue
        deps = r.json().get("result", [])
        if deps:
            latest = deps[0]
            stage = latest.get("latest_stage", {})
            name, status = stage.get("name"), stage.get("status")
            print(f"  [{i*10}s] {name} — {status}")
            if name == "deploy" and status == "success":
                print(f"\nLive ✓ → https://{CF_PROJECT}.pages.dev")
                return
            if status == "failure":
                print("Deployment failed!")
                return
    print("Timed out — check CF dashboard")

if __name__ == "__main__":
    missing = [name for name, value in {
        "GITHUB_TOKEN": GH_TOKEN,
        "CLOUDFLARE_API_TOKEN": CF_TOKEN,
        "CLOUDFLARE_ACCOUNT_ID": CF_ACCOUNT,
    }.items() if not value]
    if missing:
        raise SystemExit(f"Missing required environment variables: {', '.join(missing)}")
    print("=== Deploy webcrew landing to CF Pages via GitHub ===")
    create_gh_repo()
    push_files()
    setup_cf_pages()
    poll()
