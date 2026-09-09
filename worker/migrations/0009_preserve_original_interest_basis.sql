UPDATE debt_agreement_versions
SET interest_basis = 'original'
WHERE interest_mode = 'percentage'
  AND debt_id NOT IN (
    SELECT debt_id
    FROM debt_payment_operations
    WHERE principal_applied_minor > 0
  );
