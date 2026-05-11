-- 0057_grant_hotel_booking_service_role.sql
-- Migration 0049 revoked EXECUTE from anon/public but never granted to service_role.
-- The service_role client (createAdminClient) calls this RPC; without an explicit GRANT
-- the call fails silently and booked_rooms is never incremented.
GRANT EXECUTE ON FUNCTION adjust_hotel_booking(UUID, UUID) TO service_role;
