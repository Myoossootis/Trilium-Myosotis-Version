/* Auto-convert clearly delimited TeX pasted into a Trilium text editor. */
(function () {
    // Trilium has used both class names across CKEditor builds.  Listening on
    // the document keeps this working when the active note editor is replaced.
    const editorSelector = ".ck-content[contenteditable='true'], .ck-editor__editable[contenteditable='true']";

    function isEditorTarget(event) {
        if (event.target instanceof Element && event.target.closest(editorSelector)) return true;
        return event.composedPath?.().some((node) => node instanceof Element && node.matches(editorSelector)) ?? false;
    }

    function formulaFromClipboard(rawText) {
        const text = String(rawText || "").trim();
        if (!text) return null;
        let match;
        if ((match = text.match(/^\$\$([\s\S]+?)\$\$$/))) return { equation: match[1].trim(), display: true };
        if ((match = text.match(/^\\\[([\s\S]+?)\\\]$/))) return { equation: match[1].trim(), display: true };
        if ((match = text.match(/^\\begin\{(equation\*?|align\*?|alignat\*?|gather\*?|CD)\}([\s\S]+?)\\end\{\1\}$/))) return { equation: `\\begin{${match[1]}}${match[2]}\\end{${match[1]}}`, display: true };
        if ((match = text.match(/^\\\(([\s\S]+?)\\\)$/))) return { equation: match[1].trim(), display: false };
        if ((match = text.match(/^\$(?!\$)([^\n$]+?)\$$/))) return { equation: match[1].trim(), display: false };

        // Undelimited TeX is accepted only for clear command-based formulas.
        // This deliberately leaves ordinary text like A/B or C++ untouched.
        if (/^\\(?:frac|dfrac|tfrac|sqrt|sum|prod|int|iint|iiint|oint|lim|sin|cos|tan|log|ln|exp|alpha|beta|gamma|delta|omega|pi|theta|vec|mathrm|text|left|right|begin)(?![A-Za-z])/.test(text)) {
            return { equation: text, display: /\\(?:sum|prod|int|iint|iiint|oint|begin)(?![A-Za-z])/.test(text) };
        }
        return null;
    }

    async function insertFormula(editorOrPromise, formula) {
        // The frontend script API wraps context access in a Promise in the
        // desktop build, even though the underlying CKEditor is synchronous.
        const editor = await editorOrPromise;
        if (!editor?.commands?.get("math")) throw new Error("公式编辑器尚未就绪");
        editor.execute("math", formula.equation, formula.display, "span", false);

        // CKEditor selects an inserted object widget.  Leaving the math
        // widget selected makes the next click/keystroke reopen MathUI with
        // the last equation, which feels like a random formula popup.  Move
        // the caret to the position immediately after the newly inserted
        // widget so normal typing continues in the note.
        const selected = editor.model?.document?.selection?.getSelectedElement?.();
        if (selected?.name === "mathtex-display") {
            editor.model.change((writer) => {
                // A block math object cannot hold a caret.  Reuse the
                // paragraph that follows it, or create one when the formula
                // was inserted before a heading/another block object.
                let paragraph = selected.parent?.getChild?.(selected.index + 1);
                if (!paragraph || paragraph.name !== "paragraph") {
                    paragraph = writer.createElement("paragraph");
                    writer.insert(paragraph, writer.createPositionAfter(selected));
                }
                writer.setSelection(paragraph, "in");
            });
        } else if (selected?.name === "mathtex-inline") {
            editor.model.change((writer) => {
                writer.setSelection(writer.createPositionAfter(selected));
            });
        }
        editor.editing.view.focus();
    }

    document.addEventListener("paste", (event) => {
        if (!isEditorTarget(event)) return;
        const rawText = event.clipboardData?.getData("text/plain") ?? "";
        const formula = formulaFromClipboard(rawText);
        if (!formula) return;

        // Check that a context exists before taking over the paste.  The
        // returned value is a Promise in the desktop API, so the actual math
        // command is awaited below.
        let editorOrPromise;
        try {
            editorOrPromise = api.getActiveContextTextEditor();
            if (!editorOrPromise) return;
        } catch (error) {
            console.warn("Automatic formula paste could not find the active editor", error);
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        void insertFormula(editorOrPromise, formula).catch((error) => {
            console.warn("Automatic formula paste failed", error);
            // Do not lose the user's paste if a future editor build changes
            // the math command signature.
            api.addTextToActiveContextEditor(rawText);
            api.showError("公式自动转换失败，已保留原始文本，可按 Ctrl+M 手动插入。");
        });
    }, true);
})();
