SELECT public.process_payment_webhook(
  'MP261011.2107.B04584:SUCCESS',
  '138b559b-d805-446f-bdc6-3e26afbc665c'::uuid,
  'orange_money',
  'SUCCESS',
  'MP261011.2107.B04584',
  3030,
  true,
  '{"source":"manual_recovery","om_ref":"MP261011.2107.B04584","note":"webhook OM non recu - declenche manuellement"}'::jsonb
);
