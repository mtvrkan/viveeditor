---
"@viveeditor/ext-image": minor
"@viveeditor/ui": minor
"viveeditor": minor
---

Selected images get four corner handles with a live size badge. Dragging a corner keeps the aspect ratio, stays between 16 px and the content width, and saves whole-pixel `width` and `height` in one undo step; double-clicking a handle returns to the natural size. Touch targets are 44 px and only the handles stop scrolling. The new `resizable` option turns the handles off, and the new `resizeImage`, `resetImageSize` and `replaceImage` commands and the `imageReplaceMode` query are available in code. The image panel adds width and height fields with "Keep aspect ratio" and "Reset size", and a "Crop" button that also sits in the image's right-click menu. The crop dialog, loaded with the other panels, offers Free, 1:1, 4:3, 16:9 and Original presets, works with mouse, touch and keyboard, and sends the cropped file through the `upload` function or embeds it when `allowBase64` is on. Cross-origin images without CORS show an explanation instead of failing.
