# @viveeditor/element

<vive-editor> custom element for viveEditor: works in plain HTML forms and any framework.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install @viveeditor/element
```

## Usage

```html
<script type="module">
  import '@viveeditor/element/define'
</script>

<form>
  <vive-editor name="body" required locale="tr" label="Article body"></vive-editor>
</form>
```

`<vive-editor>` sends its HTML with the form, returns to its first value when the form resets and blocks submit while `required` and empty. `defineViveEditor('my-editor')` registers it under another tag name.

## License

MIT
