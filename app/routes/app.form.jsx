import { useLoaderData, useNavigate, useLocation } from "react-router";
import { authenticate } from "../shopify.server";
import { useState } from "react";

export const loader = async ({ request }) => {
    const { session } = await authenticate.admin(request);

    // Clean up the shop domain name
    const shop = session.shop.split('.myshopify')[0];

    // FIX 1: Return as an object so destructuring works in the component
    return { shop };
};

export default function Form() {
    // Destructuring now works correctly
    const { shop } = useLoaderData();
    const navigate = useNavigate();
    const location = useLocation();
    const [formName, setFormName] = useState('');

    const redirectFormapp = () => {
        // FIX 2: Use window.top to force the parent Shopify Admin window to redirect
        shopify.modal.show('FormInput');
    };
    const closeForm = () => {
        // FIX 2: Use window.top to force the parent Shopify Admin window to redirect
        setFormName('');
        shopify.modal.hide('FormInput');
    };
    const createForm = () => {
        if (formName.length == 0) return;
        const param = new URLSearchParams(location.search);
        param.set('name', formName);
        navigate(`/app/new?${param.toString()}`);
    }

    return (
        <>
            <s-page>
                <s-section>
                    <s-box>
                        <p style={{ textAlign: 'center' }}>Create B2B Form And add Tag Define in app to directly add compnay or customer to market</p>
                        <s-grid alignItems="center" justifyContent="center">
                            <s-button onClick={redirectFormapp} variant="primary">Create Form</s-button>
                        </s-grid>
                    </s-box>
                </s-section>
                <s-modal id="FormInput" heading="Form Name">
                    <s-stack padding="none base none base">
                        <s-text-field placeholder="Enter Form Name..." value={formName} onChange={(e) => { setFormName(e.target.value); console.log(formName) }} ></s-text-field>
                    </s-stack>
                    <s-stack direction="inline" justifyContent="end" gap="small" padding="base base none base">
                        <s-button variant="secondary" onClick={closeForm}>Close</s-button>
                        <s-button variant="primary" onClick={createForm}>Create</s-button>
                    </s-stack>
                </s-modal>
            </s-page>
        </>
    );
}



// import { useMemo, useState } from "react";

// /* =========================================================
//    FIELD TYPES
// ========================================================= */

// const FIELD_TYPES = [
//   {
//     type: "text",
//     label: "Text",
//     description: "Single line text",
//   },
//   {
//     type: "textarea",
//     label: "Textarea",
//     description: "Multi-line text",
//   },
//   {
//     type: "email",
//     label: "Email",
//     description: "Email address",
//   },
//   {
//     type: "phone",
//     label: "Phone",
//     description: "Phone number",
//   },
//   {
//     type: "number",
//     label: "Number",
//     description: "Numeric value",
//   },
//   {
//     type: "url",
//     label: "URL",
//     description: "Website URL",
//   },
//   {
//     type: "date",
//     label: "Date",
//     description: "Date picker",
//   },
//   {
//     type: "select",
//     label: "Select",
//     description: "Dropdown options",
//   },
//   {
//     type: "radio",
//     label: "Radio",
//     description: "Single choice",
//   },
//   {
//     type: "checkbox",
//     label: "Checkbox",
//     description: "Single checkbox",
//   },
//   {
//     type: "checkbox_group",
//     label: "Checkbox group",
//     description: "Multiple choices",
//   },
//   {
//     type: "file",
//     label: "File",
//     description: "Single file upload",
//   },
//   {
//     type: "multi_file",
//     label: "Multiple files",
//     description: "Multiple file upload",
//   },
//   {
//     type: "address",
//     label: "Address",
//     description: "Address fields",
//   },
//   {
//     type: "hidden",
//     label: "Hidden",
//     description: "Hidden value",
//   },
//   {
//     type: "heading",
//     label: "Heading",
//     description: "Section heading",
//   },
//   {
//     type: "paragraph",
//     label: "Paragraph",
//     description: "Information text",
//   },
// ];

// /* =========================================================
//    HELPERS
// ========================================================= */

// const createId = () => {
//   return `${Date.now()}-${Math.random()
//     .toString(36)
//     .substring(2, 9)}`;
// };

// const slugify = (value = "") => {
//   return value
//     .toLowerCase()
//     .trim()
//     .replace(/[^a-z0-9]+/g, "_")
//     .replace(/^_+|_+$/g, "");
// };

// const createField = (type) => {
//   const defaults = {
//     id: createId(),
//     type,
//     label: "",
//     fieldId: "",
//     placeholder: "",
//     helpText: "",
//     required: false,
//     defaultValue: "",
//     validation: {},
//     options: [],
//     conditions: [],
//   };

//   switch (type) {
//     case "text":
//       return {
//         ...defaults,
//         label: "Text field",
//         fieldId: `text_${Date.now()}`,
//         validation: {
//           minLength: "",
//           maxLength: "",
//         },
//       };

//     case "textarea":
//       return {
//         ...defaults,
//         label: "Additional information",
//         fieldId: `textarea_${Date.now()}`,
//         validation: {
//           minLength: "",
//           maxLength: "",
//         },
//       };

//     case "email":
//       return {
//         ...defaults,
//         label: "Email",
//         fieldId: `email_${Date.now()}`,
//         required: true,
//         validation: {
//           email: true,
//         },
//       };

//     case "phone":
//       return {
//         ...defaults,
//         label: "Phone",
//         fieldId: `phone_${Date.now()}`,
//         validation: {
//           minLength: "",
//           maxLength: "",
//         },
//       };

//     case "number":
//       return {
//         ...defaults,
//         label: "Number",
//         fieldId: `number_${Date.now()}`,
//         validation: {
//           min: "",
//           max: "",
//         },
//       };

//     case "url":
//       return {
//         ...defaults,
//         label: "Website",
//         fieldId: `website_${Date.now()}`,
//         validation: {
//           url: true,
//         },
//       };

//     case "date":
//       return {
//         ...defaults,
//         label: "Date",
//         fieldId: `date_${Date.now()}`,
//         validation: {
//           minDate: "",
//           maxDate: "",
//         },
//       };

//     case "select":
//       return {
//         ...defaults,
//         label: "Select option",
//         fieldId: `select_${Date.now()}`,
//         options: [
//           {
//             id: createId(),
//             label: "Option 1",
//             value: "option_1",
//           },
//           {
//             id: createId(),
//             label: "Option 2",
//             value: "option_2",
//           },
//         ],
//       };

//     case "radio":
//       return {
//         ...defaults,
//         label: "Choose an option",
//         fieldId: `radio_${Date.now()}`,
//         options: [
//           {
//             id: createId(),
//             label: "Option 1",
//             value: "option_1",
//           },
//           {
//             id: createId(),
//             label: "Option 2",
//             value: "option_2",
//           },
//         ],
//       };

//     case "checkbox":
//       return {
//         ...defaults,
//         label: "I agree to the terms",
//         fieldId: `checkbox_${Date.now()}`,
//       };

//     case "checkbox_group":
//       return {
//         ...defaults,
//         label: "Select all that apply",
//         fieldId: `checkbox_group_${Date.now()}`,
//         options: [
//           {
//             id: createId(),
//             label: "Option 1",
//             value: "option_1",
//           },
//           {
//             id: createId(),
//             label: "Option 2",
//             value: "option_2",
//           },
//         ],
//         validation: {
//           minSelections: "",
//           maxSelections: "",
//         },
//       };

//     case "file":
//       return {
//         ...defaults,
//         label: "Upload document",
//         fieldId: `file_${Date.now()}`,
//         validation: {
//           maxSizeMB: 10,
//           allowedTypes: ["pdf", "jpg", "jpeg", "png"],
//           maxFiles: 1,
//         },
//       };

//     case "multi_file":
//       return {
//         ...defaults,
//         label: "Upload documents",
//         fieldId: `files_${Date.now()}`,
//         validation: {
//           maxSizeMB: 10,
//           allowedTypes: ["pdf", "jpg", "jpeg", "png"],
//           maxFiles: 5,
//         },
//       };

//     case "address":
//       return {
//         ...defaults,
//         label: "Address",
//         fieldId: `address_${Date.now()}`,
//         required: true,
//       };

//     case "hidden":
//       return {
//         ...defaults,
//         label: "Hidden field",
//         fieldId: `hidden_${Date.now()}`,
//         defaultValue: "",
//       };

//     case "heading":
//       return {
//         ...defaults,
//         label: "Company information",
//         fieldId: `heading_${Date.now()}`,
//       };

//     case "paragraph":
//       return {
//         ...defaults,
//         label: "Please provide your company information.",
//         fieldId: `paragraph_${Date.now()}`,
//       };

//     default:
//       return defaults;
//   }
// };

// /* =========================================================
//    WEB COMPONENT HELPERS
// ========================================================= */

// const getEventValue = (event) => {
//   return (
//     event?.target?.value ??
//     event?.detail?.value ??
//     ""
//   );
// };

// const getEventChecked = (event) => {
//   return Boolean(
//     event?.target?.checked ??
//       event?.detail?.checked
//   );
// };

// /* =========================================================
//    MAIN COMPONENT
// ========================================================= */

// export default function Form() {
//   const [formName, setFormName] = useState(
//     "B2B Customer Registration"
//   );

//   const [formType, setFormType] = useState(
//     "company_customer"
//   );

//   const [fields, setFields] = useState([
//     {
//       id: createId(),
//       type: "text",
//       label: "Company name",
//       fieldId: "company_name",
//       placeholder: "Enter company name",
//       helpText: "",
//       required: true,
//       defaultValue: "",
//       validation: {
//         minLength: 2,
//         maxLength: 100,
//       },
//       options: [],
//       conditions: [],
//     },
//     {
//       id: createId(),
//       type: "text",
//       label: "Contact person",
//       fieldId: "contact_name",
//       placeholder: "Enter contact person",
//       helpText: "",
//       required: true,
//       defaultValue: "",
//       validation: {
//         minLength: 2,
//         maxLength: 100,
//       },
//       options: [],
//       conditions: [],
//     },
//     {
//       id: createId(),
//       type: "email",
//       label: "Business email",
//       fieldId: "business_email",
//       placeholder: "company@example.com",
//       helpText: "",
//       required: true,
//       defaultValue: "",
//       validation: {
//         email: true,
//       },
//       options: [],
//       conditions: [],
//     },
//   ]);

//   const [selectedFieldId, setSelectedFieldId] =
//     useState(fields[0]?.id || null);

//   const [showPreview, setShowPreview] =
//     useState(false);

//   const [draggedIndex, setDraggedIndex] =
//     useState(null);

//   const [formErrors, setFormErrors] =
//     useState({});

//   /* =========================================================
//      SELECTED FIELD
//   ========================================================= */

//   const selectedField = useMemo(() => {
//     return fields.find(
//       (field) => field.id === selectedFieldId
//     );
//   }, [fields, selectedFieldId]);

//   /* =========================================================
//      UPDATE FIELD
//   ========================================================= */

//   const updateField = (fieldId, updates) => {
//     setFields((current) =>
//       current.map((field) =>
//         field.id === fieldId
//           ? {
//               ...field,
//               ...updates,
//             }
//           : field
//       )
//     );
//   };

//   const updateValidation = (
//     fieldId,
//     updates
//   ) => {
//     setFields((current) =>
//       current.map((field) =>
//         field.id === fieldId
//           ? {
//               ...field,
//               validation: {
//                 ...field.validation,
//                 ...updates,
//               },
//             }
//           : field
//       )
//     );
//   };

//   /* =========================================================
//      ADD FIELD
//   ========================================================= */

//   const addField = (type) => {
//     const newField = createField(type);

//     setFields((current) => [
//       ...current,
//       newField,
//     ]);

//     setSelectedFieldId(newField.id);
//   };

//   /* =========================================================
//      DELETE FIELD
//   ========================================================= */

//   const deleteField = (fieldId) => {
//     setFields((current) =>
//       current.filter(
//         (field) => field.id !== fieldId
//       )
//     );

//     if (selectedFieldId === fieldId) {
//       const remaining = fields.filter(
//         (field) => field.id !== fieldId
//       );

//       setSelectedFieldId(
//         remaining[0]?.id || null
//       );
//     }
//   };

//   /* =========================================================
//      DUPLICATE FIELD
//   ========================================================= */

//   const duplicateField = (field) => {
//     const copy = {
//       ...field,
//       id: createId(),
//       fieldId: `${field.fieldId}_copy`,
//       label: `${field.label} copy`,
//       options: field.options
//         ? field.options.map((option) => ({
//             ...option,
//             id: createId(),
//           }))
//         : [],
//       conditions: field.conditions
//         ? field.conditions.map((condition) => ({
//             ...condition,
//           }))
//         : [],
//     };

//     setFields((current) => {
//       const index = current.findIndex(
//         (item) => item.id === field.id
//       );

//       const result = [...current];

//       result.splice(index + 1, 0, copy);

//       return result;
//     });

//     setSelectedFieldId(copy.id);
//   };

//   /* =========================================================
//      DRAG & DROP
//   ========================================================= */

//   const handleDragStart = (index) => {
//     setDraggedIndex(index);
//   };

//   const handleDrop = (index) => {
//     if (draggedIndex === null) return;

//     if (draggedIndex === index) {
//       setDraggedIndex(null);
//       return;
//     }

//     setFields((current) => {
//       const result = [...current];

//       const [removed] = result.splice(
//         draggedIndex,
//         1
//       );

//       result.splice(index, 0, removed);

//       return result;
//     });

//     setDraggedIndex(null);
//   };

//   /* =========================================================
//      OPTIONS
//   ========================================================= */

//   const addOption = (fieldId) => {
//     setFields((current) =>
//       current.map((field) => {
//         if (field.id !== fieldId) {
//           return field;
//         }

//         const index =
//           field.options?.length || 0;

//         return {
//           ...field,
//           options: [
//             ...(field.options || []),
//             {
//               id: createId(),
//               label: `Option ${index + 1}`,
//               value: `option_${index + 1}`,
//             },
//           ],
//         };
//       })
//     );
//   };

//   const updateOption = (
//     fieldId,
//     optionId,
//     updates
//   ) => {
//     setFields((current) =>
//       current.map((field) => {
//         if (field.id !== fieldId) {
//           return field;
//         }

//         return {
//           ...field,
//           options: field.options.map(
//             (option) =>
//               option.id === optionId
//                 ? {
//                     ...option,
//                     ...updates,
//                   }
//                 : option
//           ),
//         };
//       })
//     );
//   };

//   const deleteOption = (
//     fieldId,
//     optionId
//   ) => {
//     setFields((current) =>
//       current.map((field) => {
//         if (field.id !== fieldId) {
//           return field;
//         }

//         return {
//           ...field,
//           options: field.options.filter(
//             (option) =>
//               option.id !== optionId
//           ),
//         };
//       })
//     );
//   };

//   /* =========================================================
//      VALIDATION
//   ========================================================= */

//   const validateBuilder = () => {
//     const errors = {};

//     if (!formName.trim()) {
//       errors.formName =
//         "Form name is required.";
//     }

//     const fieldIds = new Set();

//     fields.forEach((field) => {
//       if (
//         ![
//           "heading",
//           "paragraph",
//           "hidden",
//         ].includes(field.type)
//       ) {
//         if (!field.label?.trim()) {
//           errors[field.id] =
//             "Field label is required.";
//         }

//         if (!field.fieldId?.trim()) {
//           errors[field.id] =
//             "Field ID is required.";
//         }

//         if (
//           field.fieldId &&
//           fieldIds.has(field.fieldId)
//         ) {
//           errors[field.id] =
//             "Field ID must be unique.";
//         }

//         if (field.fieldId) {
//           fieldIds.add(field.fieldId);
//         }
//       }

//       if (
//         [
//           "select",
//           "radio",
//           "checkbox_group",
//         ].includes(field.type)
//       ) {
//         if (!field.options?.length) {
//           errors[field.id] =
//             "At least one option is required.";
//         }
//       }
//     });

//     setFormErrors(errors);

//     return Object.keys(errors).length === 0;
//   };

//   /* =========================================================
//      SAVE
//   ========================================================= */

//   const saveForm = async () => {
//     if (!validateBuilder()) {
//       return;
//     }

//     const schema = {
//       name: formName,
//       type: formType,
//       version: 1,
//       fields: fields.map(
//         (field, index) => ({
//           ...field,
//           position: index,
//         })
//       ),
//     };

//     console.log(
//       "FORM SCHEMA:",
//       schema
//     );

//     /*
//       Replace with your Remix action/API:

//       const response = await fetch(
//         "/api/forms",
//         {
//           method: "POST",
//           headers: {
//             "Content-Type":
//               "application/json",
//           },
//           body: JSON.stringify(schema),
//         }
//       );

//       if (!response.ok) {
//         throw new Error(
//           "Failed to save form"
//         );
//       }
//     */

//     alert(
//       "Form saved successfully."
//     );
//   };

//   /* =========================================================
//      FIELD TYPE
//   ========================================================= */

//   const renderFieldType = (type) => {
//     const found = FIELD_TYPES.find(
//       (item) => item.type === type
//     );

//     return found?.label || type;
//   };

//   /* =========================================================
//      PREVIEW FIELD
//   ========================================================= */

//   const renderPreviewField = (field) => {
//     switch (field.type) {
//       case "text":
//         return (
//           <s-text-field
//             label={field.label}
//             placeholder={
//               field.placeholder
//             }
//             help-text={field.helpText}
//             required={field.required}
//           />
//         );

//       case "textarea":
//         return (
//           <s-text-field
//             label={field.label}
//             placeholder={
//               field.placeholder
//             }
//             help-text={field.helpText}
//             multiline
//             required={field.required}
//           />
//         );

//       case "email":
//         return (
//           <s-text-field
//             label={field.label}
//             type="email"
//             placeholder={
//               field.placeholder
//             }
//             help-text={field.helpText}
//             required={field.required}
//           />
//         );

//       case "phone":
//         return (
//           <s-text-field
//             label={field.label}
//             type="tel"
//             placeholder={
//               field.placeholder
//             }
//             help-text={field.helpText}
//             required={field.required}
//           />
//         );

//       case "number":
//         return (
//           <s-text-field
//             label={field.label}
//             type="number"
//             placeholder={
//               field.placeholder
//             }
//             help-text={field.helpText}
//             required={field.required}
//           />
//         );

//       case "url":
//         return (
//           <s-text-field
//             label={field.label}
//             type="url"
//             placeholder={
//               field.placeholder
//             }
//             help-text={field.helpText}
//             required={field.required}
//           />
//         );

//       case "date":
//         return (
//           <s-text-field
//             label={field.label}
//             type="date"
//             required={field.required}
//           />
//         );

//       case "select":
//         return (
//           <s-select
//             label={field.label}
//             value=""
//           >
//             <s-option value="">
//               {field.placeholder ||
//                 "Select"}
//             </s-option>

//             {(field.options || []).map(
//               (option) => (
//                 <s-option
//                   key={option.id}
//                   value={option.value}
//                 >
//                   {option.label}
//                 </s-option>
//               )
//             )}
//           </s-select>
//         );

//       case "radio":
//         return (
//           <s-stack
//             direction="block"
//             gap="small"
//           >
//             <s-text>
//               {field.label}
//               {field.required
//                 ? " *"
//                 : ""}
//             </s-text>

//             {(field.options || []).map(
//               (option) => (
//                 <s-radio-button
//                   key={option.id}
//                   name={field.fieldId}
//                   value={option.value}
//                   label={option.label}
//                 />
//               )
//             )}
//           </s-stack>
//         );

//       case "checkbox":
//         return (
//           <s-checkbox
//             label={field.label}
//           />
//         );

//       case "checkbox_group":
//         return (
//           <s-stack
//             direction="block"
//             gap="small"
//           >
//             <s-text>
//               {field.label}
//               {field.required
//                 ? " *"
//                 : ""}
//             </s-text>

//             {(field.options || []).map(
//               (option) => (
//                 <s-checkbox
//                   key={option.id}
//                   label={option.label}
//                 />
//               )
//             )}
//           </s-stack>
//         );

//       case "file":
//       case "multi_file":
//         return (
//           <s-drop-zone
//             label={
//               field.type ===
//               "multi_file"
//                 ? "Upload files"
//                 : "Upload file"
//             }
//             multiple={
//               field.type ===
//               "multi_file"
//             }
//           />
//         );

//       case "address":
//         return (
//           <s-stack
//             direction="block"
//             gap="base"
//           >
//             <s-text-field
//               label="Address"
//             />

//             <s-grid
//               gridTemplateColumns="1fr 1fr"
//               gap="base"
//             >
//               <s-text-field
//                 label="City"
//               />

//               <s-text-field
//                 label="Postal code"
//               />
//             </s-grid>

//             <s-select label="Country">
//               <s-option value="IN">
//                 India
//               </s-option>

//               <s-option value="AU">
//                 Australia
//               </s-option>

//               <s-option value="US">
//                 United States
//               </s-option>
//             </s-select>
//           </s-stack>
//         );

//       case "hidden":
//         return (
//           <s-banner tone="info">
//             Hidden field:{" "}
//             <strong>
//               {field.fieldId}
//             </strong>
//           </s-banner>
//         );

//       case "heading":
//         return (
//           <s-heading>
//             {field.label}
//           </s-heading>
//         );

//       case "paragraph":
//         return (
//           <s-text>
//             {field.label}
//           </s-text>
//         );

//       default:
//         return null;
//     }
//   };

//   /* =========================================================
//      FIELD SETTINGS
//   ========================================================= */

//   const renderFieldSettings = () => {
//     if (!selectedField) {
//       return (
//         <s-stack
//           direction="block"
//           gap="base"
//         >
//           <s-heading>
//             Select a field
//           </s-heading>

//           <s-text tone="subdued">
//             Select a field from the
//             form to configure it.
//           </s-text>
//         </s-stack>
//       );
//     }

//     const field = selectedField;

//     return (
//       <s-stack
//         direction="block"
//         gap="base"
//       >
//         <s-grid
//           gridTemplateColumns="1fr auto"
//           gap="base"
//           alignItems="center"
//         >
//           <s-heading>
//             Field settings
//           </s-heading>

//           <s-badge>
//             {renderFieldType(
//               field.type
//             )}
//           </s-badge>
//         </s-grid>

//         <s-divider />

//         {![
//           "heading",
//           "paragraph",
//         ].includes(field.type) && (
//           <>
//             <s-text-field
//               label="Label"
//               value={field.label}
//               error={
//                 formErrors[field.id]
//               }
//               onChange={(event) =>
//                 updateField(
//                   field.id,
//                   {
//                     label:
//                       getEventValue(
//                         event
//                       ),
//                   }
//                 )
//               }
//             />

//             <s-text-field
//               label="Field ID"
//               value={field.fieldId}
//               help-text="Used by your backend/API."
//               onChange={(event) =>
//                 updateField(
//                   field.id,
//                   {
//                     fieldId:
//                       slugify(
//                         getEventValue(
//                           event
//                         )
//                       ),
//                   }
//                 )
//               }
//             />
//           </>
//         )}

//         {![
//           "heading",
//           "paragraph",
//           "checkbox",
//           "checkbox_group",
//           "radio",
//           "select",
//           "address",
//           "hidden",
//           "file",
//           "multi_file",
//         ].includes(field.type) && (
//           <>
//             <s-text-field
//               label="Placeholder"
//               value={
//                 field.placeholder
//               }
//               onChange={(event) =>
//                 updateField(
//                   field.id,
//                   {
//                     placeholder:
//                       getEventValue(
//                         event
//                       ),
//                   }
//                 )
//               }
//             />

//             <s-text-field
//               label="Help text"
//               value={
//                 field.helpText
//               }
//               onChange={(event) =>
//                 updateField(
//                   field.id,
//                   {
//                     helpText:
//                       getEventValue(
//                         event
//                       ),
//                   }
//                 )
//               }
//             />
//           </>
//         )}

//         {field.type === "hidden" && (
//           <s-text-field
//             label="Default value"
//             value={
//               field.defaultValue
//             }
//             onChange={(event) =>
//               updateField(
//                 field.id,
//                 {
//                   defaultValue:
//                     getEventValue(
//                       event
//                     ),
//                 }
//               )
//             }
//           />
//         )}

//         {field.type === "heading" && (
//           <s-text-field
//             label="Heading"
//             value={field.label}
//             onChange={(event) =>
//               updateField(
//                 field.id,
//                 {
//                   label:
//                     getEventValue(
//                       event
//                     ),
//                 }
//               )
//             }
//           />
//         )}

//         {field.type ===
//           "paragraph" && (
//           <s-text-field
//             label="Paragraph"
//             value={field.label}
//             multiline
//             onChange={(event) =>
//               updateField(
//                 field.id,
//                 {
//                   label:
//                     getEventValue(
//                       event
//                     ),
//                 }
//               )
//             }
//           />
//         )}

//         {![
//           "heading",
//           "paragraph",
//           "hidden",
//         ].includes(field.type) && (
//           <s-checkbox
//             label="Required field"
//             checked={Boolean(
//               field.required
//             )}
//             onChange={(event) =>
//               updateField(
//                 field.id,
//                 {
//                   required:
//                     getEventChecked(
//                       event
//                     ),
//                 }
//               )
//             }
//           />
//         )}

//         {/* TEXT VALIDATION */}

//         {[
//           "text",
//           "textarea",
//           "phone",
//         ].includes(field.type) && (
//           <s-stack
//             direction="block"
//             gap="base"
//           >
//             <s-heading>
//               Validation
//             </s-heading>

//             <s-grid
//               gridTemplateColumns="1fr 1fr"
//               gap="base"
//             >
//               <s-text-field
//                 label="Minimum characters"
//                 type="number"
//                 value={
//                   field.validation
//                     ?.minLength
//                     ?.toString() ||
//                   ""
//                 }
//                 onChange={(event) =>
//                   updateValidation(
//                     field.id,
//                     {
//                       minLength:
//                         getEventValue(
//                           event
//                         ),
//                     }
//                   )
//                 }
//               />

//               <s-text-field
//                 label="Maximum characters"
//                 type="number"
//                 value={
//                   field.validation
//                     ?.maxLength
//                     ?.toString() ||
//                   ""
//                 }
//                 onChange={(event) =>
//                   updateValidation(
//                     field.id,
//                     {
//                       maxLength:
//                         getEventValue(
//                           event
//                         ),
//                     }
//                   )
//                 }
//               />
//             </s-grid>
//           </s-stack>
//         )}

//         {/* NUMBER VALIDATION */}

//         {field.type ===
//           "number" && (
//           <s-stack
//             direction="block"
//             gap="base"
//           >
//             <s-heading>
//               Number validation
//             </s-heading>

//             <s-grid
//               gridTemplateColumns="1fr 1fr"
//               gap="base"
//             >
//               <s-text-field
//                 label="Minimum"
//                 type="number"
//                 value={
//                   field.validation?.min?.toString() ||
//                   ""
//                 }
//                 onChange={(event) =>
//                   updateValidation(
//                     field.id,
//                     {
//                       min: getEventValue(
//                         event
//                       ),
//                     }
//                   )
//                 }
//               />

//               <s-text-field
//                 label="Maximum"
//                 type="number"
//                 value={
//                   field.validation?.max?.toString() ||
//                   ""
//                 }
//                 onChange={(event) =>
//                   updateValidation(
//                     field.id,
//                     {
//                       max: getEventValue(
//                         event
//                       ),
//                     }
//                   )
//                 }
//               />
//             </s-grid>
//           </s-stack>
//         )}

//         {/* EMAIL */}

//         {field.type ===
//           "email" && (
//           <s-banner tone="info">
//             Email format validation
//             is automatically applied.
//           </s-banner>
//         )}

//         {/* URL */}

//         {field.type ===
//           "url" && (
//           <s-banner tone="info">
//             URL format validation is
//             automatically applied.
//           </s-banner>
//         )}

//         {/* DATE */}

//         {field.type ===
//           "date" && (
//           <s-stack
//             direction="block"
//             gap="base"
//           >
//             <s-heading>
//               Date validation
//             </s-heading>

//             <s-text-field
//               label="Minimum date"
//               type="date"
//               value={
//                 field.validation
//                   ?.minDate || ""
//               }
//               onChange={(event) =>
//                 updateValidation(
//                   field.id,
//                   {
//                     minDate:
//                       getEventValue(
//                         event
//                       ),
//                   }
//                 )
//               }
//             />

//             <s-text-field
//               label="Maximum date"
//               type="date"
//               value={
//                 field.validation
//                   ?.maxDate || ""
//               }
//               onChange={(event) =>
//                 updateValidation(
//                   field.id,
//                   {
//                     maxDate:
//                       getEventValue(
//                         event
//                       ),
//                   }
//                 )
//               }
//             />
//           </s-stack>
//         )}

//         {/* OPTIONS */}

//         {[
//           "select",
//           "radio",
//           "checkbox_group",
//         ].includes(field.type) && (
//           <s-stack
//             direction="block"
//             gap="base"
//           >
//             <s-grid
//               gridTemplateColumns="1fr auto"
//               gap="base"
//               alignItems="center"
//             >
//               <s-heading>
//                 Options
//               </s-heading>

//               <s-button
//                 variant="secondary"
//                 onClick={() =>
//                   addOption(
//                     field.id
//                   )
//                 }
//               >
//                 + Add option
//               </s-button>
//             </s-grid>

//             {(field.options || []).map(
//               (option, index) => (
//                 <s-card
//                   key={option.id}
//                 >
//                   <s-stack
//                     direction="block"
//                     gap="base"
//                   >
//                     <s-grid
//                       gridTemplateColumns="1fr auto"
//                       gap="base"
//                       alignItems="center"
//                     >
//                       <s-text>
//                         Option{" "}
//                         {index + 1}
//                       </s-text>

//                       <s-button
//                         variant="tertiary"
//                         tone="critical"
//                         onClick={() =>
//                           deleteOption(
//                             field.id,
//                             option.id
//                           )
//                         }
//                       >
//                         Delete
//                       </s-button>
//                     </s-grid>

//                     <s-text-field
//                       label="Label"
//                       value={
//                         option.label
//                       }
//                       onChange={(event) =>
//                         updateOption(
//                           field.id,
//                           option.id,
//                           {
//                             label:
//                               getEventValue(
//                                 event
//                               ),
//                           }
//                         )
//                       }
//                     />

//                     <s-text-field
//                       label="Value"
//                       value={
//                         option.value
//                       }
//                       onChange={(event) =>
//                         updateOption(
//                           field.id,
//                           option.id,
//                           {
//                             value:
//                               slugify(
//                                 getEventValue(
//                                   event
//                                 )
//                               ),
//                           }
//                         )
//                       }
//                     />
//                   </s-stack>
//                 </s-card>
//               )
//             )}

//             {field.type ===
//               "checkbox_group" && (
//               <s-grid
//                 gridTemplateColumns="1fr 1fr"
//                 gap="base"
//               >
//                 <s-text-field
//                   label="Minimum selections"
//                   type="number"
//                   value={
//                     field.validation
//                       ?.minSelections
//                       ?.toString() ||
//                     ""
//                   }
//                   onChange={(event) =>
//                     updateValidation(
//                       field.id,
//                       {
//                         minSelections:
//                           getEventValue(
//                             event
//                           ),
//                       }
//                     )
//                   }
//                 />

//                 <s-text-field
//                   label="Maximum selections"
//                   type="number"
//                   value={
//                     field.validation
//                       ?.maxSelections
//                       ?.toString() ||
//                     ""
//                   }
//                   onChange={(event) =>
//                     updateValidation(
//                       field.id,
//                       {
//                         maxSelections:
//                           getEventValue(
//                             event
//                           ),
//                       }
//                     )
//                   }
//                 />
//               </s-grid>
//             )}
//           </s-stack>
//         )}

//         {/* FILE VALIDATION */}

//         {[
//           "file",
//           "multi_file",
//         ].includes(field.type) && (
//           <s-stack
//             direction="block"
//             gap="base"
//           >
//             <s-heading>
//               File validation
//             </s-heading>

//             <s-text-field
//               label="Maximum file size (MB)"
//               type="number"
//               value={
//                 field.validation
//                   ?.maxSizeMB
//                   ?.toString() ||
//                 ""
//               }
//               onChange={(event) =>
//                 updateValidation(
//                   field.id,
//                   {
//                     maxSizeMB:
//                       getEventValue(
//                         event
//                       ),
//                   }
//                 )
//               }
//             />

//             <s-text-field
//               label="Maximum files"
//               type="number"
//               value={
//                 field.validation
//                   ?.maxFiles
//                   ?.toString() ||
//                 ""
//               }
//               onChange={(event) =>
//                 updateValidation(
//                   field.id,
//                   {
//                     maxFiles:
//                       getEventValue(
//                         event
//                       ),
//                   }
//                 )
//               }
//             />

//             <s-choice-list
//               label="Allowed file types"
//               multiple
//               values={
//                 field.validation
//                   ?.allowedTypes || []
//               }
//               onChange={(event) =>
//                 updateValidation(
//                   field.id,
//                   {
//                     allowedTypes:
//                       event.target
//                         ?.values ||
//                       event.detail
//                         ?.values ||
//                       [],
//                   }
//                 )
//               }
//             >
//               <s-choice
//                 value="pdf"
//                 label="PDF"
//               />

//               <s-choice
//                 value="jpg"
//                 label="JPG"
//               />

//               <s-choice
//                 value="jpeg"
//                 label="JPEG"
//               />

//               <s-choice
//                 value="png"
//                 label="PNG"
//               />

//               <s-choice
//                 value="doc"
//                 label="DOC"
//               />

//               <s-choice
//                 value="docx"
//                 label="DOCX"
//               />
//             </s-choice-list>
//           </s-stack>
//         )}

//         {/* CONDITIONAL LOGIC */}

//         {![
//           "heading",
//           "paragraph",
//           "hidden",
//         ].includes(field.type) && (
//           <s-card>
//             <s-stack
//               direction="block"
//               gap="base"
//             >
//               <s-heading>
//                 Conditional visibility
//               </s-heading>

//               <s-text tone="subdued">
//                 Show this field only when
//                 another field matches a
//                 condition.
//               </s-text>

//               <s-select
//                 label="Condition field"
//                 value={
//                   field.conditions?.[0]
//                     ?.fieldId || ""
//                 }
//                 onChange={(event) => {
//                   const value =
//                     getEventValue(
//                       event
//                     );

//                   updateField(
//                     field.id,
//                     {
//                       conditions:
//                         value
//                           ? [
//                               {
//                                 fieldId:
//                                   value,
//                                 operator:
//                                   "equals",
//                                 value:
//                                   "",
//                               },
//                             ]
//                           : [],
//                     }
//                   );
//                 }}
//               >
//                 <s-option value="">
//                   No condition
//                 </s-option>

//                 {fields
//                   .filter(
//                     (item) =>
//                       item.id !==
//                         field.id &&
//                       [
//                         "select",
//                         "radio",
//                         "text",
//                       ].includes(
//                         item.type
//                       )
//                   )
//                   .map((item) => (
//                     <s-option
//                       key={item.id}
//                       value={
//                         item.fieldId
//                       }
//                     >
//                       {item.label}
//                     </s-option>
//                   ))}
//               </s-select>

//               {field.conditions
//                 ?.length > 0 && (
//                 <>
//                   <s-select
//                     label="Operator"
//                     value={
//                       field
//                         .conditions[0]
//                         .operator
//                     }
//                     onChange={(event) =>
//                       updateField(
//                         field.id,
//                         {
//                           conditions: [
//                             {
//                               ...field
//                                 .conditions[0],
//                               operator:
//                                 getEventValue(
//                                   event
//                                 ),
//                             },
//                           ],
//                         }
//                       )
//                     }
//                   >
//                     <s-option value="equals">
//                       Equals
//                     </s-option>

//                     <s-option value="not_equals">
//                       Does not equal
//                     </s-option>

//                     <s-option value="contains">
//                       Contains
//                     </s-option>

//                     <s-option value="not_empty">
//                       Is not empty
//                     </s-option>
//                   </s-select>

//                   {field
//                     .conditions[0]
//                     .operator !==
//                     "not_empty" && (
//                     <s-text-field
//                       label="Value"
//                       value={
//                         field
//                           .conditions[0]
//                           .value
//                       }
//                       onChange={(event) =>
//                         updateField(
//                           field.id,
//                           {
//                             conditions: [
//                               {
//                                 ...field
//                                   .conditions[0],
//                                 value:
//                                   getEventValue(
//                                     event
//                                   ),
//                               },
//                             ],
//                           }
//                         )
//                       }
//                     />
//                   )}
//                 </>
//               )}
//             </s-stack>
//           </s-card>
//         )}
//       </s-stack>
//     );
//   };

//   /* =========================================================
//      FIELD LIST
//   ========================================================= */

//   const renderFieldList = () => {
//     return (
//       <s-stack
//         direction="block"
//         gap="base"
//       >
//         {fields.map(
//           (field, index) => {
//             const selected =
//               selectedFieldId ===
//               field.id;

//             return (
//               <div
//                 key={field.id}
//                 draggable
//                 onDragStart={() =>
//                   handleDragStart(
//                     index
//                   )
//                 }
//                 onDragOver={(event) =>
//                   event.preventDefault()
//                 }
//                 onDrop={() =>
//                   handleDrop(index)
//                 }
//                 style={{
//                   cursor: "grab",
//                 }}
//               >
//                 <s-card
//                   background={
//                     selected
//                       ? "subdued"
//                       : undefined
//                   }
//                 >
//                   <s-grid
//                     gridTemplateColumns="1fr auto"
//                     gap="base"
//                     alignItems="center"
//                   >
//                     <div
//                       onClick={() =>
//                         setSelectedFieldId(
//                           field.id
//                         )
//                       }
//                       style={{
//                         cursor:
//                           "pointer",
//                       }}
//                     >
//                       <s-stack
//                         direction="block"
//                         gap="small"
//                       >
//                         <s-stack
//                           direction="inline"
//                           gap="small"
//                           alignItems="center"
//                         >
//                           <s-text>
//                             {field.label ||
//                               "Untitled field"}
//                           </s-text>

//                           {field.required &&
//                             ![
//                               "heading",
//                               "paragraph",
//                               "hidden",
//                             ].includes(
//                               field.type
//                             ) && (
//                               <s-badge tone="info">
//                                 Required
//                               </s-badge>
//                             )}
//                         </s-stack>

//                         <s-text tone="subdued">
//                           {renderFieldType(
//                             field.type
//                           )}
//                           {" • "}
//                           {
//                             field.fieldId
//                           }
//                         </s-text>
//                       </s-stack>
//                     </div>

//                     <s-stack
//                       direction="inline"
//                       gap="small"
//                     >
//                       <s-button
//                         variant="tertiary"
//                         onClick={() =>
//                           setSelectedFieldId(
//                             field.id
//                           )
//                         }
//                         accessibilityLabel="Edit field"
//                       >
//                         Settings
//                       </s-button>

//                       <s-button
//                         variant="tertiary"
//                         onClick={() =>
//                           duplicateField(
//                             field
//                           )
//                         }
//                         accessibilityLabel="Duplicate field"
//                       >
//                         Duplicate
//                       </s-button>

//                       <s-button
//                         variant="tertiary"
//                         tone="critical"
//                         onClick={() =>
//                           deleteField(
//                             field.id
//                           )
//                         }
//                         accessibilityLabel="Delete field"
//                       >
//                         Delete
//                       </s-button>
//                     </s-stack>
//                   </s-grid>
//                 </s-card>
//               </div>
//             );
//           }
//         )}

//         {fields.length === 0 && (
//           <s-card>
//             <s-stack
//               direction="block"
//               gap="base"
//             >
//               <s-heading>
//                 No fields yet
//               </s-heading>

//               <s-text tone="subdued">
//                 Add a field from the field
//                 picker.
//               </s-text>
//             </s-stack>
//           </s-card>
//         )}
//       </s-stack>
//     );
//   };

//   /* =========================================================
//      FIELD PICKER
//   ========================================================= */

//   const renderFieldPicker = () => {
//     return (
//       <s-card>
//         <s-stack
//           direction="block"
//           gap="base"
//         >
//           <s-heading>
//             Add field
//           </s-heading>

//           <s-stack
//             direction="block"
//             gap="small"
//           >
//             {FIELD_TYPES.map(
//               (item) => (
//                 <s-button
//                   key={item.type}
//                   variant="secondary"
//                   onClick={() =>
//                     addField(
//                       item.type
//                     )
//                   }
//                   fullWidth
//                 >
//                   {item.label}
//                 </s-button>
//               )
//             )}
//           </s-stack>
//         </s-stack>
//       </s-card>
//     );
//   };

//   /* =========================================================
//      PREVIEW
//   ========================================================= */

//   const renderPreview = () => {
//     return (
//       <s-page heading="Form preview">
//         <s-button
//           slot="secondary-actions"
//           onClick={() =>
//             setShowPreview(false)
//           }
//         >
//           Back
//         </s-button>

//         <s-section>
//           <s-card>
//             <s-stack
//               direction="block"
//               gap="large"
//             >
//               <s-heading>
//                 {formName}
//               </s-heading>

//               {fields.map(
//                 (field) => (
//                   <div
//                     key={field.id}
//                   >
//                     {renderPreviewField(
//                       field
//                     )}
//                   </div>
//                 )
//               )}

//               <s-divider />

//               <div
//                 style={{
//                   display: "flex",
//                   justifyContent:
//                     "flex-end",
//                 }}
//               >
//                 <s-button variant="primary">
//                   Submit
//                 </s-button>
//               </div>
//             </s-stack>
//           </s-card>
//         </s-section>
//       </s-page>
//     );
//   };

//   if (showPreview) {
//     return renderPreview();
//   }

//   /* =========================================================
//      MAIN
//   ========================================================= */

//   return (
//     <s-page heading="Create form">
//       <s-button
//         slot="primary-action"
//         variant="primary"
//         onClick={saveForm}
//       >
//         Save form
//       </s-button>

//       <s-button
//         slot="secondary-actions"
//         onClick={() =>
//           setShowPreview(true)
//         }
//       >
//         Preview
//       </s-button>

//       <s-button
//         slot="breadcrumb-actions"
//         onClick={() =>
//           console.log(
//             "Back to forms"
//           )
//         }
//       >
//         Forms
//       </s-button>

//       <s-section>
//         <s-grid
//           gridTemplateColumns="280px minmax(400px, 1fr) 360px"
//           gap="base"
//           alignItems="start"
//         >
//           {/* =================================================
//               LEFT
//           ================================================= */}

//           <s-stack
//             direction="block"
//             gap="base"
//           >
//             <s-card>
//               <s-stack
//                 direction="block"
//                 gap="base"
//               >
//                 <s-heading>
//                   Form settings
//                 </s-heading>

//                 <s-text-field
//                   label="Form name"
//                   value={formName}
//                   error={
//                     formErrors.formName
//                   }
//                   onChange={(event) =>
//                     setFormName(
//                       getEventValue(
//                         event
//                       )
//                     )
//                   }
//                 />

//                 <s-select
//                   label="Form type"
//                   value={formType}
//                   onChange={(event) =>
//                     setFormType(
//                       getEventValue(
//                         event
//                       )
//                     )
//                   }
//                 >
//                   <s-option value="company_customer">
//                     Company + Customer
//                   </s-option>

//                   <s-option value="company">
//                     Company
//                   </s-option>

//                   <s-option value="customer">
//                     Customer
//                   </s-option>

//                   <s-option value="custom">
//                     Custom
//                   </s-option>
//                 </s-select>
//               </s-stack>
//             </s-card>

//             {renderFieldPicker()}
//           </s-stack>

//           {/* =================================================
//               CENTER
//           ================================================= */}

//           <s-card>
//             <s-stack
//               direction="block"
//               gap="base"
//             >
//               <s-grid
//                 gridTemplateColumns="1fr auto"
//                 gap="base"
//                 alignItems="center"
//               >
//                 <s-stack
//                   direction="block"
//                   gap="small"
//                 >
//                   <s-heading>
//                     Form fields
//                   </s-heading>

//                   <s-text tone="subdued">
//                     Drag fields to change
//                     their order.
//                   </s-text>
//                 </s-stack>

//                 <s-badge>
//                   {fields.length} fields
//                 </s-badge>
//               </s-grid>

//               <s-divider />

//               {renderFieldList()}
//             </s-stack>
//           </s-card>

//           {/* =================================================
//               RIGHT
//           ================================================= */}

//           <s-card>
//             {renderFieldSettings()}
//           </s-card>
//         </s-grid>
//       </s-section>

//       {/* =================================================
//           JSON DEBUG
//       ================================================= */}

//       <s-section>
//         <s-card>
//           <s-stack
//             direction="block"
//             gap="base"
//           >
//             <s-heading>
//               Form schema
//             </s-heading>

//             <pre
//               style={{
//                 margin: 0,
//                 padding: "16px",
//                 overflowX: "auto",
//                 background:
//                   "#f6f6f7",
//                 borderRadius: "8px",
//                 fontSize: "12px",
//                 lineHeight: 1.5,
//               }}
//             >
//               {JSON.stringify(
//                 {
//                   name: formName,
//                   type: formType,
//                   version: 1,
//                   fields:
//                     fields.map(
//                       (
//                         field,
//                         index
//                       ) => ({
//                         ...field,
//                         position:
//                           index,
//                       })
//                     ),
//                 },
//                 null,
//                 2
//               )}
//             </pre>
//           </s-stack>
//         </s-card>
//       </s-section>
//     </s-page>
//   );
// }