-- Removes two test registrations (and their tickets):
--   Lenny Dev           · UPI txn 123456789012
--   Lenny Dany Derek D  · registration 091b4637-19a2-4eef-a32d-3e4b8b0712fd (ticket HW-27-32724)
-- Run in the Supabase SQL editor. Step 1 shows what will be deleted; step 2 deletes it.

-- 1. Preview (should return exactly 2 rows)
select id, full_name, upi_txn_id, status, payment_proof_path
from public.registrations
where upi_txn_id = '123456789012'
   or id = '091b4637-19a2-4eef-a32d-3e4b8b0712fd';

-- 2. Delete (tickets first, then the registrations)
begin;

delete from public.tickets
where registration_id in (
  select id from public.registrations
  where upi_txn_id = '123456789012'
     or id = '091b4637-19a2-4eef-a32d-3e4b8b0712fd'
);

delete from public.registrations
where upi_txn_id = '123456789012'
   or id = '091b4637-19a2-4eef-a32d-3e4b8b0712fd';

commit;

-- The Lenny Dev payment screenshot (if any) stays in the private payment-proofs
-- bucket; remove it from Storage > payment-proofs in the dashboard if you want.
