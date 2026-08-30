SELECT created_at, event_type, provider, amount, status, error_message
FROM payment_logs
WHERE provider = 'wave'
ORDER BY created_at DESC
LIMIT 20;
