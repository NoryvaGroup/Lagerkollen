# Private instructions library

Documents are independent of orders and product numbers. A category such as
"Alla cup Europa" applies to the models the operator identifies, with no
automatic compatibility inference.

The `lagerkollen_manuals` table contains owner-scoped metadata. PDF files live
in the private `lagerkollen-manuals` Storage bucket. Authenticated users can
read only their own metadata and files referenced by that metadata. Client
write/delete access is intentionally absent. No service-role key is in the app.

The client downloads a PDF only after an explicit click, using the existing
session. The browser's PDF reader handles paging and zoom. Blob URLs are
revoked when the reader closes or the account changes. Documents are never
included in the order JSON backup, localStorage, IndexedDB or service-worker
cache. Network access and an authenticated session are required to open one.

The first supplied scan has 11 pages. A rotated reading copy was generated
without cropping or changing text, illustrations or page order. The original
80 MB source stays unchanged; the reading copy is 9.7 MB. The import endpoint
used an expiring random capability and an exact content hash, accepted only
this file, and was replaced by an inert JWT-protected endpoint after import.

Order schema, sync revisions, locations and picking statuses were not changed.
