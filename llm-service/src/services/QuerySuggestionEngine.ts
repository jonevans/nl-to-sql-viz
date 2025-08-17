import { DatabaseSchema, ConversationContext, QuerySuggestion } from '../types';

export class QuerySuggestionEngine {
  private static instance: QuerySuggestionEngine;

  static getInstance(): QuerySuggestionEngine {
    if (!QuerySuggestionEngine.instance) {
      QuerySuggestionEngine.instance = new QuerySuggestionEngine();
    }
    return QuerySuggestionEngine.instance;
  }

  async generateSuggestions(
    partialInput: string,
    schema?: DatabaseSchema,
    context?: ConversationContext,
    options?: {
      maxSuggestions?: number;
      includeTemplates?: boolean;
      includeSchemaAware?: boolean;
      includeContextual?: boolean;
    }
  ): Promise<QuerySuggestion[]> {
    const opts = {
      maxSuggestions: 10,
      includeTemplates: true,
      includeSchemaAware: true,
      includeContextual: true,
      ...options
    };

    const suggestions: QuerySuggestion[] = [];

    // 1. Auto-completion suggestions
    suggestions.push(...this.generateAutoCompletions(partialInput));

    // 2. Template-based suggestions
    if (opts.includeTemplates) {
      suggestions.push(...this.generateTemplateSuggestions(partialInput));
    }

    // 3. Schema-aware suggestions
    if (opts.includeSchemaAware && schema) {
      suggestions.push(...this.generateSchemaAwareSuggestions(partialInput, schema));
    }

    // 4. Context-aware suggestions
    if (opts.includeContextual && context) {
      suggestions.push(...this.generateContextualSuggestions(partialInput, context));
    }

    // 5. Pattern-based suggestions
    suggestions.push(...this.generatePatternBasedSuggestions(partialInput));

    // Sort by confidence and relevance, then take top suggestions
    return this.rankAndFilterSuggestions(suggestions, partialInput, opts.maxSuggestions);
  }

  private generateAutoCompletions(partialInput: string): QuerySuggestion[] {
    const input = partialInput.toLowerCase().trim();
    const suggestions: QuerySuggestion[] = [];

    // Common SQL keywords and phrases
    const completions = [
      // Basic queries
      { phrase: 'show me all', continuation: 'show me all records from users' },
      { phrase: 'get all', continuation: 'get all data from products' },
      { phrase: 'find all', continuation: 'find all customers who ordered' },
      { phrase: 'count the', continuation: 'count the number of orders' },
      { phrase: 'sum of', continuation: 'sum of total sales amount' },
      { phrase: 'average', continuation: 'average order value by customer' },
      
      // Time-based queries
      { phrase: 'last week', continuation: 'orders from last week' },
      { phrase: 'this month', continuation: 'sales for this month' },
      { phrase: 'yesterday', continuation: 'users who registered yesterday' },
      { phrase: 'today', continuation: 'orders placed today' },
      
      // Aggregation queries
      { phrase: 'group by', continuation: 'group by category and sum revenue' },
      { phrase: 'order by', continuation: 'order by date descending' },
      { phrase: 'top 10', continuation: 'top 10 best selling products' },
      { phrase: 'highest', continuation: 'highest revenue generating customers' },
      { phrase: 'lowest', continuation: 'lowest performing products' },
      
      // Comparison queries
      { phrase: 'greater than', continuation: 'orders with value greater than 100' },
      { phrase: 'less than', continuation: 'products with stock less than 10' },
      { phrase: 'between', continuation: 'sales between January and March' },
      { phrase: 'contains', continuation: 'products that contain "premium"' },
    ];

    completions.forEach(comp => {
      if (comp.phrase.startsWith(input) || input.includes(comp.phrase.substring(0, 3))) {
        suggestions.push({
          text: comp.continuation,
          type: 'completion',
          confidence: this.calculateCompletionConfidence(input, comp.phrase),
          reasoning: `Auto-completion based on common pattern: "${comp.phrase}"`
        });
      }
    });

    return suggestions;
  }

  private generateTemplateSuggestions(partialInput: string): QuerySuggestion[] {
    const templates = this.getQueryTemplates();
    const suggestions: QuerySuggestion[] = [];

    templates.forEach(template => {
      const matchScore = this.calculateTemplateMatch(partialInput, template);
      if (matchScore > 0.3) {
        suggestions.push({
          text: template.example,
          type: 'refinement',
          confidence: matchScore,
          reasoning: `Based on template: ${template.description}`
        });
      }
    });

    return suggestions;
  }

  private generateSchemaAwareSuggestions(partialInput: string, schema: DatabaseSchema): QuerySuggestion[] {
    const suggestions: QuerySuggestion[] = [];
    const input = partialInput.toLowerCase();

    // Table-based suggestions
    schema.tables.forEach(table => {
      if (input.includes(table.name.toLowerCase()) || this.fuzzyMatch(input, table.name, 0.7)) {
        // Suggest basic queries for this table
        suggestions.push({
          text: `show me all ${table.name}`,
          type: 'completion',
          confidence: 0.8,
          reasoning: `Table "${table.name}" mentioned in input`
        });

        suggestions.push({
          text: `count of ${table.name}`,
          type: 'alternative',
          confidence: 0.7,
          reasoning: `Count query for table "${table.name}"`
        });

        // Column-specific suggestions
        table.columns.forEach(column => {
          if (input.includes(column.name.toLowerCase())) {
            suggestions.push({
              text: `${table.name} ordered by ${column.name}`,
              type: 'refinement',
              confidence: 0.75,
              reasoning: `Sort by column "${column.name}" in table "${table.name}"`
            });

            if (column.type.includes('DATE') || column.type.includes('TIMESTAMP')) {
              suggestions.push({
                text: `${table.name} from last week`,
                type: 'alternative',
                confidence: 0.7,
                reasoning: `Time-based filter using date column "${column.name}"`
              });
            }
          }
        });
      }
    });

    // Relationship-based suggestions
    if (schema.relationships) {
      schema.relationships.forEach(rel => {
        if (input.includes(rel.table.toLowerCase()) && input.includes(rel.referencedTable.toLowerCase())) {
          suggestions.push({
            text: `${rel.table} with their ${rel.referencedTable}`,
            type: 'refinement',
            confidence: 0.8,
            reasoning: `Join suggestion based on relationship between ${rel.table} and ${rel.referencedTable}`
          });
        }
      });
    }

    return suggestions;
  }

  private generateContextualSuggestions(partialInput: string, context: ConversationContext): QuerySuggestion[] {
    const suggestions: QuerySuggestion[] = [];

    // Analyze user patterns from conversation
    const userPattern = this.analyzeUserPatterns(context);
    
    // Suggest based on previous queries
    const recentQueries = context.messages
      .filter(msg => msg.role === 'user')
      .slice(-3)
      .map(msg => msg.content);

    recentQueries.forEach(query => {
      const similarity = this.calculateSimilarity(partialInput, query);
      if (similarity > 0.4) {
        suggestions.push({
          text: query,
          type: 'alternative',
          confidence: similarity * 0.6,
          reasoning: 'Similar to a recent query in this conversation'
        });

        // Suggest variations
        const variations = this.generateQueryVariations(query);
        variations.forEach(variation => {
          suggestions.push({
            text: variation,
            type: 'followup',
            confidence: similarity * 0.4,
            reasoning: 'Variation of recent query'
          });
        });
      }
    });

    // Suggest based on common table access patterns
    if (userPattern.commonTables.length > 0) {
      userPattern.commonTables.forEach(table => {
        suggestions.push({
          text: `analyze ${table} data`,
          type: 'followup',
          confidence: 0.6,
          reasoning: `You frequently query ${table} table`
        });
      });
    }

    // Suggest based on preferred chart types
    if (userPattern.preferredCharts.length > 0) {
      const chartType = userPattern.preferredCharts[0];
      suggestions.push({
        text: `data suitable for ${chartType} chart`,
        type: 'followup',
        confidence: 0.5,
        reasoning: `Based on your preference for ${chartType} visualizations`
      });
    }

    return suggestions;
  }

  private generatePatternBasedSuggestions(partialInput: string): QuerySuggestion[] {
    const suggestions: QuerySuggestion[] = [];
    const input = partialInput.toLowerCase();

    // Detect query patterns and suggest completions
    const patterns = [
      {
        pattern: /\bshow\b|\bdisplay\b|\bget\b/,
        suggestions: [
          'show me the top 10 records',
          'show breakdown by category',
          'show monthly trends'
        ]
      },
      {
        pattern: /\bcount\b|\bnumber\b|\bhow many\b/,
        suggestions: [
          'count by status',
          'count of unique customers',
          'total number of transactions'
        ]
      },
      {
        pattern: /\bcompare\b|\bdifference\b|\bvs\b/,
        suggestions: [
          'compare this month vs last month',
          'compare performance by region',
          'difference between categories'
        ]
      },
      {
        pattern: /\btrend\b|\bover time\b|\bhistory\b/,
        suggestions: [
          'monthly sales trends',
          'user growth over time',
          'performance history by quarter'
        ]
      },
      {
        pattern: /\btop\b|\bbest\b|\bhighest\b/,
        suggestions: [
          'top performing products',
          'highest revenue customers',
          'best selling categories'
        ]
      }
    ];

    patterns.forEach(({ pattern, suggestions: patternSuggestions }) => {
      if (pattern.test(input)) {
        patternSuggestions.forEach(suggestion => {
          suggestions.push({
            text: suggestion,
            type: 'completion',
            confidence: 0.6,
            reasoning: `Pattern-based suggestion for query type`
          });
        });
      }
    });

    return suggestions;
  }

  private getQueryTemplates(): Array<{
    pattern: string;
    description: string;
    example: string;
    keywords: string[];
  }> {
    return [
      {
        pattern: 'basic_select',
        description: 'Basic data retrieval',
        example: 'show me all users',
        keywords: ['show', 'get', 'all', 'users', 'data']
      },
      {
        pattern: 'aggregation',
        description: 'Count or sum operations',
        example: 'count of orders by month',
        keywords: ['count', 'sum', 'total', 'average']
      },
      {
        pattern: 'filtering',
        description: 'Filtered data queries',
        example: 'users who registered last week',
        keywords: ['where', 'filter', 'last', 'week', 'month']
      },
      {
        pattern: 'sorting',
        description: 'Ordered data queries',
        example: 'top 10 products by sales',
        keywords: ['top', 'best', 'highest', 'order', 'sort']
      },
      {
        pattern: 'grouping',
        description: 'Grouped analysis',
        example: 'sales by category and region',
        keywords: ['by', 'group', 'category', 'region']
      },
      {
        pattern: 'time_series',
        description: 'Time-based analysis',
        example: 'monthly revenue trends',
        keywords: ['monthly', 'daily', 'trends', 'over', 'time']
      }
    ];
  }

  private calculateCompletionConfidence(input: string, phrase: string): number {
    if (phrase.startsWith(input)) {
      return 0.9;
    }
    if (input.length >= 3 && phrase.includes(input)) {
      return 0.7;
    }
    return 0.3;
  }

  private calculateTemplateMatch(input: string, template: any): number {
    const inputWords = input.toLowerCase().split(/\s+/);
    const matchedKeywords = template.keywords.filter((keyword: string) =>
      inputWords.some(word => word.includes(keyword) || keyword.includes(word))
    );
    
    return matchedKeywords.length / template.keywords.length;
  }

  private fuzzyMatch(input: string, target: string, threshold: number): boolean {
    const distance = this.levenshteinDistance(input.toLowerCase(), target.toLowerCase());
    const maxLength = Math.max(input.length, target.length);
    const similarity = 1 - (distance / maxLength);
    return similarity >= threshold;
  }

  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private analyzeUserPatterns(context: ConversationContext): {
    commonTables: string[];
    preferredCharts: string[];
    queryComplexity: 'simple' | 'moderate' | 'complex';
  } {
    const userMessages = context.messages.filter(msg => msg.role === 'user');
    const assistantMessages = context.messages.filter(msg => msg.role === 'assistant');

    // Extract commonly mentioned tables
    const tableMentions: Record<string, number> = {};
    userMessages.forEach(msg => {
      const words = msg.content.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 3) { // Filter short words
          tableMentions[word] = (tableMentions[word] || 0) + 1;
        }
      });
    });

    const commonTables = Object.entries(tableMentions)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([table]) => table);

    // Extract preferred chart types
    const chartTypes = assistantMessages
      .map(msg => msg.metadata?.chartSuggested)
      .filter(Boolean) as string[];
    const preferredCharts = [...new Set(chartTypes)];

    // Analyze query complexity
    const complexKeywords = ['join', 'group by', 'having', 'subquery', 'window'];
    const hasComplexQueries = userMessages.some(msg =>
      complexKeywords.some(keyword => msg.content.toLowerCase().includes(keyword))
    );

    const avgQueryLength = userMessages.reduce((sum, msg) => sum + msg.content.length, 0) / userMessages.length;

    let queryComplexity: 'simple' | 'moderate' | 'complex' = 'simple';
    if (hasComplexQueries || avgQueryLength > 100) {
      queryComplexity = 'complex';
    } else if (avgQueryLength > 50) {
      queryComplexity = 'moderate';
    }

    return {
      commonTables,
      preferredCharts,
      queryComplexity
    };
  }

  private generateQueryVariations(originalQuery: string): string[] {
    const variations: string[] = [];
    const query = originalQuery.toLowerCase();

    // Time variations
    if (query.includes('today')) {
      variations.push(originalQuery.replace(/today/gi, 'yesterday'));
      variations.push(originalQuery.replace(/today/gi, 'this week'));
    }

    if (query.includes('all')) {
      variations.push(originalQuery.replace(/all/gi, 'top 10'));
      variations.push(originalQuery.replace(/all/gi, 'recent'));
    }

    // Aggregation variations
    if (query.includes('count')) {
      variations.push(originalQuery.replace(/count/gi, 'sum'));
      variations.push(originalQuery.replace(/count/gi, 'average'));
    }

    return variations;
  }

  private rankAndFilterSuggestions(
    suggestions: QuerySuggestion[],
    originalInput: string,
    maxSuggestions: number
  ): QuerySuggestion[] {
    // Remove duplicates
    const uniqueSuggestions = suggestions.filter((suggestion, index, self) =>
      index === self.findIndex(s => s.text === suggestion.text)
    );

    // Calculate final scores considering input relevance
    const scoredSuggestions = uniqueSuggestions.map(suggestion => ({
      ...suggestion,
      finalScore: this.calculateFinalScore(suggestion, originalInput)
    }));

    // Sort by final score and take top suggestions
    return scoredSuggestions
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, maxSuggestions)
      .map(({ finalScore, ...suggestion }) => suggestion);
  }

  private calculateFinalScore(suggestion: QuerySuggestion, originalInput: string): number {
    let score = suggestion.confidence;

    // Boost score for longer partial inputs that match well
    if (originalInput.length > 5) {
      const relevance = this.calculateSimilarity(originalInput, suggestion.text);
      score *= (1 + relevance);
    }

    // Boost score for completion type suggestions when input is short
    if (originalInput.length <= 5 && suggestion.type === 'completion') {
      score *= 1.2;
    }

    // Boost score for refinement suggestions when input is substantial
    if (originalInput.length > 10 && suggestion.type === 'refinement') {
      score *= 1.1;
    }

    return score;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }
}