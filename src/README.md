# Demo: Before & After Stellar Oxide Gateway

This directory contains demonstration servers that show the problems with traditional API monetization and how Stellar Oxide Gateway solves them.

## 🎯 What This Demonstrates

### The Problem (Traditional API)
Traditional APIs have several critical issues:
- ❌ **API Key Management** - Keys can leak, require manual provisioning
- ❌ **Subscription Friction** - Users must commit to monthly plans
- ❌ **Rate Limits** - Users get blocked, can't pay for extra usage
- ❌ **Manual Onboarding** - Agents can't self-onboard
- ❌ **Complex Billing** - Requires payment processors, invoicing, etc.

### The Solution (Stellar Oxide Gateway)
Stellar Oxide Gateway eliminates these problems:
- ✅ **No API Keys** - Pay with blockchain transactions
- ✅ **Pay-Per-Use** - No subscriptions, pay only for what you use
- ✅ **No Rate Limits** - Pay for what you need, when you need it
- ✅ **Agent Self-Onboarding** - Autonomous agents can start using APIs immediately
- ✅ **Zero Billing Infrastructure** - Payments settle on Stellar blockchain

---

## 🚀 Quick Start

### Option 1: Run Side-by-Side Comparison
See both servers running at the same time:

```bash
# From project root
yarn demo:comparison
```

This starts:
- **Traditional API** on `http://localhost:4000`
- **Stellar Oxide Gateway** on `http://localhost:3000`

### Option 2: Run Traditional API Only
See the problems with traditional approach:

```bash
yarn demo:traditional
```

Try it:
```bash
# Will fail - no API key
curl http://localhost:4000/api/search?q=test

# Works but counts against rate limit
curl -H "x-api-key: sk_test_123" http://localhost:4000/api/search?q=test
```

### Option 3: Run Stellar Oxide Gateway Only
See the solution in action:

```bash
yarn demo:stellar
```

Try it:
```bash
# Set up your wallet first
yarn cli setup

# Make a paid request (pays with Stellar)
yarn cli ai --query "test"

# Check your usage stats
curl http://localhost:3000/stats
```

---

## 📊 Comparison Table

| Feature | Traditional API | Stellar Oxide Gateway |
|---------|----------------|----------------------|
| **Authentication** | API keys (can leak) | Blockchain signatures |
| **Onboarding** | Manual signup | Instant, autonomous |
| **Billing** | Subscriptions | Pay-per-use |
| **Rate Limits** | Hard limits | Pay for what you need |
| **Agent Access** | Requires human setup | Self-service |
| **Payment Rails** | Credit cards, invoices | Stellar blockchain |
| **Settlement** | Monthly billing cycles | Instant on-chain |
| **Billing Infrastructure** | Complex (Stripe, etc.) | None needed |

---

## 🎬 Demo Scenarios

### Scenario 1: Traditional API Problems

**Problem: API Key Required**
```bash
curl http://localhost:4000/api/search?q=test
# Response: {"error": "Missing API key", "message": "Please sign up..."}
```

**Problem: Rate Limits**
```bash
# Make 100+ requests with the same key
for i in {1..101}; do
  curl -H "x-api-key: sk_test_123" http://localhost:4000/api/search?q=test$i
done
# After 100 requests: {"error": "Rate limit exceeded", "message": "Upgrade your plan..."}
```

**Problem: Subscription Friction**
- User wants to make 1 request
- Must sign up for monthly plan
- Pays for 100 requests even if only using 1

### Scenario 2: Stellar Oxide Gateway Solution

**Solution: No API Key Needed**
```bash
# First request returns 402 with payment requirements
curl http://localhost:3000/api/search?q=test
# Response includes payment requirements in machine-readable format
```

**Solution: Pay-Per-Use**
```bash
# Set up wallet once
yarn cli setup

# Pay for exactly what you use
yarn cli ai --query "test"
# Pays 0.02 USD in XLM, gets instant access

# Check your spending
curl http://localhost:3000/stats
# Shows total requests and revenue
```

**Solution: No Rate Limits**
```bash
# Make as many requests as you want
# Each request requires payment, but no artificial limits
yarn cli ai --query "request 1"
yarn cli ai --query "request 2"
yarn cli ai --query "request 3"
# Each pays separately, no rate limit errors
```

---

## 🔍 Detailed Walkthrough

### Traditional API Flow

1. **User wants to use API**
   - Must visit website
   - Fill out signup form
   - Verify email
   - Add payment method
   - Choose subscription plan

2. **Get API key**
   - Receive API key via email or dashboard
   - Store securely (but can still leak)
   - Add to all requests

3. **Make requests**
   - Include API key in headers
   - Count against rate limit
   - Get blocked when limit reached

4. **Billing**
   - Charged monthly regardless of usage
   - Must upgrade plan for more requests
   - Complex invoicing and payment processing

### Stellar Oxide Gateway Flow

1. **Agent wants to use API**
   - No signup needed
   - No email verification
   - No payment method setup

2. **Make request**
   - Call endpoint directly
   - Receive 402 with payment requirements
   - Sign Stellar transaction
   - Retry with payment proof

3. **Instant access**
   - Payment verified on-chain
   - Request processed immediately
   - Structured receipt returned

4. **Billing**
   - Pay only for what you use
   - Instant settlement on Stellar
   - No monthly charges
   - No invoicing needed

---

## 🎯 Use Cases Demonstrated

### 1. Search API
**Traditional:**
- Requires API key
- 100 searches/month on free plan
- $29/month for 1000 searches

**Stellar Oxide Gateway:**
- $0.02 per search
- Pay only for searches you make
- No monthly commitment

### 2. AI Inference
**Traditional:**
- Subscription required
- Fixed token limits per month
- Unused tokens wasted

**Stellar Oxide Gateway:**
- $0.10 per 1000 tokens
- Pay for exact tokens used
- Dynamic pricing based on prompt length

### 3. Market Data
**Traditional:**
- Monthly subscription
- Rate limited
- Must upgrade for more requests

**Stellar Oxide Gateway:**
- $0.05 per query
- No rate limits
- Pay as you go

### 4. Web Scraping
**Traditional:**
- Tiered pricing plans
- Unused credits expire
- Complex billing

**Stellar Oxide Gateway:**
- $0.03 per page
- Pay per page scraped
- Perfect for one-time jobs

---

## 🧪 Testing the Demo

### Test Traditional API Problems

```bash
# Start traditional API
yarn demo:traditional

# Test 1: No API key
curl http://localhost:4000/api/search?q=test
# Expected: 401 Unauthorized

# Test 2: Valid API key
curl -H "x-api-key: sk_test_123" http://localhost:4000/api/search?q=test
# Expected: Success, but counts against limit

# Test 3: Hit rate limit
for i in {1..101}; do
  curl -H "x-api-key: sk_test_123" http://localhost:4000/api/search?q=test$i
done
# Expected: 429 Rate Limit Exceeded after 100 requests
```

### Test Stellar Oxide Gateway Solution

```bash
# Start Stellar Oxide Gateway
yarn demo:stellar

# Test 1: Get payment requirements
curl http://localhost:3000/api/search?q=test
# Expected: 402 with payment requirements

# Test 2: Make paid request
yarn cli setup  # One-time setup
yarn cli ai --query "test"
# Expected: Success with payment receipt

# Test 3: Check stats
curl http://localhost:3000/stats
# Expected: Request count and revenue

# Test 4: No rate limits
yarn cli ai --query "request 1"
yarn cli ai --query "request 2"
yarn cli ai --query "request 3"
# Expected: All succeed, each with separate payment
```

---

## 📚 What You'll Learn

By running these demos, you'll understand:

1. **Why traditional API monetization is broken**
   - API key management overhead
   - Subscription friction
   - Rate limiting problems
   - Manual onboarding barriers

2. **How Stellar Oxide Gateway solves these problems**
   - Blockchain-based authentication
   - Pay-per-use pricing
   - Agent self-onboarding
   - Instant settlement

3. **How to integrate Stellar Oxide Gateway**
   - Declarative route definitions
   - Dynamic pricing policies
   - Storage configuration
   - Discovery endpoints

4. **Real-world use cases**
   - AI inference APIs
   - Search services
   - Market data feeds
   - Web scraping services

---

## 🎓 Next Steps

After running the demos:

1. **Read the main README** - Learn about all features
2. **Check the examples** - See more integration patterns
3. **Run the tests** - Verify everything works
4. **Deploy your own** - Start monetizing your APIs

---

## 🤝 Contributing

Found a bug or have a suggestion? Open an issue or PR!

---

## 📄 License

MIT License - See LICENSE file for details
