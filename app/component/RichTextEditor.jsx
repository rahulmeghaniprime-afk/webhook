import React, { useState, useEffect } from "react";

import "react-quill-new/dist/quill.snow.css";

export default function RichTextEditor({ label, value, onChange }) {
    const [QuillEditor, setQuillEditor] = useState(null);

    // Remix runs on the server first, but Quill needs the browser (window object).
    // This useEffect ensures Quill only loads on the client side.
    useEffect(() => {
        import("react-quill-new").then((module) => {
            setQuillEditor(() => module.default);
        });
    }, []);

    // We explicitly define only the tools you asked for: bold, italic, links, and lists
    const modules = {
        toolbar: [
            ["bold", "italic"],
            ["link"],
            [{ list: "ordered" }, { list: "bullet" }],
            ["clean"], // Adds a button to clear formatting
        ],
    };

    if (!QuillEditor) {
        return <s-text>Loading editor...</s-text>;
    }

    return (
        <s-box paddingBlockEnd="400" border="base" borderRadius="base">
            {label && (
                <s-box paddingBlockEnd="200">
                    <s-text as="label" variant="bodyMd" fontWeight="medium">
                        {label}
                    </s-text>
                </s-box>
            )}
            <div className="shopify-style-editor">
                <QuillEditor
                    theme="snow"
                    value={value}
                    onChange={onChange}
                    modules={modules}
                />
            </div>

            {/* Quick CSS override to make Quill match Shopify Polaris styling */}
            <style>{`
        .shopify-style-editor .ql-toolbar.ql-snow {
          border: 1px solid var(--p-color-border-default);
          border-top-left-radius: var(--p-border-radius-200);
          border-top-right-radius: var(--p-border-radius-200);
          background-color: var(--p-color-bg-surface-secondary);
        }
        .shopify-style-editor .ql-container.ql-snow {
          border: 1px solid var(--p-color-border-default);
          border-top: none;
          border-bottom-left-radius: var(--p-border-radius-200);
          border-bottom-right-radius: var(--p-border-radius-200);
          font-family: var(--p-font-family-sans);
          min-height: 150px;
        }
        .shopify-style-editor .ql-editor:focus {
          outline: none;
        }
      `}</style>
        </s-box>
    );
}