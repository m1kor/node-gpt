# OpenAI Chat Completions Streaming Backend with Express

This is an **Express.js** backend for streaming OpenAI chat completions, using **TypeORM** to manage users and conversation history in a **PostgreSQL** database.

### Key Features:
- **Streaming Responses**: Implements OpenAI's chat completions API with real-time streaming.
- **User & Conversation Management**: Utilizes TypeORM for handling users and storing conversation history in a PostgreSQL database.
- **Database Connection Pooling**: Uses **PgBouncer** to manage database connections efficiently, improving performance and scaling capabilities.
- **CORS Protection**: Configurable to allow specific origins for cross-origin requests.

### Environment Configuration:
The `.env` file should be formatted as follows:
```env
POSTGRES_DB=node-gpt                 # Name of the PostgreSQL database
POSTGRES_USER=database_username      # PostgreSQL database username
POSTGRES_PASSWORD=database_password  # PostgreSQL database password
ALLOWED_ORIGINS='["https://gpt.mikor.jp"]'  # Allowed origins for CORS
```
