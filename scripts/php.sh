#!/bin/sh
set -eu

PHP_IMAGE="php@sha256:7e7413ed31b8c42b31c939cc83b3758b1cd618f7bf3803f5a0c39f98d4adcbee"
COMPOSER_IMAGE="composer@sha256:4ed71c38c6d788eb4e4e3747b5332f5b40d5b5a6fcadd5062a1a70986a118e0a"
ROOT=$(cd "$(dirname "$0")/.." && pwd)

if [ "$#" -lt 2 ]; then
  echo "usage: scripts/php.sh <sanitizer|laravel> <install|test|audit|php> [args...]" >&2
  exit 2
fi

case "$1" in
  sanitizer) DIR=php/sanitizer ;;
  laravel) DIR=integrations/laravel ;;
  *) echo "unknown package: $1" >&2; exit 2 ;;
esac
COMMAND=$2
shift 2

run() {
  docker run --rm -v "$ROOT":/app -w "/app/$DIR" -e COMPOSER_HOME=/tmp/composer "$@"
}

case "$COMMAND" in
  install) run "$COMPOSER_IMAGE" install --no-scripts --no-interaction --no-progress "$@" ;;
  update) run "$COMPOSER_IMAGE" update --no-scripts --no-interaction --no-progress "$@" ;;
  audit) run "$COMPOSER_IMAGE" audit --no-interaction "$@" ;;
  test) run "$PHP_IMAGE" vendor/bin/phpunit "$@" ;;
  php) run "$PHP_IMAGE" php "$@" ;;
  *) echo "unknown command: $COMMAND" >&2; exit 2 ;;
esac
