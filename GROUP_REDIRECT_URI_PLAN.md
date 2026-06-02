# Payment Redirect Handling — Frontend Plan

How the frontend should handle the return from Flutterwave for **both** individual and group payments.

## The problem

After payment, Flutterwave redirects the browser to your configured redirect URL (e.g. `https://app.example.com/payment/verify`) and **appends its own query params**: `tx_ref`, `transaction_id`, `status`. Right now the verify page treats everything as an individual payment and ends up on the payer's dashboard — wrong for group payments, where it should land on the group's status page.

## The fix (backend already does this)

For a **group** payment, the backend now builds the redirect URL with two extra params **before** handing it to Flutterwave:

```
type=group
groupId=<the group's id>
```

So the full URL the browser lands on looks like:

```
https://app.example.com/payment/verify?type=group&groupId=665f...&tx_ref=FYW-abc123&transaction_id=987654&status=successful
```

For an **individual** payment there is no `type` / `groupId` — only Flutterwave's params:

```
https://app.example.com/payment/verify?tx_ref=FYW-xyz789&transaction_id=987654&status=successful
```

> Param order isn't guaranteed — always read by name, never by position.

## What the `/payment/verify` page should do

1. **Read the query params:** `tx_ref` (the reference), `status`, and the optional `type` / `groupId`.

2. **Verify the transaction** (same endpoint for both kinds):
   ```
   GET /api/payments/verify?reference=<tx_ref>
   ```
   This confirms the payment and applies it server-side (to the student for individual, to the group for group). Safe to call once; re-calling the same reference is a no-op.

3. **Route based on `type`:**
   - `type === "group"` → go to the **group status page** using `groupId`, e.g. `/group/:groupId`, then fetch `GET /api/group/:groupId` to render progress, per-member balances, and invites.
   - otherwise → existing individual behaviour (student dashboard / receipt).

### Pseudocode

```ts
const params = new URLSearchParams(window.location.search);
const reference = params.get("tx_ref");
const type = params.get("type");
const groupId = params.get("groupId");

if (!reference) {
  // No reference — show a generic "payment status unknown" / retry screen.
  return;
}

await api.get(`/api/payments/verify?reference=${reference}`); // verify + apply

if (type === "group" && groupId) {
  router.replace(`/group/${groupId}`);   // group status page → GET /api/group/:groupId
} else {
  router.replace(`/dashboard`);          // individual flow, unchanged
}
```

## Notes & edge cases

- **Don't rely on `status` from the URL alone** — it's a hint. The source of truth is the `GET /api/payments/verify` response (and the group/student status fetch after it). A user can land here with `status=cancelled`/`failed`; in that case skip the success UI and offer "try again".
- **`groupId` should come from the URL**, but you can also fall back to the `groupId` you stashed in `localStorage` at registration time if the param is missing for any reason.
- **Persist nothing sensitive** — `tx_ref` and `groupId` are fine to read from the URL.
- If `type=group` but `groupId` is somehow missing, fall back to the `localStorage` groupId; if that's also absent, send the user to a "look up your group" screen rather than the individual dashboard.
- The redirect base URL itself is set server-side via `FLUTTERWAVE_REDIRECT_URL` (or `FRONTEND_URL` + `/payment/verify`). The frontend only needs to handle whatever path that points to — make sure that route exists and runs the logic above.

## Summary

| Param | Individual payment | Group payment |
| --- | --- | --- |
| `tx_ref` | ✅ (verify with this) | ✅ (verify with this) |
| `transaction_id` | ✅ | ✅ |
| `status` | ✅ (hint only) | ✅ (hint only) |
| `type` | — | `group` |
| `groupId` | — | the group id to route to |

One verify call for both; branch on `type` to decide where to send the user afterward.
