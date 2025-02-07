// Review risk patterns for code analysis
const RISK_PATTERNS = {
  HIGH: {
    security: [
      // Authentication & Authorization
      /auth|login|logout|permission|role|credential|session|token|jwt|oauth|password|secret|key/i,
      // Data Protection
      /encrypt|decrypt|hash|salt|cipher|ssl|tls|https?/i,
      // Database Operations
      /delete.*from|drop.*table|truncate|update.*set|insert.*into/i,
      /(select|update|delete).*where/i,
      // API Security
      /api.*key|bearer|basic.*auth|cors|csrf|xss|sanitize/i,
      // File Operations
      /upload|download|file.*stream|readFile|writeFile|unlink|rmdir/i,
      // Environment & Configuration
      /env|config|setting|process\.env|dotenv/i,
      // Payment & Sensitive Operations
      /payment|credit.*card|stripe|paypal|billing|invoice/i
    ],
    dataFlow: [
      // State Management
      /store|reducer|action|dispatch|commit|state\./i,
      // Data Transformations
      /parse|stringify|transform|convert|migrate/i,
      // Cache Operations
      /cache|redis|memcached|invalidate/i,
      // Database Transactions
      /transaction|commit|rollback|lock|deadlock/i,
      // Async Operations
      /async|await|promise|callback|observable|subscribe/i
    ],
    infrastructure: [
      // Server Configuration
      /server|cluster|docker|kubernetes|deployment|nginx|apache/i,
      // Database Configuration
      /database|connection|pool|replica|shard/i,
      // Network Operations
      /http|socket|tcp|udp|port|dns|proxy/i
    ]
  },
  MEDIUM: {
    codeQuality: [
      // Code Complexity
      /function.*\([^)]{50,}\)/,  // Functions with many parameters
      /\b(while|for)\b.*\b(while|for)\b/,  // Nested loops
      /(if|switch).*\b(if|switch)\b/,  // Nested conditionals
      /\b(TODO|FIXME|HACK|XXX|BUG|OPTIMIZE)\b/i,  // Code markers
      // Error Handling
      /try|catch|throw|error|exception|finally/i,
      // Memory Management
      /memory|leak|garbage|collect|dispose|cleanup/i
    ],
    userExperience: [
      // Frontend Routes
      /route|navigation|redirect|history|link/i,
      // UI State
      /loading|error|success|disabled|enabled|active|inactive/i,
      // Form Handling
      /form|validation|input|submit|reset|onChange|onSubmit/i,
      // User Interactions
      /click|submit|change|focus|blur|keyup|keydown|mouseup|mousedown/i
    ],
    dataManagement: [
      // Data Validation
      /validate|sanitize|escape|trim|parse/i,
      // Data Formatting
      /format|normalize|serialize|deserialize/i,
      // State Updates
      /setState|useState|useReducer|mutations/i,
      // API Integration
      /api|fetch|axios|http|request|response/i
    ]
  },
  LOW: {
    documentation: [
      // Comments & Documentation
      /\/\*\*|\*\/|\/\/|@param|@return|@throws/i,
      // Type Definitions
      /interface|type|enum|@types/i
    ],
    styling: [
      // CSS & Styling
      /style|css|scss|less|tailwind|theme/i,
      // Layout
      /flex|grid|position|margin|padding|width|height/i
    ],
    utilities: [
      // Helper Functions
      /util|helper|formatter|parser|converter/i,
      // Constants
      /const|enum|constant/i,
      // Testing
      /test|spec|describe|it|expect|assert|mock/i
    ]
  }
};

// File patterns for risk assessment
const FILE_PATTERNS = {
  HIGH: [
    /\.(env|key|pem|crt|csr|p12|pfx)$/i,  // Security files
    /(auth|security|permission|role|login|payment).*\.(js|ts|py|rb|php|java|go)$/i,  // Security-related code
    /middleware.*\.(js|ts|py|rb|php|java|go)$/i,  // Middleware
    /migration.*\.(js|ts|py|rb|php|java|go)$/i    // Database migrations
  ],
  MEDIUM: [
    /\.(config|settings)\.(js|ts|json|yml|yaml)$/i,  // Configuration files
    /(api|service|controller|router).*\.(js|ts|py|rb|php|java|go)$/i,  // API/Service files
    /(store|reducer|context).*\.(js|ts|jsx|tsx)$/i,  // State management
    /\.sql$/i  // SQL files
  ],
  LOW: [
    /\.(md|mdx|markdown)$/i  // Markdown documentation
  ]
};

module.exports = {
  RISK_PATTERNS,
  FILE_PATTERNS
};
