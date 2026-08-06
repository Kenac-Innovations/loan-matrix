import assert from "node:assert/strict";
import {
  exportPKCS8,
  generateKeyPair,
  jwtVerify,
} from "jose";
import {
  createSupersetAssertion,
  renderSupersetLaunchForm,
} from "../superset-sso";

async function run() {
  const { privateKey, publicKey } = await generateKeyPair("RS256", {
    modulusLength: 2048,
    extractable: true,
  });
  const privateKeyPem = await exportPKCS8(privateKey);
  const now = new Date("2026-08-06T08:00:00.000Z");
  const input = {
    subject: "84",
    username: "mifos",
    name: "Mifos User",
    email: "mifos@example.com",
    tenantSlug: "goodfellow",
    role: "creator" as const,
  };

  const assertion = await createSupersetAssertion(input, privateKeyPem, now);
  const secondAssertion = await createSupersetAssertion(
    input,
    privateKeyPem,
    now
  );
  const verified = await jwtVerify(assertion, publicKey, {
    issuer: "loan-matrix",
    audience: "loan-matrix-superset",
    currentDate: new Date(now.getTime() + 1_000),
  });
  const secondVerified = await jwtVerify(secondAssertion, publicKey, {
    issuer: "loan-matrix",
    audience: "loan-matrix-superset",
    currentDate: new Date(now.getTime() + 1_000),
  });

  assert.equal(verified.payload.sub, "84");
  assert.equal(verified.payload.username, "mifos");
  assert.equal(verified.payload.name, "Mifos User");
  assert.equal(verified.payload.email, "mifos@example.com");
  assert.equal(verified.payload.tenantSlug, "goodfellow");
  assert.equal(verified.payload.role, "creator");
  assert.equal(verified.payload.exp! - verified.payload.iat!, 60);
  assert.equal(typeof verified.payload.jti, "string");
  assert.notEqual(verified.payload.jti, secondVerified.payload.jti);

  const html = renderSupersetLaunchForm(
    "https://analytics.kenacloanmatrix.com",
    'token-with-"quotes"-&-symbols'
  );
  assert.match(
    html,
    /action="https:\/\/analytics\.kenacloanmatrix\.com\/sso\/consume"/
  );
  assert.match(html, /method="post"/);
  assert.match(html, /name="assertion"/);
  assert.match(html, /token-with-&quot;quotes&quot;-&amp;-symbols/);
  assert.doesNotMatch(html, /consume\?assertion=/);
  assert.match(html, /document\.getElementById\("sso-launch"\)\.submit\(\)/);

  const pathPrefixedHtml = renderSupersetLaunchForm(
    "https://goodfellow.kenac.tech/analytics",
    "signed-token"
  );
  assert.match(
    pathPrefixedHtml,
    /action="https:\/\/goodfellow\.kenac\.tech\/analytics\/sso\/consume"/
  );

  const nonMifosCreatorAssertion = await createSupersetAssertion(
    { ...input, username: "analyst", role: "creator" },
    privateKeyPem,
    now
  );
  const nonMifosVerified = await jwtVerify(
    nonMifosCreatorAssertion,
    publicKey,
    {
      issuer: "loan-matrix",
      audience: "loan-matrix-superset",
      currentDate: new Date(now.getTime() + 1_000),
    }
  );
  assert.equal(nonMifosVerified.payload.role, "viewer");
}

run().then(() => console.log("ok"));
