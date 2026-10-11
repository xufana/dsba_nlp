"""Weights and corpora live on the Hugging Face Hub, not in git.

    python scripts/hub.py push week03_attention_transformer     # upload this week's .pt / .npz / data/ (needs `hf auth login` once)
    python scripts/hub.py push --all
    python scripts/hub.py pull week03_attention_transformer     # download into the week's artifacts/ and data/ (no login)
    python scripts/hub.py pull --all
    python scripts/hub.py ls                                    # what the hub holds

From a notebook (its working directory is the week):
    import sys; sys.path.insert(0, "../scripts"); from hub import pull
    pull("week02_language_modelling", "week03_attention_transformer")

Layout in the repo `xufana/dsba-nlp-artifacts` (a public dataset repo) mirrors the tree: weekNN_topic/artifacts/x.pt,
weekNN_topic/data/y.txt. `pull` skips files already present and works offline once they are; set HUB_REPO to use
another repo. What is pushed: artifacts/*.pt, artifacts/*.npz and everything under data/ except data/cache/.
"""
import glob
import os
import sys

REPO = os.environ.get("HUB_REPO", "xufana/dsba-nlp-artifacts")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATTERNS = ["artifacts/*.pt", "artifacts/*.npz", "data/**"]
IGNORE = ["data/cache/**"]


def weeks():
    return sorted(os.path.basename(d) for d in glob.glob(os.path.join(ROOT, "week[0-9][0-9]_*")))


def local_files(week):
    out = []
    for pat in PATTERNS:
        out += [f for f in glob.glob(os.path.join(ROOT, week, pat), recursive=True) if os.path.isfile(f) and "/data/cache/" not in f]
    return sorted(out)


def push(week):
    from huggingface_hub import HfApi
    api = HfApi()
    api.create_repo(REPO, repo_type="dataset", exist_ok=True)
    files = local_files(week)
    if not files:
        print(f"{week}: nothing to push"); return
    print(f"{week}: pushing {len(files)} files, {sum(os.path.getsize(f) for f in files) / 1e6:.0f} MB")
    api.upload_folder(repo_id=REPO, repo_type="dataset", folder_path=os.path.join(ROOT, week), path_in_repo=week,
                      allow_patterns=PATTERNS, ignore_patterns=IGNORE, commit_message=f"{week}: weights and data")


def pull(*names, quiet=False):
    """Download each week's hub files into the repo tree. Files already on disk are not fetched again."""
    from huggingface_hub import snapshot_download
    for week in names:
        try:
            snapshot_download(REPO, repo_type="dataset", local_dir=ROOT, allow_patterns=[f"{week}/**"])
            if not quiet:
                print(f"{week}: {len(local_files(week))} files in place")
        except Exception as e:  # offline, or the repo is not there yet
            have = local_files(week)
            if have:
                print(f"{week}: hub unreachable ({type(e).__name__}), using the {len(have)} files already on disk")
            else:
                raise SystemExit(f"{week}: could not fetch from {REPO} and nothing on disk: {e}")


def ls():
    from huggingface_hub import HfApi
    for f in sorted(HfApi().list_repo_files(REPO, repo_type="dataset")):
        print(f)


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or args[0] not in ("push", "pull", "ls"):
        sys.exit(__doc__)
    cmd, rest = args[0], args[1:]
    if cmd == "ls":
        ls()
    else:
        targets = weeks() if "--all" in rest else [os.path.basename(os.path.normpath(a)) for a in rest if not a.startswith("--")]
        if not targets:
            sys.exit("name a week directory, or --all")
        for w in targets:
            (push if cmd == "push" else pull)(w)
