# Stripe Removal - Cleanup Plan

This document outlines all files and code that should be removed or updated to completely remove Stripe dependencies.

---

## 🗑️ Files to DELETE

### 1. Stripe Webhook Route
**File:** `app/api/webhooks/stripe/route.js`
**Reason:** No longer needed - MockPay creates payment/enrollment synchronously
**Action:** DELETE

### 2. Stripe Server Actions (Optional)
**File:** `app/actions/stripe.js`
**Reason:** Replaced by MockPay checkout flow
**Action:** DELETE (or keep for reference, but it's not used anymore)

---

## 📝 Files to UPDATE

### 1. Environment Variables
**File:** `.env.example` or `.env.local.example`
**Remove:**
```
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
```
**Action:** Remove these lines

### 2. Package.json (Optional)
**File:** `package.json`
**Remove (if not used elsewhere):**
```json
"stripe": "^x.x.x"
```
**Action:** Run `npm uninstall stripe` if not needed elsewhere

---

## 🔍 Code References to CHECK

### Files that might import Stripe (search and verify):

1. **Check for Stripe imports:**
   ```bash
   # Search for Stripe usage
   grep -r "stripe" --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" app/ components/ lib/
   ```

2. **Common Stripe-related files to check:**
   - `lib/stripe.js` - Stripe client initialization (DELETE if exists)
   - `lib/stripe-helpers.js` - Stripe helper functions (DELETE if exists and not used)
   - Any files importing from `@/lib/stripe` or `@/lib/stripe-helpers`

3. **Components that might reference Stripe:**
   - Check any payment-related components
   - Check admin payment pages
   - Check dashboard payment views

---

## ✅ Files Already UPDATED (No Action Needed)

The following files have already been updated to work with MockPay:

1. ✅ `model/payment-model.js` - Added `referenceId`, `mockpay` provider
2. ✅ `model/enrollment-model.js` - Added `mockpay` method
3. ✅ `queries/payments.js` - Added `getPaymentByReferenceId`
4. ✅ `queries/enrollments.js` - Optimized `hasEnrollmentForCourse`
5. ✅ `components/enroll-course.jsx` - Updated to redirect to MockPay checkout
6. ✅ `app/(main)/checkout/mock/page.jsx` - New MockPay checkout page
7. ✅ `app/(main)/checkout/mock/_components/checkout-form.jsx` - Checkout form
8. ✅ `app/api/payments/mock/confirm/route.js` - Payment confirmation API
9. ✅ `app/(main)/enroll-success/page.jsx` - Updated for MockPay

---

## 🔄 Optional: Keep Stripe Code for Reference

If you want to keep Stripe code for reference (not recommended for production):

1. Move to `_archive/` or `_old/` directory:
   ```
   _archive/stripe/
     - app/actions/stripe.js
     - app/api/webhooks/stripe/route.js
   ```

2. Or add comments marking as deprecated:
   ```javascript
   // @deprecated - Replaced by MockPay
   // This file is kept for reference only
   ```

---

## 📋 Verification Checklist

After cleanup, verify:

- [ ] No Stripe imports in codebase (except optional archived files)
- [ ] No references to `STRIPE_*` environment variables in code
- [ ] No calls to Stripe API endpoints
- [ ] `npm run build` succeeds without Stripe errors
- [ ] All payment flows use MockPay
- [ ] Success page works without Stripe
- [ ] No broken imports or missing dependencies

---

## 🧹 Cleanup Commands

```bash
# 1. Delete Stripe files
rm -rf app/api/webhooks/stripe
rm app/actions/stripe.js  # If exists

# 2. Remove Stripe package (optional)
npm uninstall stripe

# 3. Search for remaining Stripe references
grep -r "stripe" --include="*.js" --include="*.jsx" app/ components/ lib/

# 4. Update .env.example
# Manually remove STRIPE_* variables

# 5. Test build
npm run build
```

---

## ⚠️ Important Notes

1. **Database Migration:** Existing Stripe payments in database will remain. The system supports both `stripe` and `mockpay` providers, so old payments won't break.

2. **Backward Compatibility:** The code maintains backward compatibility:
   - `getPaymentBySessionId()` still exists (for old Stripe payments)
   - Payment model supports both `sessionId` (Stripe) and `referenceId` (MockPay)
   - Success page can handle both `sessionId` and `referenceId` parameters

3. **Status Endpoint:** The `/api/payments/status` route currently supports Stripe's `session_id`. If you want to remove it completely, you can delete `app/api/payments/status/route.js`. However, the success page doesn't use it anymore for MockPay (since MockPay is synchronous).

---

## 🎯 Summary

**Required Actions:**
1. Delete `app/api/webhooks/stripe/route.js`
2. Delete `app/actions/stripe.js` (optional)
3. Remove Stripe env vars from `.env.example`
4. Run `npm uninstall stripe` (optional)

**Already Complete:**
- All payment flows updated to MockPay
- Queries updated for MockPay
- Success page works without Stripe
- Models support MockPay provider

**Result:**
- Clean codebase with no Stripe dependencies
- MockPay system fully functional
- Backward compatible with existing Stripe payment records

