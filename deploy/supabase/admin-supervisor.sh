#!/bin/sh
set -u
child=''
stop_child() {
 if [ -n "$child" ]; then
  kill "$child" 2>/dev/null || true
  n=0
  while kill -0 "$child" 2>/dev/null && [ "$n" -lt 10 ]; do sleep 1; n=$((n+1)); done
  kill -KILL "$child" 2>/dev/null || true
  wait "$child" 2>/dev/null || true
  child=''
 fi
}
trap 'stop_child; exit 0' TERM INT
while :; do
 until=$(cat /admin-control/until 2>/dev/null || echo 0)
 case "$until" in ''|*[!0-9]*) until=0;; esac
 if [ "$until" -gt "$(date +%s)" ]; then
  if [ -z "$child" ] || ! kill -0 "$child" 2>/dev/null; then
   "$@" & child=$!
   echo 'Administration service enabled temporarily'
  fi
 else
  if [ -n "$child" ]; then stop_child; echo 'Administration service paused'; fi
 fi
 sleep 5 & wait $! || true
done
