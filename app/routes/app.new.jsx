import { useLoaderData, useSubmit, useActionData, useNavigation, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import RichTextEditor from '../component/RichTextEditor';
import db from "../db.server";

// ============================================================================
// 1. HELPER: MAP ALL FIELD TYPES TO SHOPIFY METAOBJECT FIELD TYPE STRINGS
// ============================================================================
function mapToShopifyMetaobjectType(fieldType) {
    switch (fieldType) {
        case "number":
            return "number_integer";
        case "date":
            return "date";
        case "textarea":
            return "multi_line_text_field";
        case "checkbox_group":
            return "list.single_line_text_field";
        case "file":
            return "file_reference";
        case "email":
        case "text":
        case "select":
        case "radio":
        case "phone":
        default:
            return "single_line_text_field";
    }
}

// ============================================================================
// 2. HELPER: GENERATE CLEAN CLASS-BASED HTML & CSS
// ============================================================================
function generateFormHtmlAndCss(formId, title, description, fields, buttonLabel, policies) {
    const css = `
    .b2b-form-wrapper { max-width: 600px; margin: 0 auto; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #ffffff; border: 1px solid #e1e3e5; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
    .b2b-form-title { font-size: 22px; font-weight: 700; color: #1a1a1a; text-align: center; margin: 0 0 8px 0; }
    .b2b-form-desc { font-size: 13px; color: #6d6d6d; text-align: center; margin: 0 0 20px 0; line-height: 1.5; }
    .b2b-form-desc p { margin: 0; }
    .b2b-field-group { margin-bottom: 16px; }
    .b2b-label { display: block; font-size: 13px; font-weight: 600; color: #1a1a1a; margin-bottom: 6px; }
    .b2b-required-star { color: #c0392b; margin-left: 2px; }
    .b2b-input, .b2b-select, .b2b-textarea { width: 100%; box-sizing: border-box; padding: 10px 12px; font-size: 13px; border: 1px solid #d5d5d5; border-radius: 6px; background: #fafafa; color: #1a1a1a; font-family: inherit; }
    .b2b-textarea { resize: vertical; min-height: 80px; }
    .b2b-choice-group { display: flex; flex-direction: column; gap: 8px; }
    .b2b-choice-label { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: #1a1a1a; cursor: pointer; padding: 8px 12px; border: 1px solid #e0e0e0; border-radius: 6px; background: #fafafa; width: fit-content; }
    .b2b-radio-input, .b2b-checkbox-input { width: 16px; height: 16px; accent-color: #1a1a1a; cursor: pointer; }
    .b2b-file-dropzone { border: 2px dashed #d0d0d0; border-radius: 8px; padding: 20px; text-align: center; background: #fafafa; position: relative; cursor: pointer; }
    .b2b-file-input { width: 100%; cursor: pointer; }
    .b2b-submit-btn { display: block; width: 100%; background: #1a1a1a; color: #ffffff; border: none; border-radius: 6px; padding: 12px 20px; font-size: 14px; font-weight: 600; text-align: center; cursor: pointer; margin-top: 20px; }
    .b2b-submit-btn:hover { background: #333333; }
    .b2b-policy-text { font-size: 11px; color: #999999; text-align: center; margin-top: 14px; line-height: 1.5; }
    .b2b-policy-text p { margin: 0; }
  `;

    const fieldsHtml = fields.map((field) => {
        const isRequired = field.required ? '<span class="b2b-required-star">*</span>' : '';
        let controlHtml = '';

        switch (field.type) {
            case 'text':
            case 'email':
            case 'number':
            case 'phone':
                controlHtml = `<input type="${field.type === 'phone' ? 'tel' : field.type}" name="${field.id}" class="b2b-input" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''} />`;
                break;

            case 'date':
                controlHtml = `<input type="date" name="${field.id}" class="b2b-input" ${field.required ? 'required' : ''} />`;
                break;

            case 'textarea':
                controlHtml = `<textarea name="${field.id}" class="b2b-textarea" rows="3" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''}></textarea>`;
                break;

            case 'select':
                const selectOpts = (field.options || []).map(opt => `<option value="${opt.value}">${opt.label || opt.value}</option>`).join('');
                controlHtml = `<select name="${field.id}" class="b2b-select" ${field.required ? 'required' : ''}><option value="" disabled selected>${field.placeholder || 'Select an option...'}</option>${selectOpts}</select>`;
                break;

            case 'radio':
                const radioOpts = (field.options || []).map(opt => `
          <label class="b2b-choice-label">
            <input type="radio" name="${field.id}" value="${opt.value}" class="b2b-radio-input" ${field.required ? 'required' : ''} />
            <span>${opt.label || opt.value}</span>
          </label>
        `).join('');
                controlHtml = `<div class="b2b-choice-group">${radioOpts}</div>`;
                break;

            case 'checkbox_group':
                const checkOpts = (field.options || []).map(opt => `
          <label class="b2b-choice-label">
            <input type="checkbox" name="${field.id}[]" value="${opt.value}" class="b2b-checkbox-input" />
            <span>${opt.label || opt.value}</span>
          </label>
        `).join('');
                controlHtml = `<div class="b2b-choice-group">${checkOpts}</div>`;
                break;

            case 'file':
                controlHtml = `
          <div class="b2b-file-dropzone">
            <input type="file" name="${field.id}" class="b2b-file-input" ${field.required ? 'required' : ''} />
          </div>
        `;
                break;
        }

        return `
      <div class="b2b-field-group">
        <label class="b2b-label">${field.label || 'Untitled Field'}${isRequired}</label>
        ${controlHtml}
      </div>
    `;
    }).join('');

    const html = `
    <div class="b2b-form-wrapper" data-form-id="${formId}">
      <h2 class="b2b-form-title">${title || 'B2B Form'}</h2>
      ${description ? `<div class="b2b-form-desc">${description}</div>` : ''}
      <form action="/apps/b2b-form/submit" method="POST" enctype="multipart/form-data" class="b2b-form">
        <input type="hidden" name="form_id" value="${formId}" />
        <input type="hidden" name="shop" value="{{ shop.permanent_domain }}" />
        <input type="hidden" name="customer_id" value="{{ customer.id }}" />
        
        ${fieldsHtml}
        
        <button type="submit" class="b2b-submit-btn">${buttonLabel || 'Submit'}</button>
      </form>
      ${policies ? `<div class="b2b-policy-text">${policies}</div>` : ''}
    </div>
  `;

    return { html, css };
}

// ============================================================================
// 3. REMIX LOADER
// ============================================================================
export const loader = async ({ request }) => {
    await authenticate.admin(request);
    const url = new URL(request.url);
    const formName = url.searchParams.get('name') || 'New B2B Form';
    return { formName };
};

// ============================================================================
// 4. REMIX ACTION (CREATE METAOBJECT DEF & SAVE TO DATABASE)
// ============================================================================
export const action = async ({ request }) => {
    const { admin, session } = await authenticate.admin(request);
    const body = await request.json();

    const { title, description, buttonlabel, policies, fields } = body;

    const uniqueHash = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const formId = `form_${uniqueHash}`;
    const metaobjectType = `b2b_${uniqueHash}`;

    const fieldDefinitions = [];
    const dbMappings = [];

    // Iterate over fields dynamically
    fields.forEach((field) => {
        const rawKey = (field.label || `field_${field.id}`)
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, "_")
            .replace(/^_+|_+$/g, "")
            .substring(0, 30);

        const metaKey = rawKey || `field_${field.id.substring(0, 8)}`;

        fieldDefinitions.push({
            key: metaKey,
            name: (field.label || "Untitled Field").substring(0, 60),
            type: mapToShopifyMetaobjectType(field.type),
        });

        dbMappings.push({
            fieldId: field.id,
            fieldLabel: field.label || "Untitled Field",
            fieldType: field.type,
            metaobjectKey: metaKey,
        });
    });

    // Create Shopify Metaobject Definition
    const metaDefMutation = `
        mutation CreateMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
        metaobjectDefinitionCreate(definition: $definition) {
            metaobjectDefinition {
            id
            type
            }
            userErrors {
            field
            message
            }
        }
        }
    `;

    const metaDefRes = await admin.graphql(metaDefMutation, {
        variables: {
            definition: {
                name: `B2B Form - ${title || 'Application'}`,
                type: metaobjectType,
                fieldDefinitions,
            },
        },
    });

    const metaDefJson = await metaDefRes.json();
    const metaErrors = metaDefJson?.data?.metaobjectDefinitionCreate?.userErrors;

    if (metaErrors && metaErrors.length > 0) {
        return { success: false, errors: metaErrors }, { status: 400 };
    }

    const metaobjectDefId = metaDefJson.data.metaobjectDefinitionCreate.metaobjectDefinition.id;

    // Generate class-based HTML & CSS
    const { html, css } = generateFormHtmlAndCss(formId, title, description, fields, buttonlabel, policies);

    // Store Form and mappings in Prisma DB
    const savedForm = await db.form.create({
        data: {
            id: formId,
            shop: session.shop,
            name: title || "New B2B Form",
            html,
            css,
            metaobjectType,
            metaobjectDefId,
            FieldMapping: {
                create: dbMappings,
            },
        },
        include: {
            FieldMapping: true,
        },
    });

    return { success: true, form: savedForm };
};

// ============================================================================
// 5. REACT UI COMPONENT (FORM BUILDER & PREVIEW)
// ============================================================================
const FIELD_TYPES = [
    { type: "email", title: "Email", description: "Email address", defaultLabel: "Email", defaultPlaceholder: "Enter email address...", hasOptions: false, icon: "email" },
    { type: "text", title: "Single-line text", description: "Short single-line text input", defaultLabel: "Full Name", defaultPlaceholder: "Enter full name...", hasOptions: false, icon: "text-font" },
    { type: "select", title: "Dropdown list", description: "Select one option from a dropdown menu", defaultLabel: "Business Type", defaultPlaceholder: "Select an option...", hasOptions: true, defaultOptions: [{ id: "opt_1", label: "Retailer / Storefront", value: "retailer" }, { id: "opt_2", label: "Wholesaler / Distributor", value: "wholesaler" }, { id: "opt_3", label: "Corporate / Institutional", value: "corporate" }], icon: "caret-down" },
    { type: "radio", title: "Radio buttons", description: "Choose one option from visible radio choices", defaultLabel: "Company Size", defaultPlaceholder: "", hasOptions: true, defaultOptions: [{ id: "opt_1", label: "1 - 10 Employees", value: "1_10" }, { id: "opt_2", label: "11 - 50 Employees", value: "11_50" }, { id: "opt_3", label: "50+ Employees", value: "50_plus" }], icon: "radio-control" },
    { type: "textarea", title: "Multi-line text", description: "Multi-line paragraph / message text area", defaultLabel: "Company Description / Note", defaultPlaceholder: "Provide details about your business and bulk purchase needs...", hasOptions: false, icon: "text-align-left" },
    { type: "checkbox_group", title: "Multiple choice", description: "Multiple choice checkboxes", defaultLabel: "Interested Product Categories", defaultPlaceholder: "", hasOptions: true, defaultOptions: [{ id: "opt_1", label: "Raw Materials", value: "raw_materials" }, { id: "opt_2", label: "Finished Goods", value: "finished_goods" }, { id: "opt_3", label: "Custom Packaging", value: "custom_packaging" }], icon: "checkbox" },
    { type: "date", title: "Date", description: "Date picker for orders, timeline or registration", defaultLabel: "Target Launch Date", defaultPlaceholder: "", hasOptions: false, icon: "calendar" },
    { type: "number", title: "Number", description: "Numeric input for quantity, annual budget or tax ID", defaultLabel: "Estimated Monthly Order Quantity", defaultPlaceholder: "100", hasOptions: false, icon: "number-one" },
    { type: "file", title: "File upload", description: "Upload business licenses, tax exempt certificates", defaultLabel: "Business Certificate / Resale License", defaultPlaceholder: "", hasOptions: false, icon: "file" },
    { type: "phone", title: "Phone", description: "Phone number with international format", defaultLabel: "Company Contact Phone", defaultPlaceholder: "+1 (555) 000-0000", hasOptions: false, icon: "phone" }
];

// Unique id used to wire the native App Bridge contextual Save Bar to this page.
// The host (Shopify Admin) owns placement/positioning of the bar - it renders
// pinned to the viewport (docked responsively, top on desktop / bottom on
// small screens) so we don't manage its position ourselves.
const SAVE_BAR_ID = "b2b-form-save-bar";

const INITIAL_BUILDER_STATE = {
    title: 'B2B Form Application',
    description: 'Applied for B2B for Bulk Purchase and Contracts with required detail we will verify if approved specialize treatment given',
    buttonlabel: 'Submit',
    policies: 'By signing up, you agree to receive marketing emails. View our privacy policy and terms of service for more info.',
    fields: [
        { id: "f_email", type: "email", label: "Email", placeholder: "Enter email address...", required: true, options: [] },
        { id: "f_name", type: "text", label: "Company / Contact Name", placeholder: "Enter company or representative name...", required: true, options: [] },
        { id: "f_type", type: "select", label: "Business Entity Type", placeholder: "Select your business type...", required: true, options: [{ id: "opt_1", label: "Wholesaler / Reseller", value: "wholesaler" }, { id: "opt_2", label: "Corporate Account", value: "corporate" }, { id: "opt_3", label: "Retail Partner", value: "retail_partner" }] },
        { id: "f_size", type: "radio", label: "Expected Order Volume", placeholder: "", required: false, options: [{ id: "opt_r1", label: "$5,000 - $20,000 / month", value: "tier_1" }, { id: "opt_r2", label: "$20,000 - $100,000 / month", value: "tier_2" }, { id: "opt_r3", label: "$100,000+ / month", value: "tier_3" }] }
    ]
};

export default function New() {
    const { formName } = useLoaderData();
    const actionData = useActionData();
    const submit = useSubmit();
    const navigate = useNavigate();
    const navigation = useNavigation();
    const shopify = useAppBridge();

    const isSaving = navigation.state === "submitting";

    const [title, setTitle] = useState(INITIAL_BUILDER_STATE.title);
    const [description, setDescription] = useState(INITIAL_BUILDER_STATE.description);
    const [buttonlabel, setButtonLabel] = useState(INITIAL_BUILDER_STATE.buttonlabel);
    const [policies, setPolicies] = useState(INITIAL_BUILDER_STATE.policies);
    const [fields, setFields] = useState(INITIAL_BUILDER_STATE.fields);

    // Snapshot of the last-saved state. Comparing against this is how we know
    // whether to show the Save Bar - it's the single source of truth for both
    // the top and bottom docking positions the host may render it in.
    const [savedState, setSavedState] = useState(INITIAL_BUILDER_STATE);

    const [activeConfigId, setActiveConfigId] = useState(null);
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    const isDirty = JSON.stringify({ title, description, buttonlabel, policies, fields }) !== JSON.stringify(savedState);

    // Show / hide the native contextual Save Bar as the form becomes dirty.
    // This single effect is what makes "Save" and "Discard" behave the same
    // way no matter where the host docks the bar.
    useEffect(() => {
        if (!shopify) return;
        if (isDirty) {
            shopify.saveBar.show(SAVE_BAR_ID);
        } else {
            shopify.saveBar.hide(SAVE_BAR_ID);
        }
    }, [isDirty, shopify]);

    // Once a save succeeds, the current values become the new "saved" baseline
    // and the Save Bar hides itself again.
    useEffect(() => {
        if (actionData?.success) {
            setSavedState({ title, description, buttonlabel, policies, fields });
            shopify?.saveBar?.hide(SAVE_BAR_ID);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [actionData]);

    const handleSaveForm = () => {
        const payload = { title, description, buttonlabel, policies, fields };
        submit(payload, { method: "post", encType: "application/json" });
    };

    const handleCancelOrDiscard = () => {
        shopify?.saveBar?.hide(SAVE_BAR_ID);
        navigate(-1);
    };

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

    const updateField = (id, updates) => {
        if (id === "f_email") return;
        setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    const removeField = (id) => {
        if (id === "f_email") return;
        setFields(prev => prev.filter(f => f.id !== id));
        if (activeConfigId === id) setActiveConfigId(null);
    };

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

    const addOption = (fieldId) => {
        setFields(prev => prev.map(f => {
            if (f.id !== fieldId) return f;
            const optIndex = (f.options?.length || 0) + 1;
            const newOpt = { id: `opt_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`, label: `Option ${optIndex}`, value: `option_${optIndex}` };
            return { ...f, options: [...(f.options || []), newOpt] };
        }));
    };

    const updateOption = (fieldId, optionId, key, value) => {
        setFields(prev => prev.map(f => {
            if (f.id !== fieldId) return f;
            return { ...f, options: f.options.map(opt => opt.id === optionId ? { ...opt, [key]: value } : opt) };
        }));
    };

    const removeOption = (fieldId, optionId) => {
        setFields(prev => prev.map(f => {
            if (f.id !== fieldId) return f;
            return { ...f, options: f.options.filter(opt => opt.id !== optionId) };
        }));
    };

    return (
        <>
            <style>{`
        .field-item-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border: 1px solid #e3e3e3; border-radius: 8px; margin-bottom: 8px; background: #ffffff; cursor: pointer; transition: all 0.15s ease-in-out; }
        .field-item-row:hover { background: #f7f8f9; border-color: #c9cccf; }
        .field-item-row.is-active { background: #f1f7fe; border-color: #2c6ecb; box-shadow: 0 0 0 1px #2c6ecb; }
        .field-action-btn { background: transparent; border: none; color: #5c5f62; cursor: pointer; padding: 5px; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: background 0.1s ease; }
        .field-action-btn:hover { background: #e4e5e7; color: #202223; }
        .field-action-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .field-action-btn.delete-btn:hover { background: #fedcdb; color: #d72c0d; }
        .picker-popover-menu { background: #fff; border: 1px solid #c9cccf; border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.12); padding: 6px; margin-top: 6px; max-height: 380px; overflow-y: auto; z-index: 1000; }
        .picker-option-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 6px; border: none; background: transparent; width: 100%; text-align: left; cursor: pointer; color: #202223; font-size: 13px; font-weight: 500; font-family: inherit; }
        .picker-option-item:hover { background: #f1f2f4; }
        .picker-option-icon { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; background: #f6f6f7; color: #303030; flex-shrink: 0; }
        .field-config-container { background: #fbfbfb; border: 1px solid #cce0ff; border-radius: 8px; padding: 14px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,91,211,0.08); }
        .config-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 10px; margin-bottom: 12px; border-bottom: 1px solid #e1e9f4; }
        .config-option-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .config-input { width: 100%; box-sizing: border-box; padding: 6px 10px; font-size: 13px; border: 1px solid #c9cccf; border-radius: 6px; background: #fff; outline: none; font-family: inherit; }
        .config-input:focus { border-color: #005bd3; box-shadow: 0 0 0 1px #005bd3; }
        .opt-add-btn { display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; font-size: 12px; font-weight: 500; color: #005bd3; background: #f0f6ff; border: 1px dashed #7ab1ff; border-radius: 6px; cursor: pointer; margin-top: 6px; font-family: inherit; }
        .opt-remove-btn { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: #fff; border: 1px solid #e1e3e5; border-radius: 6px; color: #8c9196; cursor: pointer; flex-shrink: 0; }
        .opt-remove-btn:hover { background: #fff0f0; border-color: #ffb8b8; color: #d72c0d; }

        .preview-shell { background: #f0f0f0; border-radius: 10px; overflow: hidden; border: 1px solid #d5d5d5; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
        .preview-browser-bar { background: #e8e8e8; border-bottom: 1px solid #d0d0d0; padding: 8px 12px; display: flex; align-items: center; gap: 10px; }
        .preview-browser-dots { display: flex; gap: 5px; }
        .preview-browser-dot { width: 11px; height: 11px; border-radius: 50%; }
        .preview-browser-url { flex: 1; background: #fff; border: 1px solid #c4c4c4; border-radius: 20px; padding: 3px 12px; font-size: 11px; color: #555; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .preview-storefront { background: #ffffff; min-height: 500px; }
        .preview-nav { background: #1a1a1a; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; }
        .preview-nav-logo { font-size: 16px; font-weight: 700; color: #fff; letter-spacing: 1px; text-transform: uppercase; }
        .preview-page-body { padding: 12px; max-width: 560px; margin: 0 auto; }
        .preview-form-card { background: #fff; border: 1px solid #e8e8e8; border-radius: 10px; padding: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.07); }
        .preview-form-title { font-size: 20px; font-weight: 700; color: #1a1a1a; text-align: center; margin: 0 0 8px 0; }
        .preview-form-desc { font-size: 13px; color: #6d6d6d; text-align: center; margin: 0 0 20px 0; line-height: 1.5; }
        .preview-divider { border: none; border-top: 1px solid #ebebeb; margin: 0 0 20px 0; }
        .preview-field-group { margin-bottom: 16px; }
        .preview-field-label { display: block; font-size: 13px; font-weight: 600; color: #1a1a1a; margin-bottom: 6px; }
        .preview-required-star { color: #c0392b; margin-left: 2px; }
        .preview-input, .preview-select, .preview-textarea { width: 100%; box-sizing: border-box; padding: 9px 12px; font-size: 13px; border: 1px solid #d5d5d5; border-radius: 6px; background: #fafafa; color: #1a1a1a; font-family: inherit; }
        .preview-textarea { resize: vertical; min-height: 80px; }
        .preview-choice-group { display: flex; flex-direction: column; gap: 8px; }
        .preview-choice-label { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #1a1a1a; cursor: pointer; padding: 8px 12px; border: 1px solid #e0e0e0; border-radius: 6px; background: #fafafa; width: fit-content; }
        .preview-radio-input, .preview-checkbox-input { width: 16px; height: 16px; accent-color: #1a1a1a; cursor: pointer; }
        .preview-file-dropzone { border: 2px dashed #d0d0d0; border-radius: 8px; padding: 22px 16px; text-align: center; background: #fafafa; cursor: pointer; }
        .preview-file-text { font-size: 12px; color: #555; margin: 0; }
        .preview-file-subtext { font-size: 11px; color: #999; margin: 4px 0 0 0; }
        .preview-submit-btn { display: block; width: 100%; background: #1a1a1a; color: #fff; border: none; border-radius: 6px; padding: 12px 20px; font-size: 14px; font-weight: 600; text-align: center; cursor: pointer; margin-top: 20px; font-family: inherit; }
        .preview-policy-text { font-size: 11px; color: #999; text-align: center; margin-top: 14px; line-height: 1.5; }
        .preview-footer { background: #1a1a1a; padding: 16px 24px; text-align: center; }
        .preview-footer-text { font-size: 11px; color: rgba(255,255,255,0.4); }
      `}</style>

            <s-page heading={formName}>
                {/*
                  NATIVE APP BRIDGE SAVE BAR
                  Replaces the old manual top action bar and bottom action bar.
                  The host (Shopify Admin) owns where this docks (it responds
                  to viewport size on its own), and shows/hides it for us based
                  on the `isDirty` effect above - so "Save" and "Discard" behave
                  identically no matter which position it renders in.
                */}
                <s-save-bar id={SAVE_BAR_ID}>
                    <button
                        variant="primary"
                        onClick={handleSaveForm}
                        loading={isSaving ? "" : undefined}
                    >
                        Save
                    </button>
                    <button
                        onClick={handleCancelOrDiscard}
                        disabled={isSaving}
                    >
                        Discard
                    </button>
                </s-save-bar>

                {actionData?.success && (
                    <s-box padding="base">
                        <s-banner tone="success" heading="Form saved">
                            Form and Metaobject Definition created successfully! Form ID: <strong>{actionData.form.id}</strong>
                        </s-banner>
                    </s-box>
                )}

                {actionData?.errors && (
                    <s-box padding="base">
                        <s-banner tone="critical" heading="Error creating form">
                            <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                                {actionData.errors.map((err, idx) => (
                                    <li key={idx}>{err.message}</li>
                                ))}
                            </ul>
                        </s-banner>
                    </s-box>
                )}

                <s-section heading="Form Settings & Fields">
                    <s-text-field label="Title" value={title} onChange={(e) => setTitle(e.target.value)}></s-text-field>

                    <s-box padding="small-300 none none none">
                        <s-text>Description</s-text>
                        <s-box padding="small-200 none none none">
                            <RichTextEditor value={description} onChange={(e) => setDescription(e)} />
                        </s-box>
                    </s-box>

                    <s-box padding="base none none none">
                        <s-stack direction="inline" justifyContent="space-between" alignItems="center" padding="none none small-300 none">
                            <s-heading><span style={{ fontSize: '14px', fontWeight: '600' }}>Form Fields ({fields.length})</span></s-heading>
                            <s-paragraph tone="neutral"><span style={{ fontSize: '12px', color: '#6d7175' }}>Click any field to edit settings</span></s-paragraph>
                        </s-stack>

                        <div style={{ marginBottom: '10px' }}>
                            {fields.map((field, idx) => {
                                const typeMeta = FIELD_TYPES.find(t => t.type === field.type) || FIELD_TYPES[0];
                                const isSelected = activeConfigId === field.id;
                                const isLocked = field.id === "f_email";

                                return (
                                    <div key={field.id}>
                                        <div
                                            className={`field-item-row ${isSelected ? 'is-active' : ''}`}
                                            onClick={() => !isLocked && setActiveConfigId(isSelected ? null : field.id)}
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

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                                                <button type="button" title="Move Up" disabled={idx === 0} className="field-action-btn" onClick={() => moveField(idx, -1)}>
                                                    <s-icon type="chevron-up"></s-icon>
                                                </button>
                                                <button type="button" title="Move Down" disabled={idx === fields.length - 1} className="field-action-btn" onClick={() => moveField(idx, 1)}>
                                                    <s-icon type="chevron-down"></s-icon>
                                                </button>
                                                {!isLocked && (
                                                    <>
                                                        <button type="button" title="Configure Field" className="field-action-btn" style={{ color: isSelected ? '#005bd3' : '#5c5f62' }} onClick={() => setActiveConfigId(isSelected ? null : field.id)}>
                                                            <s-icon type="edit"></s-icon>
                                                        </button>
                                                        <button type="button" title="Delete Field" className="field-action-btn delete-btn" onClick={() => removeField(field.id)}>
                                                            <s-icon type="delete"></s-icon>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {isSelected && !isLocked && (
                                            <div className="field-config-container">
                                                <div className="config-header">
                                                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#005bd3' }}>Configure {typeMeta.title}</span>
                                                    <button type="button" className="field-action-btn" onClick={() => setActiveConfigId(null)}>✕</button>
                                                </div>

                                                <s-box padding="none none small-300 none">
                                                    <s-text-field
                                                        label="Field Label"
                                                        placeholder="Enter field label..."
                                                        value={field.label}
                                                        onChange={(e) => updateField(field.id, { label: e.target.value })}
                                                    ></s-text-field>
                                                </s-box>

                                                {['text', 'textarea', 'number', 'phone', 'select'].includes(field.type) && (
                                                    <s-box padding="none none small-300 none">
                                                        <s-text-field
                                                            label="Placeholder Text"
                                                            placeholder="Placeholder hint text..."
                                                            value={field.placeholder || ''}
                                                            onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                                                        ></s-text-field>
                                                    </s-box>
                                                )}

                                                <s-box padding="none none base none">
                                                    <s-checkbox
                                                        label="Required field"
                                                        checked={!!field.required}
                                                        onChange={(e) => updateField(field.id, { required: e.target.checked })}
                                                    ></s-checkbox>
                                                </s-box>

                                                {typeMeta.hasOptions && (
                                                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e3e8ee' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#303030' }}>Options & Choices</span>
                                                        </div>

                                                        {field.options?.map((opt, optIdx) => (
                                                            <div key={opt.id} className="config-option-row">
                                                                <span style={{ fontSize: '11px', color: '#8c9196', width: '16px' }}>{optIdx + 1}.</span>
                                                                <input type="text" className="config-input" placeholder="Option label" value={opt.label} onChange={(e) => updateOption(field.id, opt.id, 'label', e.target.value)} />
                                                                <input type="text" className="config-input" placeholder="Option value" value={opt.value} onChange={(e) => updateOption(field.id, opt.id, 'value', e.target.value)} />
                                                                <button type="button" className="opt-remove-btn" onClick={() => removeOption(field.id, opt.id)}>✕</button>
                                                            </div>
                                                        ))}

                                                        <button type="button" className="opt-add-btn" onClick={() => addOption(field.id)}>+ Add option / value</button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ position: 'relative' }}>
                            <button type="button" className="picker-option-item" onClick={() => setIsPickerOpen(!isPickerOpen)} style={{ border: '1px dashed #b5b5b5', borderRadius: '8px', padding: '10px 14px', justifyContent: 'center' }}>
                                <span style={{ fontSize: '13px', fontWeight: '600' }}>+ Add new field</span>
                            </button>

                            {isPickerOpen && (
                                <div className="picker-popover-menu">
                                    {FIELD_TYPES.filter(t => t.type !== "email").map((typeOption) => (
                                        <button key={typeOption.type} type="button" className="picker-option-item" onClick={() => addField(typeOption)}>
                                            <div className="picker-option-icon"><s-icon type={typeOption.icon}></s-icon></div>
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: '600', color: '#202223' }}>{typeOption.title}</div>
                                                <div style={{ fontSize: '11px', color: '#6d7175' }}>{typeOption.description}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </s-box>

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

                {/* LIVE PREVIEW PANE */}
                <s-box slot="aside">
                    <s-box heading="Live Form Preview" padding="none">
                        <div className="preview-shell">
                            <div className="preview-browser-bar">
                                <div className="preview-browser-dots">
                                    <div className="preview-browser-dot" style={{ background: '#ff5f57' }}></div>
                                    <div className="preview-browser-dot" style={{ background: '#febc2e' }}></div>
                                    <div className="preview-browser-dot" style={{ background: '#28c840' }}></div>
                                </div>
                                <div className="preview-browser-url">your-store.myshopify.com/pages/b2b-application</div>
                            </div>

                            <div className="preview-storefront">
                                <div className="preview-nav">
                                    <div className="preview-nav-logo">YourStore</div>
                                </div>

                                <div className="preview-page-body">
                                    <div className="preview-form-card">
                                        <h2 className="preview-form-title">{title || 'Form Title'}</h2>

                                        {description && (
                                            <div className="preview-form-desc" dangerouslySetInnerHTML={{ __html: description }} />
                                        )}

                                        <hr className="preview-divider" />

                                        {fields.map((field) => (
                                            <div key={field.id} className="preview-field-group">
                                                <label className="preview-field-label">
                                                    {field.label || 'Untitled Field'}
                                                    {field.required && <span className="preview-required-star">*</span>}
                                                </label>

                                                {field.type === 'text' && <input type="text" className="preview-input" placeholder={field.placeholder || ''} />}
                                                {field.type === 'email' && <input type="email" className="preview-input" placeholder={field.placeholder || ''} />}
                                                {field.type === 'phone' && <input type="tel" className="preview-input" placeholder={field.placeholder || ''} />}
                                                {field.type === 'number' && <input type="number" className="preview-input" placeholder={field.placeholder || ''} />}
                                                {field.type === 'date' && <input type="date" className="preview-input" />}
                                                {field.type === 'textarea' && <textarea rows={3} className="preview-textarea" placeholder={field.placeholder || ''} />}

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
                                                        {field.options?.map(opt => (
                                                            <label key={opt.id} className="preview-choice-label">
                                                                <input type="radio" name={`prev_${field.id}`} value={opt.value} className="preview-radio-input" />
                                                                <span>{opt.label || opt.value}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}

                                                {field.type === 'checkbox_group' && (
                                                    <div className="preview-choice-group">
                                                        {field.options?.map(opt => (
                                                            <label key={opt.id} className="preview-choice-label">
                                                                <input type="checkbox" name={`prev_${field.id}`} value={opt.value} className="preview-checkbox-input" />
                                                                <span>{opt.label || opt.value}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}

                                                {field.type === 'file' && (
                                                    <div className="preview-file-dropzone">
                                                        <p className="preview-file-text">Drag &amp; drop file, or browse</p>
                                                        <p className="preview-file-subtext">PDF, PNG, JPG up to 10MB</p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                        <button type="button" className="preview-submit-btn">
                                            {buttonlabel || 'Submit'}
                                        </button>

                                        {policies && (
                                            <div className="preview-policy-text" dangerouslySetInnerHTML={{ __html: policies }} />
                                        )}
                                    </div>
                                </div>

                                <div className="preview-footer">
                                    <span className="preview-footer-text">&copy; 2026 YourStore &middot; Powered by Shopify</span>
                                </div>
                            </div>
                        </div>
                    </s-box>
                </s-box>
            </s-page>
        </>
    );
}