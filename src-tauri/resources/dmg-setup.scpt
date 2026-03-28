tell application "Finder"
  tell disk "LotoLab"
    open
    set current view of container window to icon view
    set toolbar visible of container window to false
    set statusbar visible of container window to false
    set the bounds of container window to {100, 100, 640, 400}
    set viewOptions to the icon view options of container window
    set arrangement of viewOptions to not arranged
    set icon size of viewOptions to 80
    set position of item "LotoLab.app" of container window to {160, 150}
    set position of item "Applications" of container window to {480, 150}
    close
    open
    update without registering applications
    delay 2
  end tell
end tell
