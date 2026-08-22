import { authenticate } from "../shopify.server";
import { useLoaderData } from "react-router";
import RichTextEditor from '../component/RichTextEditor';
import { useState } from "react";

export const loader = async ({ request }) => {
    await authenticate.admin(request);
    const url = new URL(request.url);
    const formName = url.searchParams.get('name') || 'New B2B Form';
    return { formName };
};

// 9 Supported Field Types with Icons
const FIELD_TYPES = [
    {
        type: "text",
        title: "Single-line text",
        description: "Short single-line text input",
        defaultLabel: "Full Name",
        defaultPlaceholder: "Enter full name...",
        hasOptions: false,
        icon: "text-font",
    },
    {
        type: "select",
        title: "Dropdown list",
        description: "Select one option from a dropdown menu",
        defaultLabel: "Business Type",
        defaultPlaceholder: "Select an option...",
        hasOptions: true,
        defaultOptions: [
            { id: "opt_1", label: "Retailer / Storefront", value: "retailer" },
            { id: "opt_2", label: "Wholesaler / Distributor", value: "wholesaler" },
            { id: "opt_3", label: "Corporate / Institutional", value: "corporate" },
        ],
        icon: "caret-down",
    },
    {
        type: "radio",
        title: "Radio buttons",
        description: "Choose one option from visible radio choices",
        defaultLabel: "Company Size",
        defaultPlaceholder: "",
        hasOptions: true,
        defaultOptions: [
            { id: "opt_1", label: "1 - 10 Employees", value: "1_10" },
            { id: "opt_2", label: "11 - 50 Employees", value: "11_50" },
            { id: "opt_3", label: "50+ Employees", value: "50_plus" },
        ],
        icon: "radio-control",
    },
    {
        type: "textarea",
        title: "Multi-line text",
        description: "Multi-line paragraph / message text area",
        defaultLabel: "Company Description / Note",
        defaultPlaceholder: "Provide details about your business and bulk purchase needs...",
        hasOptions: false,
        icon: "text-align-left",
    },
    {
        type: "checkbox_group",
        title: "Multiple choice",
        description: "Multiple choice checkboxes",
        defaultLabel: "Interested Product Categories",
        defaultPlaceholder: "",
        hasOptions: true,
        defaultOptions: [
            { id: "opt_1", label: "Raw Materials", value: "raw_materials" },
            { id: "opt_2", label: "Finished Goods", value: "finished_goods" },
            { id: "opt_3", label: "Custom Packaging", value: "custom_packaging" },
        ],
        icon: "checkbox",
    },
    {
        type: "date",
        title: "Date",
        description: "Date picker for orders, timeline or registration",
        defaultLabel: "Target Launch Date",
        defaultPlaceholder: "",
        hasOptions: false,
        icon: "calendar",
    },
    {
        type: "number",
        title: "Number",
        description: "Numeric input for quantity, annual budget or tax ID",
        defaultLabel: "Estimated Monthly Order Quantity",
        defaultPlaceholder: "100",
        hasOptions: false,
        icon: "number-one",
    },
    {
        type: "file",
        title: "File upload",
        description: "Upload business licenses, tax exempt certificates",
        defaultLabel: "Business Certificate / Resale License",
        defaultPlaceholder: "",
        hasOptions: false,
        icon: "file",
    },
    {
        type: "phone",
        title: "Phone",
        description: "Phone number with international format",
        defaultLabel: "Company Contact Phone",
        defaultPlaceholder: "+1 (555) 000-0000",
        hasOptions: false,
        icon: "phone",
    }
];

export default function New() {
    const { formName } = useLoaderData();
    const [title, setTitle] = useState('B2B Form Application');
    const [description, setDescription] = useState('Applied for B2B for Bulk Purchase and Contracts with required detail we will verify if approved specialize treatment given');
    const [buttonlabel, setButtonLabel] = useState('Submit');
    const [policies, setPolicies] = useState('By signing up, you agree to receive marketing emails. View our privacy policy and terms of service for more info.');

    // Initial default form fields
    const [fields, setFields] = useState([
        {
            id: "f_name",
            type: "text",
            label: "Company / Contact Name",
            placeholder: "Enter company or representative name...",
            required: true,
            options: []
        },
        {
            id: "f_type",
            type: "select",
            label: "Business Entity Type",
            placeholder: "Select your business type...",
            required: true,
            options: [
                { id: "opt_1", label: "Wholesaler / Reseller", value: "wholesaler" },
                { id: "opt_2", label: "Corporate Account", value: "corporate" },
                { id: "opt_3", label: "Retail Partner", value: "retail_partner" }
            ]
        },
        {
            id: "f_size",
            type: "radio",
            label: "Expected Order Volume",
            placeholder: "",
            required: false,
            options: [
                { id: "opt_r1", label: "$5,000 - $20,000 / month", value: "tier_1" },
                { id: "opt_r2", label: "$20,000 - $100,000 / month", value: "tier_2" },
                { id: "opt_r3", label: "$100,000+ / month", value: "tier_3" }
            ]
        }
    ]);

    // Active field being configured in Popover
    const [activeConfigId, setActiveConfigId] = useState(null);
    // State to toggle field picker dropdown/popover
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    const handleRichText = (e) => {
        setDescription(e);
    };

    // Add field of selected type
    const addField = (fieldTypeDef) => {
        const newId = `field_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newField = {
            id: newId,
            type: fieldTypeDef.type,
            label: fieldTypeDef.defaultLabel,
            placeholder: fieldTypeDef.defaultPlaceholder,
            required: false,
            options: fieldTypeDef.hasOptions
                ? fieldTypeDef.defaultOptions.map(opt => ({ ...opt, id: `opt_${Date.now()}_${Math.random().toString(36).substring(2, 5)}` }))
                : []
        };
        setFields(prev => [...prev, newField]);
        setIsPickerOpen(false);
        setActiveConfigId(newId);
    };

    // Update field properties
    const updateField = (id, updates) => {
        setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    // Delete field
    const removeField = (id) => {
        setFields(prev => prev.filter(f => f.id !== id));
        if (activeConfigId === id) {
            setActiveConfigId(null);
        }
    };

    // Move field up/down
    const moveField = (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= fields.length) return;
        setFields(prev => {
            const next = [...prev];
            const [item] = next.splice(index, 1);
            next.splice(targetIndex, 0, item);
            return next;
        });
    };

    // Option management for select, radio, checkbox_group
    const addOption = (fieldId) => {
        setFields(prev => prev.map(f => {
            if (f.id !== fieldId) return f;
            const optIndex = (f.options?.length || 0) + 1;
            const newOpt = {
                id: `opt_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                label: `Option ${optIndex}`,
                value: `option_${optIndex}`
            };
            return { ...f, options: [...(f.options || []), newOpt] };
        }));
    };

    const updateOption = (fieldId, optionId, key, value) => {
        setFields(prev => prev.map(f => {
            if (f.id !== fieldId) return f;
            return {
                ...f,
                options: f.options.map(opt => opt.id === optionId ? { ...opt, [key]: value } : opt)
            };
        }));
    };

    const removeOption = (fieldId, optionId) => {
        setFields(prev => prev.map(f => {
            if (f.id !== fieldId) return f;
            return {
                ...f,
                options: f.options.filter(opt => opt.id !== optionId)
            };
        }));
    };

    return (
        <>
            <style>{`
                /* =========================================================
                   FIELD BUILDER STYLES
                ========================================================= */
                .field-item-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border: 1px solid #e3e3e3; border-radius: 8px; margin-bottom: 8px; background: #ffffff; cursor: pointer; transition: all 0.15s ease-in-out; }
                .field-item-row:hover { background: #f7f8f9; border-color: #c9cccf; }
                .field-item-row.is-active { background: #f1f7fe; border-color: #2c6ecb; box-shadow: 0 0 0 1px #2c6ecb; }
                .field-type-badge { font-size: 11px; font-weight: 500; color: #5c5f62; background: #f1f2f3; padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; }
                .required-tag { font-size: 10px; font-weight: 600; color: #d72c0d; background: #ffebeb; padding: 2px 6px; border-radius: 4px; margin-left: 4px; }
                .field-action-btn { background: transparent; border: none; color: #5c5f62; cursor: pointer; padding: 5px; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: background 0.1s ease; line-height: 1; }
                .field-action-btn:hover { background: #e4e5e7; color: #202223; }
                .field-action-btn:disabled { opacity: 0.3; cursor: not-allowed; }
                .field-action-btn.delete-btn:hover { background: #fedcdb; color: #d72c0d; }
                .picker-popover-menu { background: #fff; border: 1px solid #c9cccf; border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.12); padding: 6px; margin-top: 6px; max-height: 380px; overflow-y: auto; z-index: 1000; }
                .picker-option-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 6px; border: none; background: transparent; width: 100%; text-align: left; cursor: pointer; color: #202223; font-size: 13px; font-weight: 500; transition: background 0.1s ease; font-family: inherit; }
                .picker-option-item:hover { background: #f1f2f4; }
                .picker-option-icon { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; background: #f6f6f7; color: #303030; flex-shrink: 0; }
                .field-config-container { background: #fbfbfb; border: 1px solid #cce0ff; border-radius: 8px; padding: 14px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,91,211,0.08); }
                .config-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 10px; margin-bottom: 12px; border-bottom: 1px solid #e1e9f4; }
                .config-option-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
                .config-input { width: 100%; box-sizing: border-box; padding: 6px 10px; font-size: 13px; border: 1px solid #c9cccf; border-radius: 6px; background: #fff; outline: none; transition: border 0.15s ease; font-family: inherit; }
                .config-input:focus { border-color: #005bd3; box-shadow: 0 0 0 1px #005bd3; }
                .opt-add-btn { display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; font-size: 12px; font-weight: 500; color: #005bd3; background: #f0f6ff; border: 1px dashed #7ab1ff; border-radius: 6px; cursor: pointer; margin-top: 6px; transition: all 0.15s ease; font-family: inherit; }
                .opt-add-btn:hover { background: #e0eeff; border-color: #005bd3; }
                .opt-remove-btn { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: #fff; border: 1px solid #e1e3e5; border-radius: 6px; color: #8c9196; cursor: pointer; flex-shrink: 0; transition: all 0.15s ease; }
                .opt-remove-btn:hover { background: #fff0f0; border-color: #ffb8b8; color: #d72c0d; }
                /* =========================================================
                   LIVE PREVIEW - Full Storefront Simulation
                ========================================================= */
                .preview-shell { background: #f0f0f0; border-radius: 10px; overflow: hidden; border: 1px solid #d5d5d5; font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif; }
                .preview-browser-bar { background: #e8e8e8; border-bottom: 1px solid #d0d0d0; padding: 8px 12px; display: flex; align-items: center; gap: 10px; }
                .preview-browser-dots { display: flex; gap: 5px; }
                .preview-browser-dot { width: 11px; height: 11px; border-radius: 50%; }
                .preview-browser-url { flex: 1; background: #fff; border: 1px solid #c4c4c4; border-radius: 20px; padding: 3px 12px; font-size: 11px; color: #555; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .preview-storefront { background: #ffffff; min-height: 500px; }
                .preview-nav { background: #1a1a1a; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; }
                .preview-nav-logo { font-size: 16px; font-weight: 700; color: #fff; letter-spacing: 1px; text-transform: uppercase; }
                .preview-nav-links { display: flex; gap: 18px; }
                .preview-nav-link { font-size: 12px; color: rgba(255,255,255,0.7); }
                .preview-page-body { padding: 12px; max-width: 560px; margin: 0 auto; }
                .preview-form-card { background: #fff; border: 1px solid #e8e8e8; border-radius: 10px; padding: 10px; box-shadow: 0 2px 12px rgba(0,0,0,0.07); }
                .preview-form-title { font-size: 20px; font-weight: 700; color: #1a1a1a; text-align: center; margin: 0 0 8px 0; line-height: 1.3; }
                .preview-form-desc { font-size: 13px; color: #6d6d6d; text-align: center; margin: 0 0 20px 0; line-height: 1.5; }
                .preview-form-desc p { margin: 0; } .preview-form-desc a { color: #1a1a1a; }
                .preview-divider { border: none; border-top: 1px solid #ebebeb; margin: 0 0 20px 0; }
                .preview-field-group { margin-bottom: 16px; }
                .preview-field-label { display: block; font-size: 13px; font-weight: 600; color: #1a1a1a; margin-bottom: 6px; }
                .preview-required-star { color: #c0392b; margin-left: 2px; }
                .preview-input, .preview-select, .preview-textarea { width: 100%; box-sizing: border-box; padding: 9px 12px; font-size: 13px; border: 1px solid #d5d5d5; border-radius: 6px; background: #fafafa; color: #1a1a1a; outline: none; font-family: inherit; appearance: none; -webkit-appearance: none; }
                .preview-textarea { resize: vertical; min-height: 80px; }
                .preview-choice-group { display: flex; flex-direction: column; gap: 8px; }
                .preview-choice-label { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #1a1a1a; cursor: pointer; padding: 8px 12px; border: 1px solid #e0e0e0; border-radius: 6px; background: #fafafa;width:fit-content; }
                .preview-radio-input, .preview-checkbox-input { width: 16px; height: 16px; flex-shrink: 0; accent-color: #1a1a1a; cursor: pointer; }
                .preview-file-dropzone { border: 2px dashed #d0d0d0; border-radius: 8px; padding: 22px 16px; text-align: center; background: #fafafa; cursor: pointer; }
                .preview-file-icon { display: block; margin: 0 auto 8px auto; color: #888; }
                .preview-file-text { font-size: 12px; color: #555; margin: 0; }
                .preview-file-subtext { font-size: 11px; color: #999; margin: 4px 0 0 0; }
                .preview-empty-state { padding: 28px 16px; text-align: center; color: #a0a0a0; font-size: 12px; background: #f8f8f8; border-radius: 6px; border: 1px dashed #e0e0e0; line-height: 1.6; }
                .preview-submit-btn { display: block; width: 100%; background: #1a1a1a; color: #fff; border: none; border-radius: 6px; padding: 12px 20px; font-size: 14px; font-weight: 600; text-align: center; cursor: pointer; margin-top: 20px; font-family: inherit; letter-spacing: 0.2px; }
                .preview-policy-text { font-size: 11px; color: #999; text-align: center; margin-top: 14px; line-height: 1.5; }
                .preview-policy-text p { margin: 0; } .preview-policy-text a { color: #555; }
                .preview-footer { background: #1a1a1a; padding: 16px 24px; text-align: center; }
                .preview-footer-text { font-size: 11px; color: rgba(255,255,255,0.4); }
                .preview-field-hint { font-size: 11px; color: #999; margin-top: 4px; }
            `}</style>

            <s-page heading={formName}>
                <s-stack padding="base">
                    <s-heading><span style={{ display: 'block', fontSize: '18px' }}>{formName}</span></s-heading>
                </s-stack>

                <s-section heading="Form Settings & Fields">
                    <s-text-field label="Title" value={title} onChange={(e) => setTitle(e.target.value)}></s-text-field>

                    <s-box padding="small-300 none none none">
                        <s-text>Description</s-text>
                        <s-box padding="small-200 none none none">
                            <RichTextEditor value={description} onChange={handleRichText} />
                        </s-box>
                    </s-box>

                    {/* ======================================================== */}
                    {/* ADDED FIELDS LIST & BUILDER SECTION                      */}
                    {/* ======================================================== */}
                    <s-box padding="base none none none">
                        <s-stack direction="inline" justifyContent="space-between" alignItems="center" padding="none none small-300 none">
                            <s-heading><span style={{ fontSize: '14px', fontWeight: '600' }}>Form Fields ({fields.length})</span></s-heading>
                            <s-paragraph tone="neutral"><span style={{ fontSize: '12px', color: '#6d7175' }}>Click any field to edit settings</span></s-paragraph>
                        </s-stack>

                        {/* List of Added Form Fields */}
                        <div style={{ marginBottom: '10px' }}>
                            {fields.map((field, idx) => {
                                const typeMeta = FIELD_TYPES.find(t => t.type === field.type) || FIELD_TYPES[0];
                                const isSelected = activeConfigId === field.id;

                                return (
                                    <div key={field.id}>
                                        <div
                                            className={`field-item-row ${isSelected ? 'is-active' : ''}`}
                                            onClick={() => setActiveConfigId(isSelected ? null : field.id)}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                                <div className="picker-option-icon" style={{ width: '24px', height: '24px' }}>
                                                    <s-icon type={typeMeta.icon}></s-icon>
                                                </div>
                                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#202223' }}>
                                                        {field.label || typeMeta.title}
                                                    </span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                        <s-badge color="base" accessibilityLabel={typeMeta.title}>{typeMeta.title}</s-badge>
                                                        {field.required && <s-badge color="base" tone="critical"><span style={{ display: 'flex', fontSize: '10px', fontWeight: '400' }}>Required</span></s-badge>}
                                                        {typeMeta.hasOptions && (
                                                            <span style={{ fontSize: '11px', color: '#6d7175' }}>
                                                                • {field.options?.length || 0} choices
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Quick Actions (Move & Delete & Popover trigger) */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    title="Move Up"
                                                    disabled={idx === 0}
                                                    className="field-action-btn"
                                                    style={{ opacity: idx === 0 ? 0.3 : 1 }}
                                                    onClick={() => moveField(idx, -1)}
                                                >
                                                    <s-icon type="chevron-up"></s-icon>
                                                </button>
                                                <button
                                                    type="button"
                                                    title="Move Down"
                                                    disabled={idx === fields.length - 1}
                                                    className="field-action-btn"
                                                    style={{ opacity: idx === fields.length - 1 ? 0.3 : 1 }}
                                                    onClick={() => moveField(idx, 1)}
                                                >
                                                    <s-icon type="chevron-down"></s-icon>
                                                </button>
                                                <button
                                                    type="button"
                                                    title="Configure Field"
                                                    className="field-action-btn"
                                                    style={{ color: isSelected ? '#005bd3' : '#5c5f62' }}
                                                    onClick={() => setActiveConfigId(isSelected ? null : field.id)}
                                                >
                                                    <s-icon type="edit"></s-icon>
                                                </button>
                                                <button
                                                    type="button"
                                                    title="Delete Field"
                                                    className="field-action-btn delete-btn"
                                                    onClick={() => removeField(field.id)}
                                                >
                                                    <s-icon type="delete"></s-icon>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Field Configuration Box / Popover for this field */}
                                        {isSelected && (
                                            <div className="field-config-container">
                                                <div className="config-header">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div className="picker-option-icon" style={{ width: '22px', height: '22px' }}>
                                                            <s-icon type={typeMeta.icon}></s-icon>
                                                        </div>
                                                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#005bd3' }}>
                                                            Configure {typeMeta.title}
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="field-action-btn"
                                                        title="Close"
                                                        onClick={() => setActiveConfigId(null)}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>

                                                {/* Label Input */}
                                                <div style={{ marginBottom: '10px' }}>
                                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#303030', marginBottom: '4px' }}>
                                                        Field Label
                                                    </label>
                                                    <input
                                                        type="text"
                                                        className="config-input"
                                                        value={field.label}
                                                        placeholder="Enter field label..."
                                                        onChange={(e) => updateField(field.id, { label: e.target.value })}
                                                    />
                                                </div>

                                                {/* Placeholder (if applicable) */}
                                                {['text', 'textarea', 'number', 'phone', 'select'].includes(field.type) && (
                                                    <div style={{ marginBottom: '10px' }}>
                                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#303030', marginBottom: '4px' }}>
                                                            Placeholder Text
                                                        </label>
                                                        <input
                                                            type="text"
                                                            className="config-input"
                                                            value={field.placeholder || ''}
                                                            placeholder="Placeholder hint text..."
                                                            onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                                                        />
                                                    </div>
                                                )}

                                                {/* Required Checkbox Option */}
                                                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input
                                                        type="checkbox"
                                                        id={`req_${field.id}`}
                                                        checked={!!field.required}
                                                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                                        onChange={(e) => updateField(field.id, { required: e.target.checked })}
                                                    />
                                                    <label htmlFor={`req_${field.id}`} style={{ fontSize: '13px', color: '#202223', cursor: 'pointer', fontWeight: '500' }}>
                                                        Required field (customer must fill this)
                                                    </label>
                                                </div>

                                                {/* Options Configuration for Dropdown, Radio, Multiple Choice */}
                                                {typeMeta.hasOptions && (
                                                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e3e8ee' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#303030' }}>
                                                                Options & Choices
                                                            </span>
                                                            <span style={{ fontSize: '11px', color: '#6d7175' }}>
                                                                Label and Stored Value
                                                            </span>
                                                        </div>

                                                        {field.options?.map((opt, optIdx) => (
                                                            <div key={opt.id} className="config-option-row">
                                                                <span style={{ fontSize: '11px', color: '#8c9196', width: '16px' }}>{optIdx + 1}.</span>
                                                                <input
                                                                    type="text"
                                                                    className="config-input"
                                                                    placeholder="Option label"
                                                                    value={opt.label}
                                                                    onChange={(e) => updateOption(field.id, opt.id, 'label', e.target.value)}
                                                                />
                                                                <input
                                                                    type="text"
                                                                    className="config-input"
                                                                    placeholder="Option value"
                                                                    value={opt.value}
                                                                    onChange={(e) => updateOption(field.id, opt.id, 'value', e.target.value)}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    title="Remove Option"
                                                                    className="opt-remove-btn"
                                                                    onClick={() => removeOption(field.id, opt.id)}
                                                                >
                                                                    <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                                                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        ))}

                                                        {/* Add Option / Add Values Button */}
                                                        <button
                                                            type="button"
                                                            className="opt-add-btn"
                                                            onClick={() => addOption(field.id)}
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                                                            </svg>
                                                            Add option / value
                                                        </button>
                                                    </div>
                                                )}

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e1e9f4' }}>
                                                    <button
                                                        type="button"
                                                        style={{ background: 'transparent', border: 'none', color: '#d72c0d', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}
                                                        onClick={() => removeField(field.id)}
                                                    >
                                                        Delete this field
                                                    </button>
                                                    <button
                                                        type="button"
                                                        style={{ background: '#005bd3', border: 'none', color: '#fff', fontSize: '12px', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}
                                                        onClick={() => setActiveConfigId(null)}
                                                    >
                                                        Done
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Add New Field Trigger Button */}
                        <div style={{ position: 'relative' }}>
                            <button
                                type="button"
                                className="picker-option-item"
                                onClick={() => setIsPickerOpen(!isPickerOpen)}
                                style={{
                                    border: '1px dashed #b5b5b5',
                                    borderRadius: '8px',
                                    padding: '10px 14px',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    gap: '8px',
                                    width: '100%',
                                    background: isPickerOpen ? '#f1f2f4' : '#ffffff',
                                    cursor: 'pointer'
                                }}
                            >
                                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                                <span style={{ fontSize: '13px', fontWeight: '600' }}>Add new field</span>
                            </button>

                            {/* Field Type Picker Popover / Dropdown Menu */}
                            {isPickerOpen && (
                                <div className="picker-popover-menu">
                                    <div style={{ padding: '4px 8px 8px 8px', fontSize: '11px', fontWeight: '600', color: '#6d7175', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Select Field Type
                                    </div>
                                    {FIELD_TYPES.map((typeOption) => (
                                        <button
                                            key={typeOption.type}
                                            type="button"
                                            className="picker-option-item"
                                            onClick={() => addField(typeOption)}
                                        >
                                            <div className="picker-option-icon">
                                                <s-icon type={typeOption.icon}></s-icon>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: '600', color: '#202223' }}>
                                                    {typeOption.title}
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#6d7175', fontWeight: 'normal' }}>
                                                    {typeOption.description}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </s-box>

                    {/* Button Label and Policies Section */}
                    <s-box padding="base none none none">
                        <s-text-field label="Button Label" value={buttonlabel} onChange={(e) => setButtonLabel(e.target.value)}></s-text-field>
                    </s-box>

                    <s-box padding="small-300 none none none">
                        <s-text>Privacy & Policies Text</s-text>
                        <s-box padding="small-200 none none none">
                            <RichTextEditor value={policies} onChange={(e) => setPolicies(e)} specialclass="policy_editor" />
                        </s-box>
                    </s-box>
                </s-section>

                {/* ======================================================== */}
                {/* LIVE PREVIEW PANE (Right Side / Aside)                   */}
                {/* ======================================================== */}
                <s-box slot="aside">

                    <s-stack padding="base">
                        <s-heading><span style={{ display: 'block', fontSize: '18px', opacity: '0', pointerEvents: 'none' }}>{formName}</span></s-heading>
                    </s-stack>
                    <s-box heading="Live Form Preview" padding="none">
                        <div className="preview-shell">
                            <div className="preview-browser-bar">
                                <div className="preview-browser-dots">
                                    <div className="preview-browser-dot" style={{ background: '#ff5f57' }}></div>
                                    <div className="preview-browser-dot" style={{ background: '#febc2e' }}></div>
                                    <div className="preview-browser-dot" style={{ background: '#28c840' }}></div>
                                </div>
                                <div className="preview-browser-url">your-store.myshopify.com/pages/wholesale-application</div>
                            </div>

                            <div className="preview-storefront">
                                <div className="preview-nav">
                                    <div className="preview-nav-links">
                                        <s-icon type="menu" color="subdued"></s-icon>
                                    </div>
                                    <div className="preview-nav-logo">YourStore</div>
                                    <div className="preview-nav-links">
                                        <s-icon type="cart" color="subdued"></s-icon>
                                    </div>
                                </div>

                                <div className="preview-page-body">
                                    <div className="preview-form-card">
                                        <h2 className="preview-form-title">{title || 'Form Title'}</h2>

                                        {description && (
                                            <div className="preview-form-desc" dangerouslySetInnerHTML={{ __html: description }} />
                                        )}

                                        <hr className="preview-divider" />

                                        {fields.length === 0 ? (
                                            <div className="preview-empty-state">
                                                No form fields added yet.<br />
                                                Use <strong>"Add new field"</strong> to customise this form.
                                            </div>
                                        ) : (
                                            fields.map((field) => (
                                                <div key={field.id} className="preview-field-group">
                                                    <label className="preview-field-label">
                                                        {field.label || 'Untitled Field'}
                                                        {field.required && <span className="preview-required-star">*</span>}
                                                    </label>

                                                    {field.type === 'text' && (
                                                        <input type="text" className="preview-input" placeholder={field.placeholder || `Enter ${field.label || 'text'}...`} />
                                                    )}

                                                    {field.type === 'select' && (
                                                        <select className="preview-select" defaultValue="">
                                                            <option value="" disabled>{field.placeholder || 'Select an option...'}</option>
                                                            {field.options?.map(opt => (
                                                                <option key={opt.id} value={opt.value}>{opt.label || opt.value}</option>
                                                            ))}
                                                        </select>
                                                    )}

                                                    {field.type === 'radio' && (
                                                        <div className="preview-choice-group">
                                                            {field.options?.length > 0 ? field.options.map(opt => (
                                                                <label key={opt.id} className="preview-choice-label">
                                                                    <input type="radio" name={`preview_${field.id}`} value={opt.value} className="preview-radio-input" />
                                                                    <span>{opt.label || opt.value}</span>
                                                                </label>
                                                            )) : <span className="preview-field-hint">No options defined yet</span>}
                                                        </div>
                                                    )}

                                                    {field.type === 'textarea' && (
                                                        <textarea rows={3} className="preview-textarea" placeholder={field.placeholder || `Enter ${field.label || 'text'}...`} />
                                                    )}

                                                    {field.type === 'checkbox_group' && (
                                                        <div className="preview-choice-group">
                                                            {field.options?.length > 0 ? field.options.map(opt => (
                                                                <label key={opt.id} className="preview-choice-label">
                                                                    <input type="checkbox" name={`preview_${field.id}`} value={opt.value} className="preview-checkbox-input" />
                                                                    <span>{opt.label || opt.value}</span>
                                                                </label>
                                                            )) : <span className="preview-field-hint">No choices defined yet</span>}
                                                        </div>
                                                    )}

                                                    {field.type === 'date' && (
                                                        <input type="date" className="preview-input" />
                                                    )}

                                                    {field.type === 'number' && (
                                                        <input type="number" className="preview-input" placeholder={field.placeholder || '0'} />
                                                    )}

                                                    {field.type === 'file' && (
                                                        <div className="preview-file-dropzone">
                                                            <svg className="preview-file-icon" width="28" height="28" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" clipRule="evenodd" d="M10 2.5C10.2761 2.5 10.5 2.72386 10.5 3V9.29289L12.1464 7.64645C12.3417 7.45118 12.6583 7.45118 12.8536 7.64645C13.0488 7.84171 13.0488 8.15829 12.8536 8.35355L10.3536 10.8536C10.1583 11.0488 9.84171 11.0488 9.64645 10.8536L7.14645 8.35355C6.95118 8.15829 6.95118 7.84171 7.14645 7.64645C7.34171 7.45118 7.65829 7.45118 7.85355 7.64645L9.5 9.29289V3C9.5 2.72386 9.72386 2.5 10 2.5ZM4 11C4.55228 11 5 11.4477 5 12V14.5C5 14.7761 5.22386 15 5.5 15H14.5C14.7761 15 15 14.7761 15 14.5V12C15 11.4477 15.4477 11 16 11C16.5523 11 17 11.4477 17 12V14.5C17 15.8807 15.8807 17 14.5 17H5.5C4.11929 17 3 15.8807 3 14.5V12C3 11.4477 3.44772 11 4 11Z" />
                                                            </svg>
                                                            <p className="preview-file-text">Drag &amp; drop your file here, or <span style={{ color: '#1a1a1a', fontWeight: 600, textDecoration: 'underline' }}>browse</span></p>
                                                            <p className="preview-file-subtext">PDF, PNG, JPG up to 10MB</p>
                                                        </div>
                                                    )}

                                                    {field.type === 'phone' && (
                                                        <input type="tel" className="preview-input" placeholder={field.placeholder || '+1 (555) 000-0000'} />
                                                    )}
                                                </div>
                                            ))
                                        )}

                                        <button type="button" className="preview-submit-btn">
                                            {buttonlabel || 'Submit Application'}
                                        </button>

                                        {policies && (
                                            <div className="preview-policy-text" dangerouslySetInnerHTML={{ __html: policies }} />
                                        )}
                                    </div>
                                </div>

                                <div className="preview-footer">
                                    <span className="preview-footer-text">&copy; 2025 YourStore &middot; Powered by Shopify</span>
                                </div>
                            </div>
                        </div>
                    </s-box>
                </s-box>
            </s-page>
        </>
    );
}