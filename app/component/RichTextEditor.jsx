import React, { useEffect, useRef, useState } from "react";

// Load Quill's CSS as a string.
// This does NOT execute Quill JS during SSR.
import quillSnowCss from "quill/dist/quill.snow.css?raw";

const TOOLBAR = [
    ["bold", "italic"],
    ["link"],
    ["clean"],
];

export default function RichTextEditor({
    label,
    value,
    onChange,
    specialclass
}) {
    const editorRef = useRef(null);
    const quillRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        let quill = null;

        async function initializeQuill() {
            try {
                // IMPORTANT:
                // Never put `import Quill from "quill"` at the top.
                // Quill accesses `document` during module evaluation.
                const { default: Quill } = await import("quill");

                if (
                    cancelled ||
                    !editorRef.current ||
                    quillRef.current
                ) {
                    return;
                }

                quill = new Quill(editorRef.current, {
                    theme: "snow",

                    modules: {
                        toolbar: TOOLBAR,
                    },

                    formats: [
                        "bold",
                        "italic",
                        "link",
                    ],
                });

                quillRef.current = quill;

                // Set initial value
                if (value) {
                    quill.clipboard.dangerouslyPasteHTML(
                        value,
                        "silent"
                    );
                }

                const handleTextChange = (
                    delta,
                    oldDelta,
                    source
                ) => {
                    if (source !== "user") {
                        return;
                    }

                    onChange?.(quill.root.innerHTML);
                };

                quill.on(
                    "text-change",
                    handleTextChange
                );

                if (!cancelled) {
                    setLoading(false);
                }
            } catch (err) {
                console.error(
                    "Failed to initialize Quill:",
                    err
                );

                if (!cancelled) {
                    setLoading(false);
                    setError(true);
                }
            }
        }

        initializeQuill();

        return () => {
            cancelled = true;

            if (quill) {
                quill.off("text-change");
            }

            quillRef.current = null;
        };
    }, []);

    // Keep Quill synchronized with React state.
    useEffect(() => {
        const quill = quillRef.current;

        if (!quill) {
            return;
        }

        const html = value || "";

        if (quill.root.innerHTML !== html) {
            quill.clipboard.dangerouslyPasteHTML(
                html,
                "silent"
            );
        }
    }, [value]);

    const class_n = specialclass ? specialclass : 'default_editor'

    return (
        <>
            {/* 
                Quill's COMPLETE Snow CSS.
                It is embedded directly into this component,
                so no external CSS loading/order is required.
            */}
            <style>{quillSnowCss}</style>

            {/* Our Shopify-specific overrides */}
            <style>{`
                .rich-text-editor-wrapper {
                    width: 100%;
                }

                /*
                 * Keep Quill's own Snow toolbar styling,
                 * only adjust the outside appearance.
                 */
                .rich-text-editor-wrapper
                    .ql-toolbar.ql-snow {
                    border: 1px solid #c9cccf;
                    border-radius: 6px 6px 0 0;
                    background: #f6f6f7;
                }

                .rich-text-editor-wrapper
                    .ql-container.ql-snow {
                    border: 1px solid #c9cccf;
                    border-top: 0;
                    border-radius: 0 0 6px 6px;

                    background: #ffffff;

                    font-size: 14px;
                }

                .rich-text-editor-wrapper
                    .ql-editor {
                    min-height: 150px;
                    padding: 12px;
                    font-size: 14px;
                    line-height: 1.5;
                }

                .rich-text-editor-wrapper
                    .ql-editor.ql-blank::before {
                    color: #8c9196;
                    font-style: normal;
                }

                .rich-text-editor-wrapper
                    .ql-toolbar button {
                    box-sizing: border-box;
                }

                .rich-text-editor-wrapper
                    .ql-toolbar button:hover {
                    color: #2c6ecb;
                }

                .rich-text-editor-wrapper
                    .ql-toolbar button.ql-active {
                    color: #2c6ecb;
                }

                .rich-text-editor-loading {
                    min-height: 186px;

                    display: flex;
                    align-items: center;
                    justify-content: center;

                    border: 1px solid #c9cccf;
                    border-radius: 6px;

                    background: #fafafa;
                    font-size: 13px;
                }

                .rich-text-editor-fallback {
                    width: 100%;
                    min-height: 150px;
                    box-sizing: border-box;
                    padding: 12px;
                    border: 1px solid #c9cccf;
                    border-radius: 6px;
                    resize: vertical;
                    font-size: 14px;
                    line-height: 1.5;
                }
                .rich-text-editor-wrapper .ql-container.ql-snow,.rich-text-editor-wrapper .ql-toolbar.ql-snow{border:0;background:transparent;}
                .rich-text-editor-wrapper .ql-toolbar.ql-snow{border-bottom:1px solid #c9cccf;}
                .policy_editor .rich-text-editor-wrapper .ql-editor{min-height:90px;}
            `}</style>

            <s-box
                paddingBlockEnd="400"
                border="base"
                borderRadius="base"
                borderColor="strong"
            >
                {label && (
                    <s-box paddingBlockEnd="200">
                        <s-text
                            as="label"
                            variant="bodyMd"
                            fontWeight="medium"
                        >
                            {label}
                        </s-text>
                    </s-box>
                )}
                <div className={class_n}>
                    <div className="rich-text-editor-wrapper">
                        {error ? (
                            <textarea
                                className="rich-text-editor-fallback"
                                value={value || ""}
                                onChange={(event) =>
                                    onChange?.(
                                        event.target.value
                                    )
                                }
                            />
                        ) : (
                            <>
                                {loading && (
                                    <div className="rich-text-editor-loading">
                                        Loading editor...
                                    </div>
                                )}

                                <div
                                    ref={editorRef}
                                    style={{
                                        display: loading
                                            ? "none"
                                            : "block",
                                    }}
                                />
                            </>
                        )}
                    </div>
                </div>
            </s-box>
        </>
    );
}