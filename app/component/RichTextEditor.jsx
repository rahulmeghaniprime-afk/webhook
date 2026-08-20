import React, { useState, useEffect, useMemo } from "react";
import "react-quill-new/dist/quill.snow.css";

// Global cache and singleton loader to prevent duplicate imports and race conditions
let CachedQuill = null;
let loadPromise = null;

function getQuill() {
    if (typeof window === "undefined") {
        return Promise.resolve(null);
    }
    if (CachedQuill) {
        return Promise.resolve(CachedQuill);
    }
    if (!loadPromise) {
        loadPromise = import("react-quill-new")
            .then((module) => {
                CachedQuill = module.default?.default || module.default || module;
                return CachedQuill;
            })
            .catch((err) => {
                console.error("Failed to load ReactQuill:", err);
                loadPromise = null; // Allow retry on failure
                throw err;
            });
    }
    return loadPromise;
}

// Pre-trigger loading immediately in client browser
if (typeof window !== "undefined") {
    getQuill().catch(() => { });
}

// Stable toolbar modules to avoid Quill re-instantiating on every render
const DEFAULT_MODULES = {
    toolbar: [
        ["bold", "italic"],
        ["link"],
        ["clean"],
    ],
};

export default function RichTextEditor({ label, value, onChange }) {
    const [QuillEditor, setQuillEditor] = useState(() => CachedQuill);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        if (!QuillEditor) {
            getQuill()
                .then((editor) => {
                    if (isMounted && editor) {
                        setQuillEditor(() => editor);
                    }
                })
                .catch(() => {
                    if (isMounted) {
                        setHasError(true);
                    }
                });
        }
        return () => {
            isMounted = false;
        };
    }, [QuillEditor]);

    const modules = useMemo(() => DEFAULT_MODULES, []);

    return (
        <s-box paddingBlockEnd="400" border="base" borderRadius="base" borderColor="strong">
            {label && (
                <s-box paddingBlockEnd="200">
                    <s-text as="label" variant="bodyMd" fontWeight="medium">
                        {label}
                    </s-text>
                </s-box>
            )}

            <div className="shopify-style-editor">
                {QuillEditor ? (
                    <QuillEditor
                        theme="snow"
                        value={value || ""}
                        onChange={onChange}
                        modules={modules}
                    />
                ) : hasError ? (
                    <div style={{ padding: "12px", border: "1px solid #d72c0d", borderRadius: "6px", background: "#fff4f4" }}>
                        <div style={{ fontSize: "12px", color: "#d72c0d", marginBottom: "8px" }}>
                            Rich text editor could not load. You can still edit HTML directly:
                        </div>
                        <textarea
                            value={value || ""}
                            onChange={(e) => onChange(e.target.value)}
                            rows={4}
                            style={{
                                width: "100%",
                                boxSizing: "border-box",
                                padding: "8px",
                                fontSize: "13px",
                                border: "1px solid #c9cccf",
                                borderRadius: "4px",
                            }}
                        />
                    </div>
                ) : (
                    <div
                        style={{
                            minHeight: "150px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "#fafafa",
                            border: "1px solid #e1e3e5",
                            borderRadius: "6px",
                            color: "#6d7175",
                            fontSize: "13px",
                            gap: "8px",
                        }}
                    >
                        <span>Loading editor...</span>
                    </div>
                )}
            </div>

            {/* CSS override to match Shopify Polaris styling */}
            <style>{`
                .shopify-style-editor .ql-toolbar.ql-snow {
                    border: 1px solid var(--p-color-border-default, #c9cccf);
                    border-top-left-radius: var(--p-border-radius-200, 6px);
                    border-top-right-radius: var(--p-border-radius-200, 6px);
                    background-color: var(--p-color-bg-surface-secondary, #f6f6f7);
                    border-bottom: 1px solid rgba(204, 204, 204, 1);
                }
                .shopify-style-editor .ql-container.ql-snow {
                    border: 1px solid var(--p-color-border-default, #c9cccf);
                    border-top: none;
                    border-bottom-left-radius: var(--p-border-radius-200, 6px);
                    border-bottom-right-radius: var(--p-border-radius-200, 6px);
                    font-family: var(--p-font-family-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
                    min-height: 150px;
                    background: #ffffff;
                }
                .shopify-style-editor .ql-editor:focus {
                    outline: none;
                }
            `}</style>
        </s-box>
    );
}