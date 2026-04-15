/**
 * ════════════════════════════════════════════════════════════════════════════
 * PORTAL SEARCH MODULE - Central Export
 * ════════════════════════════════════════════════════════════════════════════
 */

// Search Executor (P21)
export {
  type SearchParams,
  type SearchResult,
  type ExecuteSearchOptions,
  executeSearch,
  abortCurrentSearch,
  clearSearchCache,
  resetSearchExecutor,
} from './searchExecutor';
