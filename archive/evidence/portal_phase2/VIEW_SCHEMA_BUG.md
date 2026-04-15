# VIEW SCHEMA BUG EVIDENCE
# Generated: 2026-01-27T07:50:00Z
# Issue: RPC references non-existent columns in view

================================================================================
ERROR MESSAGE
================================================================================

ERROR:  42703: column v.tuition_usd_year does not exist

QUERY context:
  CASE v_tuition_basis
    WHEN 'year' THEN v.tuition_usd_year           <-- DOES NOT EXIST
    WHEN 'semester' THEN v.tuition_usd_semester   <-- DOES NOT EXIST  
    WHEN 'program_total' THEN v.tuition_usd_program_total  <-- DOES NOT EXIST
  END

================================================================================
ROOT CAUSE
================================================================================

The RPC `rpc_kb_programs_search_v1_3_final` was written assuming the view
`vw_program_search_api_v3_final` has these columns:
- tuition_usd_year
- tuition_usd_semester
- tuition_usd_program_total

But the actual view likely has different column names:
- tuition_usd_year_min / tuition_usd_year_max
- Or similar naming convention

================================================================================
IMPACT
================================================================================

- ALL valid HMAC requests will FAIL at query execution
- Even if keys are correct, the view schema mismatch breaks everything
- This is a BLOCKING BUG for CRM integration

================================================================================
FIX OPTIONS
================================================================================

Option 1: Update RPC to use correct column names
Option 2: Update view to add expected column aliases

Either way, this is a migration/schema fix.

================================================================================
BLOCKING STATUS: 🔴 YES - HMAC endpoint is non-functional
================================================================================
