#!/usr/bin/env node
// Grants or revokes the `careTeam` custom claim used by /admin.
// Usage (with Application Default Credentials for the project):
//   node functions/scripts/grant-care-team.mjs nurse@hospital.org          # grant
//   node functions/scripts/grant-care-team.mjs nurse@hospital.org --revoke # revoke
// The person must sign in again for the change to apply. The claim only
// opens the dashboard; each patient's data still needs that patient's invite.
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const [email, flag] = process.argv.slice(2);
if (!email || !email.includes("@")) {
  console.error("Usage: grant-care-team.mjs <email> [--revoke]");
  process.exit(1);
}
initializeApp();
const auth = getAuth();
const user = await auth.getUserByEmail(email.toLowerCase());
const claims = { ...(user.customClaims ?? {}) };
if (flag === "--revoke") delete claims.careTeam;
else claims.careTeam = true;
await auth.setCustomUserClaims(user.uid, claims);
await auth.revokeRefreshTokens(user.uid);
console.log(`${flag === "--revoke" ? "Revoked" : "Granted"} care-team access for ${email}.`);
