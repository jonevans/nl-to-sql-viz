# Test Queries for Data Summarization Feature

Test these queries to verify the intelligent data summarization is working properly.

## 🎯 Purpose
These queries are designed to return large result sets (>50 rows) that would previously hit LLM context window limits. The new summarization feature should handle them gracefully.

---

## Test 1: Large Product List (Should Trigger Summarization)

**Query:** "Show me all products we sold in Michigan"

**Expected Behavior:**
- Returns 200+ rows
- ✅ Summarization kicks in (threshold: 50 rows)
- LLM receives:
  - Total row count
  - Category breakdown (FASTENERS: 85, CLEANING: 65, etc.)
  - Top products by sales
  - Price ranges
  - 5 sample rows
- Response should mention categories and insights

**Test Result:** _[Fill in after testing]_

---

## Test 2: Customer Analysis (Large Dataset)

**Query:** "What products didn't customer 19520 purchase that other customers bought in March 2023?"

**Expected Behavior:**
- Returns 100-200 rows
- ✅ Summarization applied
- LLM receives category distribution, top products
- Response should identify product categories they're missing
- Should provide business insight (e.g., "primarily FASTENERS category")

**Test Result:** _[Fill in after testing]_

---

## Test 3: Follow-up Question (Context Retention)

**Query 1:** "Show me all products sold in Florida"
**Query 2:** "How many of those were sold in Tampa?"

**Expected Behavior:**
- First query: Large result set, summarized
- Second query: Uses context from first query
- LLM generates NEW SQL with Florida + Tampa filters
- Should return count, not full list
- Response references "200 products from Florida, 45 in Tampa"

**Test Result:** _[Fill in after testing]_

---

## Test 4: Aggregate Query (Should NOT Summarize)

**Query:** "How many orders did we have by state in 2023?"

**Expected Behavior:**
- Returns ~10-20 rows (one per state)
- ❌ NO summarization (aggregate query detected)
- All rows sent to LLM
- Clean response with all states listed

**Test Result:** _[Fill in after testing]_

---

## Test 5: Small Result Set (Should NOT Summarize)

**Query:** "Show me sales for customer 19520 in March 2023"

**Expected Behavior:**
- Returns <50 rows
- ❌ NO summarization (below threshold)
- All rows sent to LLM
- Detailed response possible

**Test Result:** _[Fill in after testing]_

---

## Test 6: Category Distribution (Should Trigger Summarization)

**Query:** "What are all the different products in the FASTENERS category?"

**Expected Behavior:**
- Returns 100+ rows
- ✅ Summarization applied
- LLM receives:
  - Total count of fastener products
  - Top sellers in category
  - Price range
  - Sample products
- Response highlights variety and top items

**Test Result:** _[Fill in after testing]_

---

## Test 7: Edge Case - Exactly at Threshold

**Query:** "Show me the top 50 customers by order count"

**Expected Behavior:**
- Returns exactly 50 rows
- ❌ NO summarization (threshold is >50, not >=50)
- All 50 customers sent to LLM
- Detailed analysis of all customers

**Test Result:** _[Fill in after testing]_

---

## Test 8: Very Large Dataset

**Query:** "List all sales orders from 2023"

**Expected Behavior:**
- Could return 1000+ rows (may hit DB limit of 10,000)
- ✅ Strong summarization
- LLM receives monthly/category aggregates
- Response: "1.79M orders across 12 months, primarily in Michigan..."
- Should NOT crash or timeout

**Test Result:** _[Fill in after testing]_

---

## 🔍 What to Check During Testing

### In Backend Logs:
1. Look for: `"Applying dataset summarization"` message
2. Check: `originalRows` and `threshold` values
3. Verify: `sampleRows` count is 5 or less
4. Confirm: No "context window exceeded" errors from OpenAI

### In Response Quality:
1. Does LLM mention specific categories/patterns?
2. Are insights meaningful (not generic)?
3. Follow-up questions work correctly?
4. Response time is acceptable (<5 seconds)?

### In Console/Network Tab:
1. Check payload size to `/api/analyze`
2. Should be <50KB for summarized datasets
3. Should be <5KB for most requests

---

## 🐛 Common Issues to Watch For

1. **LLM still errors with "context too large"**
   - Increase summarization threshold in config
   - Reduce `maxSampleRows` from 5 to 3

2. **Responses too generic (missing insights)**
   - Summary might not include enough categorical data
   - Check `topCategoricalValues` is set to 10
   - Verify `formatSummaryForLLM` includes top values

3. **Follow-up questions don't work**
   - Check conversation context is preserved
   - Verify SQL filters are extracted correctly
   - LLM should see previous query SQL

4. **Performance issues**
   - Summarization is in-memory, should be fast
   - If slow, check if running multiple summaries
   - Dataset with 10K rows should summarize in <100ms

---

## 📊 Success Criteria

✅ All queries return without errors
✅ Large datasets (>50 rows) show "summarization applied" in logs
✅ LLM responses include specific insights (categories, top values)
✅ No OpenAI context window errors
✅ Payload sizes stay under 50KB
✅ Follow-up questions work with context
✅ Aggregate queries bypass summarization
✅ Response times stay under 5 seconds

---

## 💡 Additional Test Ideas

- Test with columns containing long text fields
- Test with all numeric vs all text columns
- Test with date range queries
- Test with multiple joins returning many columns
- Test with NULL-heavy datasets
- Test conversation with 5+ exchanges

---

**Testing Date:** _[Fill in when testing]_
**Tested By:** _[Your name]_
**Version:** Data Summarization v1.0
