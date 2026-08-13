/**
 * dsh-plugin-marketplace — node half.
 *
 * The empty apply exists so the plugin appears in the host Loader; the
 * browser half owns the marketplace section through exports["./client"],
 * discovered from the package.json `dsh.client` declaration.
 */
/** Host plugin body — no host-side behavior for this surface plugin. */
function apply() {}

export { apply };
