/**
 * ✅ Workflow Module Exports
 * Centralized exports for workflow tracing and program references
 */

export {
  getClientTraceId,
  createActionId,
  clearWorkflowSession,
  buildTraceHeaders,
  buildTraceBody,
} from './tracing';

export {
  buildProgramRef,
  isValidProgramRef,
  getProgramRefDisplayName,
  getProgramRefUniversityName,
  type ProgramRef,
} from './programRef';
