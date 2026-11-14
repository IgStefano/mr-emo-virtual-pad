#!/bin/bash
set -eu
if [ "$#" -ne 2 ]; then
  echo 'Uso: bash collect-mac.sh /caminho/app.app /pasta/nova-de-evidencias' >&2
  exit 2
fi
app="$1"
evidence="$2"
mkdir "$evidence"
exec > "$evidence/metadata.txt" 2>&1
date -u
sw_vers
uname -m
system_profiler SPHardwareDataType SPAudioDataType SPSoftwareDataType
/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$app/Contents/Info.plist"
file "$app/Contents/MacOS/Mr. Emo Virtual Pad"
codesign -dv --verbose=4 "$app" || true
codesign --verify --deep --strict --verbose=2 "$app" || true
spctl --assess --type execute --verbose=4 "$app" || true
shasum -a 256 "$app/Contents/Resources/app.asar"
echo 'Resultados físicos e codecs: preencher checklist.md. Metadados não são aprovação.'
