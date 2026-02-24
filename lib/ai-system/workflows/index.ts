/**
 * Workflows Index
 * Universal tool-augmented workflow system
 */

// ============================================================================
// UNIVERSAL WORKFLOW
// ============================================================================

export { executeUniversalWorkflow, createInitialState } from "./universal";

// ============================================================================
// DEPRECATED WORKFLOWS - MOVED TO _deprecated/workflows/
// ============================================================================

// Old workflows (dm-workflow, post-workflow, governance-workflow) have been
// moved to lib/ai-system/_deprecated/workflows/ directory.
//
// All new code should use the Universal Workflow System above.
//
// Migration guide:
// OLD: import { runDMWorkflow } from "@/lib/ai-system/workflows/dm-workflow";
// NEW: import { executeUniversalWorkflow, createInitialState } from "@/lib/ai-system";
//
// See docs/guides/advanced-scalable-workflow.md for detailed migration instructions.
