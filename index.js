/**
 * Host half of dsh-thinking-fx.
 *
 * The cordis Loader mounts a row by importing its package on the HOST, so a
 * browser-only package still needs a node entry. Everything visual lives in
 * ./lib/client.js; this half declares no `inject` and does nothing.
 *
 * Named `apply` (never `export default`) — cordis reads the plugin's `inject`
 * off the module namespace, and a default-export function silently drops it.
 */

/** Plugin name; also the roster id the browser bundle registers under. */
export const name = 'dsh-thinking-fx'

/** No host-side behaviour. */
export function apply() {}
