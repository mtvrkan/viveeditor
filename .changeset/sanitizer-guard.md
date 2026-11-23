---
'@viveeditor/sanitize': minor
---

`sanitizeHtml` refuses HTML with more than `maxTags` opening tags (100 000 by default, set it with the new `maxTags` option) and HTML that contains a `<template>` tag, both with `TOO_COMPLEX`. The number of elements a parse may create is now capped by `maxTags` as well.
