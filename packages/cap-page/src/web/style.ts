export const PAGE_EDITOR_STYLE = `
.page-editor{position:relative;min-width:0;width:100%;padding:6px 0 48px;color:var(--dsw-label);font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,sans-serif,"Apple Color Emoji","Segoe UI Emoji";font-size:16px;line-height:1.7;letter-spacing:-.003em}
.page-editor .tiptap{outline:none;min-height:240px}
.page-editor .tiptap>:first-child{margin-top:0}
.page-editor .tiptap p,.page-editor .tiptap h1,.page-editor .tiptap h2,.page-editor .tiptap h3,.page-editor .tiptap ul,.page-editor .tiptap ol,.page-editor .tiptap blockquote,.page-editor .tiptap pre{margin:2px 0}
.page-editor .tiptap p{min-height:1.7em}
.page-editor .tiptap h1{font-size:1.875em;font-weight:700;line-height:1.3;margin-top:.9em}
.page-editor .tiptap h2{font-size:1.5em;font-weight:650;line-height:1.3;margin-top:.75em}
.page-editor .tiptap h3{font-size:1.25em;font-weight:650;line-height:1.3;margin-top:.6em}
.page-editor .tiptap [data-heading-plugin]{border-radius:8px}
.page-editor .page-block{margin:12px 0;position:relative;z-index:0;isolation:isolate;overflow:hidden}
.page-editor .page-block.ProseMirror-selectednode{outline:none;box-shadow:none}
.page-editor .page-block[data-page-block=excalidraw]{outline:none;box-shadow:none;border:0;-webkit-user-drag:none}
.page-editor .page-block-missing{padding:12px 14px;border:1px dashed var(--dsw-border);border-radius:8px;color:var(--dsw-label-3);font-size:13px}
.page-editor .tiptap ul,.page-editor .tiptap ol{padding-left:1.6em}
.page-editor .tiptap li{margin:1px 0}
.page-editor .tiptap blockquote{margin-left:0;padding-left:14px;border-left:3px solid var(--dsw-border);color:var(--dsw-label-2)}
.page-editor .tiptap hr{border:0;border-top:1px solid var(--dsw-border);margin:18px 0}
.page-editor .tiptap code{padding:.12em .35em;border-radius:4px;background:var(--dsw-hover);font-family:var(--font-mono);font-size:.9em}
.page-editor .tiptap pre{padding:12px 14px;border-radius:6px;background:var(--dsw-input);overflow:auto}
.page-editor .tiptap pre code{padding:0;background:transparent;font-size:13px;line-height:1.6}
.page-editor .tiptap a{color:var(--dsw-business);text-underline-offset:2px}
.page-editor .tiptap p.is-editor-empty:first-child::before,
.page-editor .tiptap .is-empty::before{content:attr(data-placeholder);float:left;height:0;pointer-events:none;color:var(--dsw-label-3)}
.page-bubble{z-index:80;background:var(--dsw-sidebar);border:1px solid var(--dsw-border);box-shadow:0 8px 28px rgba(15,15,15,.12),0 0 0 1px color-mix(in srgb,var(--dsw-border) 70%,transparent);border-radius:10px;overflow:hidden}
.page-slash{position:fixed;z-index:10000;width:324px;max-height:min(70vh,420px);padding:6px;display:flex;flex-direction:column;gap:2px;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;background:var(--dsw-sidebar);border:1px solid var(--dsw-border);box-shadow:0 8px 28px rgba(15,15,15,.12),0 0 0 1px color-mix(in srgb,var(--dsw-border) 70%,transparent);border-radius:10px}
.page-slash-head,.page-slash-empty{padding:6px 8px;color:var(--dsw-label-3);font-size:12px;font-weight:600}
.page-slash-head{position:sticky;top:0;z-index:1;margin:-6px -6px 0;padding:12px 14px 8px;background:var(--dsw-sidebar)}
.page-slash-item{display:flex;align-items:center;gap:10px;width:100%;margin:0;border:0;border-radius:8px;padding:6px 8px;background:transparent;color:var(--dsw-label);font:inherit;text-align:left;cursor:pointer}
.page-slash-item:hover,.page-slash-item.is-active{background:var(--dsw-hover)}
.page-slash-icon{flex:none;display:grid;place-items:center;width:46px;height:46px;border-radius:8px;border:1px solid var(--dsw-border);background:var(--dsw-input);color:var(--dsw-label-2);font-size:16px;font-weight:700}
.page-slash-copy{min-width:0;display:flex;flex-direction:column;gap:1px}
.page-slash-label{font-size:14px;font-weight:600;line-height:1.2}
.page-slash-hint{font-size:12px;color:var(--dsw-label-3);line-height:1.2}
.page-bubble{display:flex;align-items:center;gap:2px;padding:4px}
.page-bubble button{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;margin:0;border:0;border-radius:6px;padding:0 7px;background:transparent;color:var(--dsw-label);font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.page-bubble button:hover,.page-bubble button.is-on{background:var(--dsw-hover)}
.page-bubble button.is-on{color:var(--dsw-business)}
`
