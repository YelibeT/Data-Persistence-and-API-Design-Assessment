**Insighta Labs – Intelligence Query Engine**

A backend service for storing and querying demographic profiles with advanced filtering, sorting, pagination, and natural language search.

  **Overview**
This system allows clients (marketing teams, analysts, etc.) to:
1. Store enriched demographic profiles
2. Filter, sort, and paginate results
3. Query data using plain English

Profiles are enriched automatically using:
1. Gender prediction
2. Age estimation
3. Country inference           
     **Tech Stack**
Node.js + Express
PostgreSQL
Axios (external APIs)
UUID v7
CORS enabled

  **Setup Instructions**
1. Clone the repository
git clone <your-repo-url>
cd <project-folder>
2. Install dependencies
npm install
3. Create .env file
DATABASE_URL=postgres_connection_string
PORT=3000
4. Start the server
node index.js
**Natural Language Parsing Approach**

The /api/profiles/search endpoint allows users to query profiles using plain English. This is implemented using a rule-based parsing system, without any AI or machine learning models.

**Parsing Strategy**
The system uses a rule-based parser (no AI/LLMs).
The query string is:

1. Converted to lowercase
2. Matched against predefined keywords
3. Translated into filters
4. Applied to a SQL query
  ** Limitations**
Only predefined keywords are supported
No synonym recognition (e.g., "men" ≠ "male")
No support for:
OR conditions
negation ("not male")
Limited country mapping
Ambiguous queries may fail
Conflicting inputs may return no results





