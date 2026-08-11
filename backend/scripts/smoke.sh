#!/usr/bin/env bash
# End-to-end smoke test for Mraru onboarding (Path A + Path B).
# Requires the API running on :4000 with SMS_PROVIDER=dev and a migrated DB.
set -uo pipefail

BASE="${BASE:-http://localhost:4000/api/v1}"
J='Content-Type: application/json'
PASS=0
FAIL=0

# curl with a hard timeout so a hung server can never stall the suite
C() { curl -s -m 8 "$@"; }
CJ() { curl -s -m 8 -H "$J" "$@"; }

step() { echo; echo "=== $1 ==="; }
check() { # check <label> <actual> <expected-substring>
  if echo "$2" | grep -q "$3"; then echo "  ✓ $1"; PASS=$((PASS+1));
  else echo "  ✗ $1"; echo "    got: $(echo "$2" | head -c 400)"; FAIL=$((FAIL+1)); fi
}

# small valid PNG (1x1) for KYC uploads
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\x0aIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\x0d\x0a\x2d\xb4\x00\x00\x00\x00IEND\xaeB\x60\x82' > /tmp/pixel.png

step "Health"
HEALTH=$(C "http://localhost:4000/health")
check "health ok" "$HEALTH" '"ok":true'

step "OTP send (founder)"
OTP1=$(CJ -X POST "$BASE/auth/otp/send" -d '{"phone":"+254711000001","purpose":"signup"}')
check "dev code returned" "$OTP1" '"devCode"'
CODE1=$(echo "$OTP1" | jq -r .devCode)

step "OTP verify (founder)"
VERIFY1=$(CJ -X POST "$BASE/auth/otp/verify" -d "{\"phone\":\"+254711000001\",\"code\":\"$CODE1\",\"purpose\":\"signup\"}")
check "grant issued" "$VERIFY1" '"grant"'
GRANT1=$(echo "$VERIFY1" | jq -r .grant)

step "Path A — create chama"
CREATE=$(CJ -X POST "$BASE/chamas" -d "{
  \"chama\": {
    \"name\": \"Mraru Test\",
    \"county\": \"Nairobi\",
    \"chamaType\": \"investment_group\",
    \"votingModel\": \"one_member_one_vote\",
    \"foundingDate\": \"2026-01-15\",
    \"expectedMembersMin\": 10,
    \"expectedMembersMax\": 40,
    \"minimumContribution\": \"2000\",
    \"contributionDueDay\": 5,
    \"lendingEnabled\": true
  },
  \"founder\": { \"fullName\": \"Amina Wanjiku\", \"nationalId\": \"31245678\", \"phone\": \"+254711000001\", \"email\": \"amina@example.com\" },
  \"otpGrant\": \"$GRANT1\",
  \"password\": \"S3cure-password!\",
  \"constitution\": { \"mode\": \"template\", \"accepted\": true }
}")
check "chama created" "$CREATE" '"status":"pending_setup"'
check "slug present" "$CREATE" '"slug"'
check "tokens issued" "$CREATE" '"accessToken"'
ACCESS1=$(echo "$CREATE" | jq -r .tokens.accessToken)
REFRESH1=$(echo "$CREATE" | jq -r .tokens.refreshToken)
SLUG=$(echo "$CREATE" | jq -r .chama.slug)
JOINCODE=$(echo "$CREATE" | jq -r .chama.joinCode)
FOUNDER_ID=$(echo "$CREATE" | jq -r .member.id)
echo "    slug=$SLUG joinCode=$JOINCODE founder=$FOUNDER_ID"

step "Auth — /me (founder, chairperson)"
ME1=$(C "$BASE/auth/me" -H "Authorization: Bearer $ACCESS1")
check "role chairperson" "$ME1" '"role":"chairperson"'
check "id redacted" "$ME1" '"nationalIdRedacted":"NC-••••5678"'

step "Auth — login with password"
LOGIN=$(CJ -X POST "$BASE/auth/login" -d '{"phone":"+254711000001","password":"S3cure-password!"}')
check "login ok" "$LOGIN" '"accessToken"'

step "Auth — wrong password rejected"
BAD=$(CJ -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/login" -d '{"phone":"+254711000001","password":"wrong"}')
check "401 on bad password" "$BAD" '401'

step "Auth — refresh token rotation"
ROT=$(CJ -X POST "$BASE/auth/refresh" -d "{\"refreshToken\":\"$REFRESH1\"}")
check "new access token" "$ROT" '"accessToken"'
ROT2=$(CJ -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/refresh" -d "{\"refreshToken\":\"$REFRESH1\"}")
check "reuse of old refresh rejected" "$ROT2" '401'

step "Invite Treasurer (chairperson only)"
INV1=$(CJ -X POST "$BASE/invites" -H "Authorization: Bearer $ACCESS1" -d '{"phone":"+254711000002","role":"treasurer"}')
check "treasurer invited" "$INV1" '"invite'
LINK_TREASURER=$(echo "$INV1" | jq -r .invite.devLink)

step "Invite Secretary"
INV2=$(CJ -X POST "$BASE/invites" -H "Authorization: Bearer $ACCESS1" -d '{"phone":"+254711000003","role":"secretary"}')
check "secretary invited" "$INV2" '"invite'
LINK_SECRETARY=$(echo "$INV2" | jq -r .invite.devLink)

step "Role gate — plain member cannot invite core roles (skip; member created later)"

step "OTP for Treasurer"
OTP2=$(CJ -X POST "$BASE/auth/otp/send" -d '{"phone":"+254711000002","purpose":"signup"}')
CODE2=$(echo "$OTP2" | jq -r .devCode)
VERIFY2=$(CJ -X POST "$BASE/auth/otp/verify" -d "{\"phone\":\"+254711000002\",\"code\":\"$CODE2\",\"purpose\":\"signup\"}")
GRANT2=$(echo "$VERIFY2" | jq -r .grant)

step "Path B — Treasurer joins via invite link"
INVCODE_TREASURER=$(echo "$LINK_TREASURER" | sed 's/.*invite=//')
JOIN2=$(CJ -X POST "$BASE/chamas/$SLUG/join" -d "{
  \"code\": \"$INVCODE_TREASURER\",
  \"phone\": \"+254711000002\",
  \"fullName\": \"Brian Otieno\",
  \"nationalId\": \"22123456\",
  \"email\": \"brian@example.com\",
  \"nextOfKin\": { \"name\": \"Grace Otieno\", \"phone\": \"+254711000099\", \"relationship\": \"Sister\" },
  \"otpGrant\": \"$GRANT2\"
}")
check "treasurer joined pending" "$JOIN2" '"status":"pending_review"'
check "role pre-set to treasurer" "$JOIN2" '"role":"treasurer"'
ACCESS2=$(echo "$JOIN2" | jq -r .tokens.accessToken)
TREASURER_ID=$(echo "$JOIN2" | jq -r .memberId)

step "Pending queue (founder sees applications)"
PENDING=$(C "$BASE/members/pending" -H "Authorization: Bearer $ACCESS1")
check "treasurer in pending queue" "$PENDING" 'Brian Otieno'
check "id redacted in queue" "$PENDING" '"nationalIdRedacted":"NC-••••3456"'

step "Approve Treasurer"
APPROVE=$(CJ -X POST "$BASE/members/$TREASURER_ID/approve" -H "Authorization: Bearer $ACCESS1")
check "approval ok" "$APPROVE" 'Member approved'

step "Chama still pending_setup (no secretary yet)"
ME1B=$(C "$BASE/auth/me" -H "Authorization: Bearer $ACCESS1")
check "status still pending_setup" "$ME1B" '"status":"pending_setup"'

step "Secretary joins (join code path — pre-fills member role)"
OTP3=$(CJ -X POST "$BASE/auth/otp/send" -d '{"phone":"+254711000003","purpose":"signup"}')
CODE3=$(echo "$OTP3" | jq -r .devCode)
VERIFY3=$(CJ -X POST "$BASE/auth/otp/verify" -d "{\"phone\":\"+254711000003\",\"code\":\"$CODE3\",\"purpose\":\"signup\"}")
GRANT3=$(echo "$VERIFY3" | jq -r .grant)
JOIN3=$(CJ -X POST "$BASE/chamas/$SLUG/join" -d "{
  \"code\": \"$JOINCODE\",
  \"phone\": \"+254711000003\",
  \"fullName\": \"Cynthia Njeri\",
  \"nationalId\": \"19876543\",
  \"nextOfKin\": { \"name\": \"Paul Njeri\", \"phone\": \"+254711000088\", \"relationship\": \"Father\" },
  \"otpGrant\": \"$GRANT3\"
}")
SECRETARY_ID=$(echo "$JOIN3" | jq -r .memberId)
check "secretary joined as member role initially" "$JOIN3" '"role":"member"'

step "Approve Secretary"
CJ -X POST "$BASE/members/$SECRETARY_ID/approve" -H "Authorization: Bearer $ACCESS1" > /dev/null

step "Chama activates once chairperson+treasurer+secretary are active"
ME1C=$(C "$BASE/auth/me" -H "Authorization: Bearer $ACCESS1")
check "chama status active" "$ME1C" '"status":"active"'

step "Constitution — current (founder already accepted)"
CONST=$(C "$BASE/constitutions/current" -H "Authorization: Bearer $ACCESS1")
check "version 1" "$CONST" '"version":1'
check "accepted by founder" "$CONST" '"acceptedByMe":true'

step "Constitution — treasurer accepts"
CONST_T=$(C "$BASE/constitutions/current" -H "Authorization: Bearer $ACCESS2")
CID=$(echo "$CONST_T" | jq -r .constitution.id)
ACCEPT=$(CJ -X POST "$BASE/constitutions/$CID/accept" -H "Authorization: Bearer $ACCESS2")
check "acceptance ok" "$ACCEPT" 'Constitution accepted'

step "KYC upload (treasurer self-service)"
KYC=$(C -X POST "$BASE/members/$TREASURER_ID/kyc" -H "Authorization: Bearer $ACCESS2" -F front=@/tmp/pixel.png -F back=@/tmp/pixel.png)
check "two documents stored" "$KYC" '"documents"'
check "front kind" "$KYC" 'national_id_front'

step "KYC upload cross-tenant guard (member cannot upload for another member)"
KYC_BAD=$(C -o /dev/null -w '%{http_code}' -X POST "$BASE/members/$FOUNDER_ID/kyc" -H "Authorization: Bearer $ACCESS2" -F front=@/tmp/pixel.png)
check "403 for other member" "$KYC_BAD" '403'

step "Reject flow — a 4th applicant"
OTP4=$(CJ -X POST "$BASE/auth/otp/send" -d '{"phone":"+254711000004","purpose":"signup"}')
CODE4=$(echo "$OTP4" | jq -r .devCode)
VERIFY4=$(CJ -X POST "$BASE/auth/otp/verify" -d "{\"phone\":\"+254711000004\",\"code\":\"$CODE4\",\"purpose\":\"signup\"}")
GRANT4=$(echo "$VERIFY4" | jq -r .grant)
JOIN4=$(CJ -X POST "$BASE/chamas/$SLUG/join" -d "{
  \"code\": \"$JOINCODE\",
  \"phone\": \"+254711000004\",
  \"fullName\": \"Diana Mwangi\",
  \"nationalId\": \"87654321\",
  \"nextOfKin\": { \"name\": \"Sam Mwangi\", \"phone\": \"+254711000077\", \"relationship\": \"Husband\" },
  \"otpGrant\": \"$GRANT4\"
}")
MEMBER4_ID=$(echo "$JOIN4" | jq -r .memberId)
REJ=$(CJ -X POST "$BASE/members/$MEMBER4_ID/reject" -H "Authorization: Bearer $ACCESS1" -d '{"reason":"ID document did not match application details"}')
check "rejection with reason" "$REJ" 'Application rejected'

step "Reject without reason blocked"
REJ_BAD=$(CJ -o /dev/null -w '%{http_code}' -X POST "$BASE/members/$MEMBER4_ID/reject" -H "Authorization: Bearer $ACCESS1" -d '{}')
check "400 for missing reason" "$REJ_BAD" '400'

step "Duplicate join attempt blocked"
DUP=$(CJ -o /dev/null -w '%{http_code}' -X POST "$BASE/chamas/$SLUG/join" -d "{
  \"code\": \"$JOINCODE\",
  \"phone\": \"+254711000002\",
  \"fullName\": \"Brian Otieno Again\",
  \"nationalId\": \"22123456\",
  \"nextOfKin\": { \"name\": \"Grace Otieno\", \"phone\": \"+254711000099\", \"relationship\": \"Sister\" },
  \"otpGrant\": \"$GRANT2\"
}")
check "409 duplicate join" "$DUP" '409'

step "OTP grant cannot be reused for another phone"
MISMATCH=$(CJ -o /dev/null -w '%{http_code}' -X POST "$BASE/chamas/$SLUG/join" -d "{
  \"code\": \"$JOINCODE\",
  \"phone\": \"+254711000005\",
  \"fullName\": \"Eve Kariuki\",
  \"nationalId\": \"11112222\",
  \"nextOfKin\": { \"name\": \"X\", \"phone\": \"+254711000066\", \"relationship\": \"Friend\" },
  \"otpGrant\": \"$GRANT2\"
}")
check "403 phone/grant mismatch" "$MISMATCH" '403'

step "OTP send capped at 3 per 10 min"
R1=$(CJ -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/otp/send" -d '{"phone":"+254799999999","purpose":"signup"}')
R2=$(CJ -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/otp/send" -d '{"phone":"+254799999999","purpose":"signup"}')
R3=$(CJ -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/otp/send" -d '{"phone":"+254799999999","purpose":"signup"}')
R4=$(CJ -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/otp/send" -d '{"phone":"+254799999999","purpose":"signup"}')
check "3 allowed then 429" "$R1$R2$R3$R4" '200200200429'

step "Password reset requires OTP"
PR_REQ=$(CJ -X POST "$BASE/auth/password-reset/request" -d '{"phone":"+254711000001"}')
check "reset request ok" "$PR_REQ" 'If the number is registered'
PR_CODE=$(CJ -X POST "$BASE/auth/otp/send" -d '{"phone":"+254711000001","purpose":"password_reset"}' | jq -r .devCode)
PR_GRANT=$(CJ -X POST "$BASE/auth/otp/verify" -d "{\"phone\":\"+254711000001\",\"code\":\"$PR_CODE\",\"purpose\":\"password_reset\"}" | jq -r .grant)
PR=$(CJ -X POST "$BASE/auth/password-reset/confirm" -d "{\"phone\":\"+254711000001\",\"grant\":\"$PR_GRANT\",\"newPassword\":\"New-S3cure-password!\"}")
check "password reset ok" "$PR" 'Password updated'
LOGIN_NEW=$(CJ -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/login" -d '{"phone":"+254711000001","password":"New-S3cure-password!"}')
check "login with new password" "$LOGIN_NEW" '200'

step "Audit trail populated"
AUDIT=$(docker exec mraru-postgres psql -U mraru -d mraru -t -c "select count(*) from audit_log where chama_id = (select id from chamas where slug='$SLUG')" | tr -d ' ')
check "audit rows exist" "$AUDIT" '[1-9]'

step "RLS verified: cross-tenant visibility"
SECOND=$(CJ -X POST "$BASE/auth/otp/send" -d '{"phone":"+254722000001","purpose":"signup"}' | jq -r .devCode)
SG=$(CJ -X POST "$BASE/auth/otp/verify" -d "{\"phone\":\"+254722000001\",\"code\":\"$SECOND\",\"purpose\":\"signup\"}" | jq -r .grant)
SECOND_CREATE=$(CJ -X POST "$BASE/chamas" -d "{
  \"chama\": { \"name\": \"Second Chama\", \"chamaType\": \"sacco\", \"votingModel\": \"shareholding_weighted\", \"minimumContribution\": \"500\" },
  \"founder\": { \"fullName\": \"Frank Mbugua\", \"nationalId\": \"55556666\", \"phone\": \"+254722000001\" },
  \"otpGrant\": \"$SG\",
  \"password\": \"Another-S3cure-password!\",
  \"constitution\": { \"mode\": \"template\", \"accepted\": true }
}")
ACCESS2B=$(echo "$SECOND_CREATE" | jq -r .tokens.accessToken)
PENDING_OTHER=$(C "$BASE/members/pending" -H "Authorization: Bearer $ACCESS2B")
check "second chama sees empty queue" "$PENDING_OTHER" '"members":[]'
LEAK=$(echo "$PENDING_OTHER" | grep -c 'Brian Otieno' || true)
check "no cross-tenant member leak" "$LEAK" '^0$'

echo
echo "========== RESULT: $PASS passed, $FAIL failed =========="
exit $([ $FAIL -eq 0 ] && echo 0 || echo 1)
