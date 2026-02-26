-- Developer: Dev Z

-- Violations:
-- - Table name doesn't start with TBHUB_
-- - Missing index and sequence

CREATE TABLE ORDER_HDR (
  ORDER_ID NUMBER PRIMARY KEY,
  CREATED_ON DATE NOT NULL
);

