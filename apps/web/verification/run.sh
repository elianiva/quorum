#!/usr/bin/env bash
# Checks the web state machines with the statechart skill and writes each report
# and chart to a new folder under $OUT (default: a fresh temp folder).
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
statechart="$here/../../../.agents/skills/statechart/scripts/statechart"
out="${OUT:-$(mktemp -d)}"
failed=0
export PATH="$HOME/.local/bin:$PATH"

for model in clock/ClockOverlay room/RoomClient board/BoardSurface room-lifecycle/RoomLifecycle vote/RoomVote study/StudyQueue; do
  dir="${model%%/*}"
  name="${model##*/}"
  echo "=== $name"
  "$statechart" "$here/$model.tla" --config "$here/$model.cfg" --view "$here/$dir/view.mjs" --out "$out/$dir" || failed=1
done
echo "Reports and charts: $out"
exit "${failed:-0}"
