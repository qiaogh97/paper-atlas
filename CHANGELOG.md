# Changelog

## 1.1.1 - 2026-11-10

- Refresh the portable snapshot to 43,139 processed papers, including newly extracted ECCV and NeurIPS papers.
- Preserve 18,764 source-checked, 24,360 pending-review and 15 historical labels; exclude failed and unverifiable records.
- Match ICLR official links using the original paper filename when the extracted title differs.

## 1.1.0 - 2026-11-03

- Expand the published snapshot from 205 to 18,837 processed papers across five conferences and 2022–2026.
- Label source-checked, pending-review and historical records; preserve pending evidence notes.
- Load evidence on demand through hashed shards; support dynamic conference/year filters and large facet lists.
- Resolve official paper/PDF links and export extraction status in CSV.
- Verify portable source hashes, every indexed detail and desktop/mobile browser behavior.
