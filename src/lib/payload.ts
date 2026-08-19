// What one board render needs, named once. Two routes (`/` and `/wall`) and
// the wall's refresh endpoint all produce it, and a wall that reassigns its
// whole state from a fetch has no compiler help at all unless the shape has a
// name the three of them share.
import type { Board } from './board';
import type { WorkItemFlowSeries } from './flow';
import type { NetLogLine } from './netlog';

export interface BoardPayload {
	board: Board;
	// Allowed to be null: korg may predate the flow endpoint, and one panel
	// losing its feed must never take down the board.
	flow: WorkItemFlowSeries | null;
	netlog: NetLogLine[];
	korgBase: string;
}
