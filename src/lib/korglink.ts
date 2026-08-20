// The ONE way kfdc turns a korg node id into a korg URL (GP-16, korg #1467,
// shipped in korg sprint 070).
//
// korg's `/n/:node_id` resolves the node's kind server-side and 307s to the
// canonical page. That is the call kfdc cannot make for itself: a board row
// carries an id and, for several kinds, nothing that says which page holds it
// — `korg:1395` could be `/planning/1395` or `/work-items/1395` and only korg
// knows which.
//
// What stood here before was a kind → path map, which is precisely GP-16's
// named forbidden third answer, and it was wrong in production rather than
// merely unfashionable:
//
//   workitem       → `/work-items?wi=N`   a URL korg never served. The Work
//                                         Items page reads no URL parameters,
//                                         so every Net Log and Ticker work-item
//                                         link landed on the unfiltered list.
//                                         korg sprint 070's route audit found
//                                         it; nothing on the board could.
//   sprint_proposal→ `/planning`          the list page, not the node.
//   six other kinds→ null                 rendered as plain text, correctly
//                                         degrading (kfdc #993: don't fake
//                                         URLs) but smaller than it needed to
//                                         be.
//
// A map is a claim about korg's vocabulary; korg grows that vocabulary between
// deploys and the consumer meets the new kind in production with no row for it.
// This is a question korg answers at request time instead — so there is no
// `kind` parameter here, and there should never be one. If a link ever needs to
// know a kind, that is korg's `url` field on the ref (`NodePreview.url`,
// `SearchHit.url`), not a table in kfdc.
export function nodeHref(base: string, nodeId: number): string {
	return `${base}/n/${nodeId}`;
}
