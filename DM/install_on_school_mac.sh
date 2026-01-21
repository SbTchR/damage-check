#!/bin/zsh
if [[ $EUID -ne 0 ]]; then echo "Lance-moi avec sudo"; exit 1; fi
read "ID?Numéro de cet ordinateur (01-99) : "
echo "$ID" > /Users/Shared/computer_id.txt
cp -R "$(dirname "$0")/Damage Check.app" /Users/Shared/
cp "$(dirname "$0")/ch.school.damagecheck.plist" /Library/LaunchAgents/
xattr -dr com.apple.quarantine /Users/Shared/Damage\ Check.app
launchctl load /Library/LaunchAgents/ch.school.damagecheck.plist
echo "✅ Installation terminée — teste en ouvrant une session élève."