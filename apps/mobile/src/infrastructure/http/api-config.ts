/** Legacy envelope-client base URL. App boot validates configuration through
 * resolveMobileConfig; absent configuration never selects mock gateways.
 * Tests may inject adapters explicitly through their composition roots.
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
