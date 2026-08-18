# Project Overview: Shopify B2B Feature Gap App

## Core Purpose
* Fills gaps in Shopify B2B native features based on merchant requirements.

## UI Components
* **Button 1**: Create Market
* **Button 2**: Create Catalog
* **Table**: Displays Market and Catalog connections ONLY when Market has "IncludesCondition type Company locations".
* **Tag Input**: Additional field to assign tags.

## Automation & Webhooks
* Subscribed to webhooks: `customer.tags_added`, `customer.tags_removed`, `customers/delete` (tag changes).
* Trigger: When a specific tag matches a customer tag.
* Action: Automatically creates a Company with:
  * Customer assigned as the main contact.
  * Fixed Company Name: `nx5cworkerOnly`
  * External ID: Same as `customerId`. Note : If the same customer adds multiple tags at different times, it will not create multiple companies. 
  * Permissions: Order-only.
  * Remove Company On Tag Remove.
  * Checkout Flow: Ship to any one-time address (100% operational).