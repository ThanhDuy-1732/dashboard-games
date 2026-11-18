#!/bin/sh
set -eu
# Select the installed JDK for this command only, leaving machine defaults intact.
if [ "$(uname)" = Darwin ]; then
  JAVA_HOME=${NHA_CHOI_JAVA_HOME:-$(/usr/libexec/java_home -v 21)}
  export JAVA_HOME
fi
if [ -z "${ANDROID_HOME:-}" ] && [ -d "$HOME/Library/Android/sdk" ]; then
  ANDROID_HOME="$HOME/Library/Android/sdk"
  export ANDROID_HOME
fi
cd android
exec ./gradlew assembleDebug
