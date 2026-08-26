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