'use strict';
/**
 * The text of an error, never empty. When a name has two addresses (IPv4 and IPv6) and both refuse, Node gives an "AggregateError" whose own
 * message is empty: the program took the empty text for success and believed it was connected to a server that was not there.
 */
function errorText(err) {
  if (!err) return 'unknown error';
  if (err.message) return String(err.message);
  const first = Array.isArray(err.errors) ? err.errors.find((x) => x && x.message) : null;
  if (first) return String(first.message);
  return err.code ? String(err.code) : String(err) !== '[object Object]' && String(err) !== 'Error' && String(err) !== 'AggregateError' ? String(err) : 'unknown error';
}
module.exports = { errorText };
