#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
branch="gh-pages"
local_ref="refs/heads/$branch"
remote_ref="refs/remotes/origin/$branch"
dist="$root/apps/site/dist"
inputs=(apps/site packages scripts package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json turbo.json .npmrc)
push=0

fail() {
  echo "$1" >&2
  exit 1
}

assert_clean() {
  if [ -n "$(git -C "$root" status --porcelain --untracked-files=all -- "${inputs[@]}")" ]; then
    fail "$1"
  fi
}

for arg in "$@"; do
  case "$arg" in
    --push) push=1 ;;
    *) echo "usage: scripts/deploy-site.sh [--push]" >&2; exit 2 ;;
  esac
done

command -v rsync >/dev/null || fail "rsync is required."
git -C "$root" rev-parse --verify --quiet HEAD >/dev/null || fail "The repository has no commits yet; commit first so the published site matches a commit."
assert_clean "The site or a workspace input has uncommitted changes; commit them first so the published site matches a commit."

has_origin=0
if git -C "$root" remote get-url origin >/dev/null 2>&1; then
  has_origin=1
fi
if [ "$push" -eq 1 ] && [ "$has_origin" -eq 0 ]; then
  fail "There is no origin remote; add github.com/mtvrkan/viveeditor as origin before using --push."
fi

expected_pnpm="$(node -p 'require(process.argv[1]).packageManager.split("@")[1].split("+")[0]' "$root/package.json")"
actual_pnpm="$(cd "$root" && pnpm --version)"
[ "$actual_pnpm" = "$expected_pnpm" ] || fail "pnpm $expected_pnpm is required, found $actual_pnpm."
node -e 'const want = /(\d+)\.(\d+)/.exec(require(process.argv[1]).engines.node).slice(1).map(Number); const have = process.versions.node.split(".").map(Number); process.exit(have[0] > want[0] || (have[0] === want[0] && have[1] >= want[1]) ? 0 : 1)' "$root/package.json" || fail "Node does not satisfy engines.node in package.json (found $(node --version))."

pnpm --dir "$root" install --frozen-lockfile
pnpm --dir "$root" --filter "@viveeditor/site..." build
assert_clean "The build changed files under the site inputs; inspect git status before publishing."

for file in index.html CNAME .nojekyll pagefind/pagefind.js; do
  [ -e "$dist/$file" ] || fail "The build output is missing $file; refusing to publish."
done

if [ "$has_origin" -eq 1 ]; then
  lookup=0
  git -C "$root" ls-remote --exit-code --heads origin "$branch" >/dev/null || lookup=$?
  if [ "$lookup" -eq 0 ]; then
    git -C "$root" fetch --quiet origin "+$local_ref:$remote_ref"
  elif [ "$lookup" -ne 2 ]; then
    [ "$push" -eq 0 ] || fail "Could not reach origin; nothing was published."
    echo "Could not reach origin; continuing with the local $branch only." >&2
  fi
fi

if git -C "$root" show-ref --verify --quiet "$remote_ref"; then
  if ! git -C "$root" show-ref --verify --quiet "$local_ref"; then
    git -C "$root" branch --quiet --no-track "$branch" "$remote_ref"
  elif git -C "$root" merge-base --is-ancestor "$local_ref" "$remote_ref"; then
    git -C "$root" update-ref "$local_ref" "$(git -C "$root" rev-parse "$remote_ref")" "$(git -C "$root" rev-parse "$local_ref")"
  elif ! git -C "$root" merge-base --is-ancestor "$remote_ref" "$local_ref"; then
    fail "Local $branch and origin/$branch have diverged; reconcile them by hand, this script never force-pushes."
  fi
fi

source_sha="$(git -C "$root" rev-parse HEAD)"
short_sha="$(git -C "$root" rev-parse --short HEAD)"
work="$(mktemp -d "${TMPDIR:-/tmp}/viveeditor-site.XXXXXX")"
cleanup() {
  git -C "$root" worktree remove --force "$work" >/dev/null 2>&1 || true
  rm -rf -- "$work"
}
trap cleanup EXIT

if git -C "$root" show-ref --verify --quiet "$local_ref"; then
  git -C "$root" worktree add --quiet "$work" "$branch"
else
  git -C "$root" worktree add --quiet --orphan -b "$branch" "$work"
fi

rsync -a --delete --exclude ".git" "$dist/" "$work/"
git -C "$work" add --all
if git -C "$work" diff --cached --quiet; then
  echo "The published site already matches $short_sha."
else
  git -C "$work" commit --quiet -m "Publish the website from $short_sha" -m "Source: $source_sha"
  echo "Committed the site from $short_sha to $branch."
fi

if [ "$push" -eq 1 ]; then
  if [ -z "$(git -C "$root" branch -r --contains HEAD)" ]; then
    echo "Warning: $short_sha is not on origin yet; push main too so the source commit is public." >&2
  fi
  git -C "$root" push origin "$local_ref:$local_ref"
else
  echo "Not pushed. Run with --push to publish $branch to GitHub Pages."
fi
