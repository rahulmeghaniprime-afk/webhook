import { authenticate } from "../shopify.server";
import { useLoaderData } from "react-router";
import RichTextEditor from '../component/RichTextEditor'

export const loader = async ({ request }) => {
    await authenticate.admin(request);
    const url = new URL(request.url);
    const formName = url.searchParams.get('name');
    return { formName }
}

export default function New() {
    const { formName } = useLoaderData();
    console.log(useLoaderData());
    return (
        <>
            <s-page heading={formName}>
                <s-stack padding="base">
                    <s-heading><span style={{ display: 'block', fontSize: '18px' }}>{formName}</span></s-heading>
                </s-stack>
                <s-section heading="Form">
                    formName {formName ? formName : 'not'}
                    <RichTextEditor />
                </s-section>
            </s-page>
        </>
    );
}