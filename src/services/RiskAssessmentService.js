const { RISK_PATTERNS, FILE_PATTERNS } = require('../constants/reviewPatterns');

/**
 * Service for assessing risk levels in code changes and generating review checklists
 */
class RiskAssessmentService {
  /**
   * Initializes the RiskAssessmentService with predefined risk and file patterns
   */
  constructor() {
    this.riskPatterns = RISK_PATTERNS;
    this.filePatterns = FILE_PATTERNS;
  }

  /**
   * Determines the risk level of changes in a file based on its content and patterns
   * @param {string} file - The file path being analyzed
   * @param {string[]} diffContent - Array of diff content lines
   * @returns {'LOW'|'MEDIUM'|'HIGH'} The assessed risk level
   */
  identifyRiskLevel(file, diffContent) {
    if (/\.(md|mdx|markdown)$/i.test(file)) {
      return 'LOW';
    }
    let riskLevel = 'LOW';
    const diffText = diffContent.join('\n');
    
    // Check file patterns first
    for (const [level, patterns] of Object.entries(this.filePatterns)) {
      if (patterns.some(pattern => pattern.test(file))) {
        riskLevel = level;
        break;
      }
    }

    // Check content patterns
    for (const [level, categories] of Object.entries(this.riskPatterns)) {
      let hasMatch = false;
      
      for (const [category, patterns] of Object.entries(categories)) {
        if (patterns.some(pattern => pattern.test(diffText))) {
          hasMatch = true;
          break;
        }
      }
      
      if (hasMatch) {
        // Upgrade risk level if content risk is higher than file risk
        const riskLevels = ['LOW', 'MEDIUM', 'HIGH'];
        const currentRiskIndex = riskLevels.indexOf(riskLevel);
        const contentRiskIndex = riskLevels.indexOf(level);
        if (contentRiskIndex > currentRiskIndex) {
          riskLevel = level;
        }
        break;
      }
    }

    return riskLevel;
  }

  /**
   * Generates a review checklist based on file type, change type, and risk level
   * @param {string} file - The file path
   * @param {'added'|'modified'|'deleted'|'renamed'} type - Type of change
   * @param {'LOW'|'MEDIUM'|'HIGH'} riskLevel - Assessed risk level
   * @returns {string} Markdown formatted checklist
   */
  generateChecklist(file, type, riskLevel) {
    const checks = [
      // Common checks
      '- [ ] Changes are intentional and necessary',
      '- [ ] Code follows project standards',
    ];

    // Risk level specific checks
    if (riskLevel === 'HIGH') {
      checks.push(
        '- [ ] Security implications reviewed',
        '- [ ] Error handling is comprehensive',
        '- [ ] Input validation is thorough',
        '- [ ] Sensitive data is properly handled',
        '- [ ] Proper logging (no sensitive data)',
        '- [ ] Performance impact considered'
      );
    }

    // Type specific checks
    const typeChecks = {
      added: [
        '- [ ] New file is necessary and properly placed',
        '- [ ] Dependencies are properly managed',
        '- [ ] File organization follows project structure'
      ],
      modified: [
        '- [ ] No unintended changes',
        '- [ ] Backwards compatibility maintained',
        '- [ ] Related files updated'
      ],
      deleted: [
        '- [ ] File removal impact is assessed',
        '- [ ] All references removed',
        '- [ ] No breaking changes introduced',
        '- [ ] Clean up related resources'
      ],
      renamed: [
        '- [ ] All references updated',
        '- [ ] Import/export paths corrected',
        '- [ ] Documentation updated'
      ]
    };

    checks.push(...(typeChecks[type] || []));

    // File type specific checks
    if (file.includes('test')) {
      checks.push(
        '- [ ] Test cases are comprehensive',
        '- [ ] Edge cases are covered',
        '- [ ] Assertions are meaningful'
      );
    }
    if (file.endsWith('.json')) {
      checks.push(
        '- [ ] JSON structure is valid',
        '- [ ] Configuration is complete',
        '- [ ] No sensitive data exposed'
      );
    }

    return checks.join('\n');
  }
}

module.exports = RiskAssessmentService;
