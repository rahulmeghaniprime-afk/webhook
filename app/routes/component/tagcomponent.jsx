export default function Tagcomponent({markets}){
    return(
        <>
        {markets.map((market) => (
            <s-modal
                id={market.id}
                heading={`Add Tag to Assign Customer to Market ${market.name} and catalog ${market.catalogs.nodes.map(catalog => catalog.title).join(', ')}.`}
            >
                <s-grid gridTemplateColumns="auto 1fr" alignItems="center" gap="small-300">
                <s-text>Customer Tag</s-text>
                <s-text-field
                placeholder="B2B, Wholesaler, VIP etc."
                ></s-text-field>
                </s-grid>

                <s-button slot="primary-action" variant="primary" onClick={() => closeModal(market.id)}>Save</s-button>
                <s-button
                slot="secondary-actions"
                onClick={() => closeModal(market.id)}
                >
                Close
                </s-button>
            </s-modal>
        ))}
        </>
    )
}