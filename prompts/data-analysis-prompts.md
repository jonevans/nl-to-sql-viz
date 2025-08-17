# Data Analysis & Insights Prompts

This file contains all the prompts used in the Data Analysis & Insights functionality of the Natural Language to SQL Visualization App. You can edit these prompts to customize the AI's behavior and responses.

## 1. Base System Prompt for SQL Assistant

```
You are an expert SQL assistant that helps users convert natural language queries into accurate, efficient SQL statements.

Your capabilities:
- Generate SQL from natural language with high accuracy
- Break down complex queries into manageable steps
- Provide clear explanations for your reasoning
- Suggest appropriate data visualizations
- Refine queries based on user feedback

Guidelines:
1. Always prioritize correctness and security
2. Use proper SQL syntax and formatting
3. Avoid SQL injection vulnerabilities
4. Prefer explicit joins over implicit ones
5. Include helpful comments for complex logic
6. Consider performance implications
7. Validate against provided schema

Response format requirements:
- Always include confidence scores (0.0-1.0)
- Provide clear reasoning for decisions
- Use consistent formatting
- Handle edge cases gracefully
```

## 2. Data Visualization Analysis Prompt

```
Analyze this dataset and recommend the best visualization approach:

Data Preview:
{dataPreview}

Data Characteristics:
{dataAnalysis}

Based on this data, suggest:
1. The most appropriate chart type
2. Which columns should be used for X and Y axes
3. Any data transformations needed
4. Alternative visualization options

Consider these chart types: bar, line, pie, scatter, area, heatmap, table

Response format:
CHART_TYPE: [recommended chart type]
X_AXIS: [column name for x-axis]
Y_AXIS: [column name for y-axis]
REASONING: [explain why this visualization is best]
ALTERNATIVES: [list 2-3 alternative chart types with brief reasoning]
CONFIDENCE: [0.0-1.0]
```

## 3. Query Suggestion Prompt

```
User is typing: "{partialQuery}"

{schemaInfo}

{contextInfo}

Provide helpful query completions and suggestions. Consider:
1. What the user might be trying to accomplish
2. Common patterns based on the partial input
3. Available tables and columns
4. Previous queries in this session

Suggest 3-5 completions that are:
- Relevant to the partial input
- Use available schema elements
- Range from simple to more complex options

Response format for each suggestion:
TEXT: [complete query suggestion]
TYPE: [completion|refinement|alternative]
REASONING: [why this suggestion is relevant]
CONFIDENCE: [0.0-1.0]
```

## 4. Single-Step Query Generation Prompt

```
Convert this natural language query to SQL:

"{userQuery}"

{includeExplanation ? 'Include a detailed explanation of your approach.' : ''}

Response format:
SQL: [your sql query]
REASONING: [explain your approach and decisions]
CONFIDENCE: [0.0-1.0]
{suggestVisualization ? 'VISUALIZATION: [suggest appropriate chart type and reasoning]' : ''}
```

## 5. Multi-Step Query Breakdown Prompt

```
This query appears complex and should be broken down into steps.

Query: "{userQuery}"

Please analyze this query and break it down into logical steps:

1. First, identify what makes this query complex
2. Break it into 3-5 manageable steps
3. For each step, explain the reasoning and dependencies
4. Provide the final combined SQL

Response format:
COMPLEXITY_ANALYSIS: [explain why this query is complex]
STEPS:
Step 1: [description] - [reasoning] - Dependencies: [none or step numbers]
Step 2: [description] - [reasoning] - Dependencies: [step numbers]
...
FINAL_SQL: [complete sql query]
CONFIDENCE: [0.0-1.0]
```

## 6. Query Refinement Prompt

```
Original Query: "{originalQuery}"
Previous SQL Generated: 
{previousSQL}

User Feedback: "{feedback}"

Please refine the SQL query based on the user's feedback. Consider:
1. What specific changes are being requested
2. Whether the original interpretation was correct
3. How to improve the query while maintaining correctness

Response format:
SQL: [refined sql query]
CHANGES: [explain what was changed and why]
CONFIDENCE: [0.0-1.0]
```

## 7. Database Schema Context Prompt

```
Database Schema:

{tables.map(table => `
Table: ${table.name}
${table.description ? `Description: ${table.description}` : ''}
Columns:
${table.columns.map(column => `  - ${column.name} (${column.type})${!column.nullable ? ' NOT NULL' : ''}${column.primaryKey ? ' PRIMARY KEY' : ''}${column.foreignKey ? ` REFERENCES ${column.foreignKey}` : ''}${column.description ? ` - ${column.description}` : ''}`).join('\n')}

${table.sampleData && table.sampleData.length > 0 ? `Sample data:\n${table.sampleData.slice(0, 3).map(row => `  ${JSON.stringify(row)}`).join('\n')}` : ''}
`).join('\n')}

${schema.relationships && schema.relationships.length > 0 ? `
Relationships:
${schema.relationships.map(rel => `  - ${rel.table}.${rel.column} → ${rel.referencedTable}.${rel.referencedColumn} (${rel.type})`).join('\n')}
` : ''}
```

## 8. Conversation Context Prompt

```
Conversation Context:

Recent messages:
{recentMessages.map(msg => `  ${msg.role}: ${msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content}`).join('\n')}

Session info: {totalQueries} queries{commonTableAccess.length > 0 ? `, frequently accessed tables: ${commonTableAccess.slice(0, 3).join(', ')}` : ''}{preferredChartTypes.length > 0 ? `, preferred charts: ${preferredChartTypes.slice(0, 2).join(', ')}` : ''}
```

## Visualization Logic Prompts

### 9. Chart Type Selection Reasoning

The system uses these built-in reasoning patterns for chart selection:

#### Bar Chart
- **Condition**: `categoricalColumns.length >= 1 && numericalColumns.length >= 1`
- **Reasoning**: "Bar chart excellent for comparing categories against numerical values"
- **Confidence**: 0.95
- **Suitability**: 0.9

#### Line Chart
- **Condition**: `dateColumns.length >= 1 && numericalColumns.length >= 1`
- **Reasoning**: "Line chart ideal for showing trends over time"
- **Confidence**: 0.95
- **Suitability**: 0.95

#### Pie Chart
- **Condition**: `categoricalColumns.length === 1 && numericalColumns.length === 1 && uniqueCount <= 8`
- **Reasoning**: "Pie chart effective for showing proportional breakdown"
- **Confidence**: 0.8
- **Suitability**: 0.7

#### Scatter Plot
- **Condition**: `numericalColumns.length >= 2`
- **Reasoning**: "Scatter plot reveals relationships between numerical variables"
- **Confidence**: 0.85
- **Suitability**: 0.8

#### Area Chart
- **Condition**: `dateColumns.length >= 1 && numericalColumns.length >= 1`
- **Reasoning**: "Area chart shows magnitude and trend over time"
- **Confidence**: 0.8
- **Suitability**: 0.75

#### Heatmap
- **Condition**: `numericalColumns.length >= 3 || (categoricalColumns.length >= 2 && numericalColumns.length >= 1)`
- **Reasoning**: "Heatmap visualizes patterns in multi-dimensional data"
- **Confidence**: 0.7
- **Suitability**: 0.6

#### Table (Default)
- **Condition**: Always applicable
- **Reasoning**: "Table provides comprehensive view of all data"
- **Confidence**: 0.9
- **Suitability**: 1.0

## Data Analysis Thresholds & Parameters

### Column Type Detection
- **Categorical Threshold**: `uniqueRatio < 0.2 || uniqueValues.size < 50 || (isString && uniqueValues.size < 20)`
- **Numerical Threshold**: 80% of values must be numeric
- **Date Threshold**: 80% of values must be valid dates

### Statistical Analysis
- **Correlation**: Pearson correlation coefficient for numerical columns
- **Null Percentage**: `(nullCount / totalRows) * 100`
- **Unique Value Counts**: Distinct values per column

### Chart Configuration Scoring
- **Composite Score**: `confidence * 0.6 + suitability * 0.4`
- Charts are ranked by this composite score to select the best visualization

---

## Usage Instructions

1. **Editing Prompts**: Modify the text within the code blocks above
2. **Adding Context**: Use `{variableName}` for dynamic content insertion
3. **Response Formats**: Maintain the specified response formats for parsing
4. **Confidence Scores**: Always include confidence scores between 0.0-1.0
5. **Testing**: Test prompt changes with various query types and data patterns

## Variables Available for Prompt Customization

- `{userQuery}` - The user's natural language query
- `{dataPreview}` - Sample of the dataset (first 5 rows)
- `{dataAnalysis}` - Statistical summary of the data
- `{schemaInfo}` - Database schema information
- `{contextInfo}` - Conversation history and patterns
- `{previousSQL}` - Previously generated SQL
- `{feedback}` - User feedback for refinement
- `{originalQuery}` - Original natural language query
- `{partialQuery}` - Partial user input for suggestions