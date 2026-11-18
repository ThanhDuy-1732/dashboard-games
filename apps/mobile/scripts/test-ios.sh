#!/bin/sh
set -eu
if [ -z "${IOS_SIMULATOR_ID:-}" ]; then
  echo 'Set IOS_SIMULATOR_ID to a booted iPhone/iPad simulator UUID.' >&2
  exit 1
fi
exec xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination "platform=iOS Simulator,id=$IOS_SIMULATOR_ID" -derivedDataPath build/ios CODE_SIGNING_ALLOWED=NO test
