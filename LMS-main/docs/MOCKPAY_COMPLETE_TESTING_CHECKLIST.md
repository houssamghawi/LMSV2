# MockPay - Complete Testing Checklist

Comprehensive testing guide for the MockPay payment system integration.

---

## ✅ Pre-Testing Setup

1. **Environment:**
   - [ ] MongoDB connection working
   - [ ] Next.js dev server running
   - [ ] User account created and logged in
   - [ ] At least one paid course exists (price > 0)
   - [ ] At least one free course exists (price = 0)

2. **Database:**
   - [ ] Payment model has `referenceId` field and indexes
   - [ ] Enrollment model has `mockpay` in method enum
   - [ ] Unique indexes exist on Payment.referenceId
   - [ ] Unique index exists on Enrollment (student, course)

---

## 🧪 Test Suite 1: Successful Mock Payment Flow

### Test 1.1: Complete Payment Flow
**Steps:**
1. Navigate to a paid course page
2. Click "Enroll Now" button
3. Verify redirect to `/checkout/mock?courseId=...`
4. Verify checkout page shows:
   - Course title and price
   - User information
   - "Pay Now (Simulated)" button
5. Click "Pay Now (Simulated)" button
6. Verify redirect to `/enroll-success?referenceId=mock_...&courseId=...`
7. Verify success page shows:
   - Green checkmark icon
   - "Congratulations! Your Enrollment was Successful"
   - "Start Learning" button

**Database Verification:**
```javascript
// 1. Check Payment record
const payment = db.payments.findOne({ referenceId: /^mock_/ }).sort({ createdAt: -1 });

// Verify:
// - provider: "mockpay" ✅
// - status: "succeeded" ✅
// - referenceId: starts with "mock_" ✅
// - amount: matches course price ✅
// - user: ObjectId (valid) ✅
// - course: ObjectId (valid) ✅
// - paidAt: Date (not null) ✅

// 2. Check Enrollment record
const enrollment = db.enrollments.findOne({
  student: payment.user,
  course: payment.course
});

// Verify:
// - method: "mockpay" ✅
// - student: matches payment.user ✅
// - course: matches payment.course ✅
// - payment: references payment._id ✅
// - status: "not-started" ✅
```

**✅ Pass Criteria:**
- Payment record created correctly
- Enrollment record created correctly
- Success page displays correctly
- User can click "Start Learning" and access course
- No errors in browser console
- No errors in server logs

---

### Test 1.2: Course Access After Payment
**Steps:**
1. Complete a successful payment (Test 1.1)
2. Click "Start Learning" button
3. Verify redirect to course lesson page
4. Verify course content is accessible
5. Navigate back to course page
6. Verify "Enroll Now" button is replaced with "Access Course" or similar

**✅ Pass Criteria:**
- Course content accessible immediately after payment
- Enrollment status correctly reflects in UI
- No access errors

---

## 🧪 Test Suite 2: Failure Simulation

### Test 2.1: Payment Failure (Simulated)
**Steps:**
1. Navigate to checkout page for a paid course
2. Check the "Simulate payment failure" checkbox
3. Click "Pay Now (Simulated)" button
4. Verify error message appears: "Payment simulation failed (as requested)"
5. Verify page stays on checkout (no redirect)
6. Verify no Payment record created
7. Verify no Enrollment record created

**Database Verification:**
```javascript
// Verify NO new payment was created
const recentPayments = db.payments.find({ 
  createdAt: { $gte: new Date(Date.now() - 60000) } // Last minute
}).sort({ createdAt: -1 });

// Should NOT contain a payment with status "succeeded" for this test ✅

// Verify NO new enrollment was created
const recentEnrollments = db.enrollments.find({
  enrollment_date: { $gte: new Date(Date.now() - 60000) }
}).sort({ enrollment_date: -1 });

// Should NOT contain a new enrollment for this test ✅
```

**✅ Pass Criteria:**
- Error message displayed correctly
- No Payment record created
- No Enrollment record created
- User remains on checkout page
- Can retry payment (uncheck failure, click Pay Now again)

---

### Test 2.2: Retry After Failure
**Steps:**
1. Follow Test 2.1 (simulate failure)
2. Uncheck "Simulate payment failure" checkbox
3. Click "Pay Now (Simulated)" again
4. Verify payment succeeds
5. Verify Payment and Enrollment records created
6. Verify redirect to success page

**✅ Pass Criteria:**
- Retry works correctly
- Payment succeeds on retry
- Records created correctly

---

## 🧪 Test Suite 3: Idempotency & Duplicate Prevention

### Test 3.1: Multiple Rapid Clicks
**Steps:**
1. Navigate to checkout page
2. Rapidly click "Pay Now (Simulated)" button 3-5 times
3. Verify only ONE Payment record created
4. Verify only ONE Enrollment record created
5. Verify no duplicate key errors in logs

**Database Verification:**
```javascript
// Find all payments for this user/course
const payments = db.payments.find({
  user: ObjectId("USER_ID"),
  course: ObjectId("COURSE_ID"),
  provider: "mockpay"
});

// Should return exactly ONE payment ✅

// Find all enrollments for this user/course
const enrollments = db.enrollments.find({
  student: ObjectId("USER_ID"),
  course: ObjectId("COURSE_ID")
});

// Should return exactly ONE enrollment ✅
```

**✅ Pass Criteria:**
- Only one Payment record per (user, course, provider)
- Only one Enrollment record per (student, course)
- No duplicate key errors
- Success page shows correctly

---

### Test 3.2: Already Enrolled User
**Steps:**
1. Complete a successful payment (enroll in course)
2. Navigate to the same course page again
3. Verify "Enroll Now" button behavior:
   - Should redirect to course page (if already enrolled check works)
   - OR should show checkout but prevent duplicate enrollment
4. If checkout page loads, click "Pay Now"
5. Verify idempotency: no duplicate enrollment created

**Database Verification:**
```javascript
// Verify still only ONE enrollment
const enrollments = db.enrollments.find({
  student: ObjectId("USER_ID"),
  course: ObjectId("COURSE_ID")
});

// Should return exactly ONE enrollment ✅
```

**✅ Pass Criteria:**
- Duplicate enrollment prevented
- User not charged twice (if applicable)
- System handles already-enrolled state correctly

---

## 🧪 Test Suite 4: Edge Cases & Error Handling

### Test 4.1: Free Course (Should Bypass Checkout)
**Steps:**
1. Navigate to a free course (price = 0)
2. Click "Enroll Now" or "Enroll Free"
3. Verify NO redirect to checkout
4. Verify direct enrollment (existing free enrollment flow)
5. Verify Enrollment created with `method: "free"`

**✅ Pass Criteria:**
- Free courses bypass checkout
- Free enrollment works as before
- No MockPay payment created for free courses

---

### Test 4.2: Invalid Course ID
**Steps:**
1. Navigate to `/checkout/mock?courseId=invalid123`
2. Verify "Course Not Found" error shown
3. Verify no payment attempted

**✅ Pass Criteria:**
- Invalid course IDs handled gracefully
- Error message displayed
- No database records created

---

### Test 4.3: Missing Course ID
**Steps:**
1. Navigate to `/checkout/mock` (no courseId parameter)
2. Verify "Invalid Request" error shown
3. Verify user can navigate back

**✅ Pass Criteria:**
- Missing parameters handled
- Error message clear
- User can recover

---

### Test 4.4: Unauthenticated Access
**Steps:**
1. Log out
2. Try to access `/checkout/mock?courseId=...`
3. Verify redirect to login page
4. After login, verify redirect back to checkout

**✅ Pass Criteria:**
- Authentication required
- Redirect to login works
- Return to checkout after login works

---

### Test 4.5: Success Page - Invalid Reference ID
**Steps:**
1. Navigate to `/enroll-success?referenceId=invalid_ref&courseId=...`
2. Verify "Payment Not Found" message
3. Verify user can navigate to courses

**✅ Pass Criteria:**
- Invalid reference IDs handled
- Clear error message
- User can navigate away

---

### Test 4.6: Success Page - Missing Parameters
**Steps:**
1. Navigate to `/enroll-success` (no parameters)
2. Verify "Invalid Request" error
3. Verify user can navigate to courses

**✅ Pass Criteria:**
- Missing parameters handled
- Error message displayed
- User can recover

---

## 🧪 Test Suite 5: Query Performance & Optimization

### Test 5.1: Enrollment Check Performance
**Steps:**
1. Monitor server logs during enrollment checks
2. Verify `hasEnrollmentForCourse()` uses `Enrollment.exists()` (fast)
3. Verify no slow populate queries for existence checks

**✅ Pass Criteria:**
- Enrollment checks are fast (< 100ms)
- No unnecessary populate queries
- Uses `exists()` instead of `findOne()` for existence checks

---

### Test 5.2: Payment Lookup Performance
**Steps:**
1. Complete a payment
2. Access success page
3. Monitor query performance
4. Verify payment lookup is fast

**✅ Pass Criteria:**
- Payment lookups are fast
- Indexes used correctly
- No full collection scans

---

## 🧪 Test Suite 6: UI/UX Flow

### Test 6.1: Complete User Journey
**Steps:**
1. User browses courses
2. User clicks on a paid course
3. User clicks "Enroll Now"
4. User sees checkout page
5. User clicks "Pay Now (Simulated)"
6. User sees success page
7. User clicks "Start Learning"
8. User accesses course content

**✅ Pass Criteria:**
- Smooth flow from browse → checkout → payment → success → course
- No broken links or missing pages
- Loading states work correctly
- Error states handled gracefully

---

### Test 6.2: Mobile Responsiveness
**Steps:**
1. Test checkout page on mobile device/emulator
2. Test success page on mobile
3. Verify all buttons accessible
4. Verify text readable
5. Verify forms usable

**✅ Pass Criteria:**
- Mobile-friendly layout
- Touch targets appropriate size
- Text readable
- Forms usable on mobile

---

## 📊 Performance Benchmarks

Record these metrics:

- Payment creation: < 500ms
- Enrollment creation: < 300ms
- Success page load: < 1s
- Checkout page load: < 800ms
- Database queries: < 100ms each

---

## 🐛 Common Issues & Solutions

### Issue: Payment created but enrollment missing
**Solution:** Check server logs for enrollment creation errors. Verify Payment._id is valid.

### Issue: Duplicate payments
**Solution:** Verify idempotency check in `/api/payments/mock/confirm` queries existing payment.

### Issue: Success page stuck on "Processing"
**Solution:** Verify payment record exists in DB. Check referenceId format. Verify ObjectId conversion.

### Issue: "Course Not Found" on checkout
**Solution:** Verify courseId is valid ObjectId. Check course exists and is active.

---

## ✅ Final Verification

After all tests pass:

- [ ] All test suites completed
- [ ] No errors in browser console
- [ ] No errors in server logs
- [ ] Database records consistent
- [ ] All edge cases handled
- [ ] Performance acceptable
- [ ] UI/UX smooth
- [ ] Mobile responsive

---

## 📝 Test Results Template

```
Date: ___________
Tester: ___________

Test Suite 1: Successful Payment Flow
- Test 1.1: ✅ PASS / ❌ FAIL (Notes: __________)
- Test 1.2: ✅ PASS / ❌ FAIL (Notes: __________)

Test Suite 2: Failure Simulation
- Test 2.1: ✅ PASS / ❌ FAIL (Notes: __________)
- Test 2.2: ✅ PASS / ❌ FAIL (Notes: __________)

Test Suite 3: Idempotency
- Test 3.1: ✅ PASS / ❌ FAIL (Notes: __________)
- Test 3.2: ✅ PASS / ❌ FAIL (Notes: __________)

Test Suite 4: Edge Cases
- Test 4.1: ✅ PASS / ❌ FAIL (Notes: __________)
- Test 4.2: ✅ PASS / ❌ FAIL (Notes: __________)
- Test 4.3: ✅ PASS / ❌ FAIL (Notes: __________)
- Test 4.4: ✅ PASS / ❌ FAIL (Notes: __________)
- Test 4.5: ✅ PASS / ❌ FAIL (Notes: __________)
- Test 4.6: ✅ PASS / ❌ FAIL (Notes: __________)

Test Suite 5: Performance
- Test 5.1: ✅ PASS / ❌ FAIL (Notes: __________)
- Test 5.2: ✅ PASS / ❌ FAIL (Notes: __________)

Test Suite 6: UI/UX
- Test 6.1: ✅ PASS / ❌ FAIL (Notes: __________)
- Test 6.2: ✅ PASS / ❌ FAIL (Notes: __________)

Overall Status: ✅ PASS / ❌ FAIL
Notes: ___________
```

