# i18n Translation Audit

## Quick Start

Run the audit script to analyze translation usage:

```bash
node scripts/i18n_audit.js
```

## Output

The script generates `translation-audit.json` with:

- **used_literal_keys**: All keys found via `t("key")` calls
- **unused_keys**: Keys in dictionary but never called
- **missing_keys**: Keys called but not in dictionary  
- **dynamic_calls**: Dynamic `t(variable)` calls with file/line info
- **usage_by_file**: Key usage grouped by source file

## Dynamic Whitelist

Keys called dynamically (e.g., `t(customer.status)`) are protected in:

```
src/locales/dynamic_whitelist.ts
```

Categories include:
- Payment statuses
- Document statuses
- Customer stages
- Month names
- Application statuses
- Service types

## Safe Cleanup Formula

```
safe_to_remove = unused_keys - whitelisted_dynamic_keys
```

Only delete keys that match this formula.
