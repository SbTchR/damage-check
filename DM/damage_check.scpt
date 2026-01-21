on run
    set theID to do shell script "cat /Users/Shared/computer_id.txt"
    set theUser to do shell script "whoami"
    set theURL to "https://sbtchr.github.io/damage-check/student.html?pc=" & theID & "&user=" & theUser
    tell application "Safari"
        activate
        open location theURL
    end tell
end run