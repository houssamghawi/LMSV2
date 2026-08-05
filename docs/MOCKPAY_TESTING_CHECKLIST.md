# MockPay Implementation - Testing Checklist

## ✅ Implementation Complete

All required files have been created/modified for the mock payment system.

---

## 📋 Files Modified/Created

### Created Files:
1. ✅ `app/(main)/checkout/mock/page.jsx` - Checkout page
2. ✅ `app/(main)/checkout/mock/_components/checkout-form.jsx` - Checkout form component
3. ✅ `app/api/payments/mock/confirm/route.js` - Payment confirmation API

### Modified Files:
1. ✅ `model/payment-model.js` - Added `referenceId` field and `mockpay` provider
2. ✅ `model/enrollment-model.js` - Added `mockpay` to method enum
3. ✅ `components/enroll-course.jsx` - Updated to redirect to mock checkout
4. ✅ `app/(main)/enroll-success/page.jsx` - Updated to work with mock payments

### Files to Remove (Optional):
- `app/api/webhooks/stripe/route.js` - No longer needed
- `app/actions/stripe.js` - Can be removed or kept for reference

---

## 🧪 Testing Checklist

### 1. Successful Mock Payment Creates Payment + Enrollment

**Test Steps:**
1. Log in to the application
2. Navigate to a paid course
3. Click "Enroll Now" button
4. Should redirect to `/checkout/mock?courseId=...`
5. Verify checkout page shows:
   - Course title and price
   - User information
   - "Pay Now (Simulated)" button
6. Click "Pay Now (Simulated)"
7. Should redirect to `/enroll-success?referenceId=mock_...&courseId=...`
8. Verify success page shows:
   - Green checkmark
   - "Congratulations! Your Enrollment was Successful"
   - "Start Learning" button

**Database Verification:**
```javascript
// Check Payment exists
db.payments.findOne({ referenceId: "mock_..." })

// Expected:
// - provider: "mockpay"
// - status: "succeeded"
// - amount: [course price]
// - user: ObjectId
// - course: ObjectId
// - referenceId: "mock_..."

// Check Enrollment exists
db.enrollments.findOne({ 
  student: [userId from payment], 
  course: [courseId from payment] 
})

// Expected:
// - method: "mockpay"
// - student: ObjectId (matches payment.user)
// - course: ObjectId (matches payment.course)
// - payment: ObjectId (references Payment._id)
// - status: "not-started"
```

**✅ Pass Criteria:**
- Payment record created with `provider: "mockpay"` and `status: "succeeded"`
- Enrollment record created with `method: "mockpay"`
- Success page displays correctly
- User can click "Start Learning" and access course

---

### 2. Failure Simulation Shows Error and No Enrollment

**Test Steps:**
1. Navigate to checkout page for a paid course
2. Check the "Simulate payment failure" checkbox
3. Click "Pay Now (Simulated)"
4. Should show error message: "Payment simulation failed (as requested)"
5. Should NOT redirect to success page
6. Should NOT create Payment or Enrollment records

**Database Verification:**
```javascript
// Verify NO payment was created
db.payments.find({ referenceId: /^mock_/ }).sort({ createdAt: -1 }).limit(1)
// Should return null or old payment (not from this test)

// Verify NO enrollment was created
db.enrollments.find({ method: "mockpay" }).sort({ enrollment_date: -1 }).limit(1)
// Should return null or old enrollment (not from this test)
```

**✅ Pass Criteria:**
- Error message displayed
- No Payment record created
- No Enrollment record created
- User stays on checkout page
- Can retry payment (uncheck failure checkbox)

---

### 3. Repeat Clicks Don't Duplicate Records

**Test Steps:**
1. Complete a successful payment (follow Test 1)
2. Note the `referenceId` from success page URL
3. Navigate back to the same course
4. Click "Enroll Now" again
5. Should either:
   - Redirect directly to course (if already enrolled check works)
   - OR show checkout page but payment should be idempotent

**Idempotency Test:**
1. Click "Pay Now (Simulated)" multiple times rapidly
2. Check database for duplicate payments

**Database Verification:**
```javascript
// Check for duplicate payments (same user + course + provider)
db.payments.find({ 
  user: ObjectId("..."),
  course: ObjectId("..."),
  provider: "mockpay"
})

// Should return only ONE payment record

// Check for duplicate enrollments
db.enrollments.find({ 
  student: ObjectId("..."),
  course: ObjectId("...")
})

// Should return only ONE enrollment record
```

**✅ Pass Criteria:**
- Only ONE Payment record per (user, course, provider)
- Only ONE Enrollment record per (student, course)
- No duplicate key errors in logs
- Subsequent payment attempts reuse existing payment/enrollment

---

### 4. Authentication & Authorization

**Test Steps:**
1. Log out
2. Try to access `/checkout/mock?courseId=...`
3. Should redirect to login page
4. After login, try to access `/enroll-success?referenceId=mock_...&courseId=...`
5. Should verify payment belongs to logged-in user

**✅ Pass Criteria:**
- Unauthenticated users redirected to login
- Users cannot access other users' payment success pages
- Payment verification checks user ownership

---

### 5. Edge Cases

#### Free Course
1. Navigate to a free course (price = 0)
2. Click "Enroll Now"
3. Should NOT redirect to checkout
4. Should enroll directly (existing free enrollment flow)

**✅ Pass Criteria:** Free courses bypass checkout

#### Already Enrolled
1. Enroll in a course (successful payment)
2. Navigate to same course again
3. Click "Enroll Now"
4. Should redirect to course page (not checkout)

**✅ Pass Criteria:** Already enrolled users cannot purchase again

#### Invalid Course ID
1. Navigate to `/checkout/mock?courseId=invalid`
2. Should show "Course Not Found" error

**✅ Pass Criteria:** Invalid course IDs handled gracefully

#### Missing Query Parameters
1. Navigate to `/checkout/mock` (no courseId)
2. Should show "Invalid Request" error

**✅ Pass Criteria:** Missing parameters handled gracefully

---

## 🔍 Manual Verification Steps

### Check Model Updates

1. **Payment Model:**
   ```javascript
   // In MongoDB or Mongoose
   const Payment = require('./model/payment-model');
   // Check schema includes:
   // - referenceId (String, unique, sparse)
   // - provider enum includes 'mockpay'
   ```

2. **Enrollment Model:**
   ```javascript
   const Enrollment = require('./model/enrollment-model');
   // Check schema includes:
   // - method enum includes 'mockpay'
   ```

### Check Route Accessibility

1. Visit `/checkout/mock?courseId=[valid-course-id]` - Should load checkout page
2. Visit `/api/payments/mock/confirm` - Should return 405 Method Not Allowed for GET
3. Visit `/enroll-success?referenceId=mock_test123&courseId=[valid-id]` - Should load success page

---

## 🐛 Common Issues & Debugging

### Issue: Payment created but enrollment missing

**Symptoms:**
- Payment record exists in DB
- Enrollment record missing
- Success page shows "Setting Up Enrollment"

**Debug:**
1. Check server logs for enrollment creation errors
2. Verify Enrollment.create() was called
3. Check for duplicate key errors (enrollment might already exist)

**Solution:**
- Check enrollment creation error logs
- Verify Payment._id is valid ObjectId
- Check Enrollment model has 'mockpay' in method enum

---

### Issue: Duplicate payments created

**Symptoms:**
- Multiple Payment records for same user/course/provider
- Database errors about duplicates

**Debug:**
1. Check idempotency logic in `/api/payments/mock/confirm`
2. Verify unique index on referenceId exists
3. Check for race conditions (rapid clicks)

**Solution:**
- Ensure idempotency check queries existing payment before creating
- Verify Payment model has correct indexes
- Test with rapid clicks to catch race conditions

---

### Issue: Checkout page shows error

**Symptoms:**
- Checkout page doesn't load
- Shows "Course Not Found" or other error

**Debug:**
1. Verify courseId is valid ObjectId
2. Check course exists in database
3. Verify user is authenticated
4. Check course.active is true

**Solution:**
- Ensure courseId format is correct
- Verify course exists and is active
- Check authentication is working

---

## 📊 Summary

After completing all tests:

✅ Mock payment system should:
- Create Payment records with provider="mockpay"
- Create Enrollment records with method="mockpay"
- Handle payment failures gracefully
- Prevent duplicate records (idempotent)
- Work with authentication/authorization
- Handle edge cases (free courses, already enrolled, invalid IDs)

❌ Mock payment system should NOT:
- Require Stripe API calls
- Require webhook endpoints
- Create duplicate payments/enrollments
- Allow unauthorized access
- Break existing free enrollment flow

---

## 🚀 Next Steps (Optional Cleanup)

1. **Remove Stripe dependencies:**
   - Delete `app/api/webhooks/stripe/route.js`
   - Optionally delete `app/actions/stripe.js` (or keep for reference)
   - Remove Stripe environment variables from `.env.example`
   - Update documentation to remove Stripe setup instructions

2. **Update environment variables:**
   - Remove `STRIPE_SECRET_KEY`
   - Remove `STRIPE_PUBLISHABLE_KEY`
   - Remove `STRIPE_WEBHOOK_SECRET`

3. **Update package.json:**
   - Optionally remove `stripe` package dependency (if not used elsewhere)

4. **Update documentation:**
   - Update README to reflect mock payment system
   - Remove Stripe setup instructions
   - Add mock payment testing instructions

