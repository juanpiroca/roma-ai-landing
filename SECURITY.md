<!-- markdownlint-disable MD013 MD029 MD034 MD026 MD022 MD032 -->
# Security Scan Findings

This document outlines the findings of a security scan performed on the repository to identify exposed API keys, tokens, passwords, and secrets.

## Findings

### 1. Hardcoded API Key in PM2 Configuration
* **Severity**: HIGH
* **File**: `trabajo/ROMA_AI_3_0/02-web-roma-ai-landing/ecosystem.config.js`
* **Description**: A DeepSeek API key was found hardcoded in the `env` section (`DEEPSEEK_API_KEY`). Hardcoding API keys in configuration files can lead to unauthorized access and usage.
* **Recommendation**: Remove the hardcoded key and use environment variables injected securely or a secrets manager.

### 2. Hardcoded Database Passwords in Docker Compose
* **Severity**: LOW
* **File**: `trabajo/ROMA_AI_3_0/10-landing-wordpress/wp-docker/docker-compose.yml`
* **Description**: Database passwords (`MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`, `WORDPRESS_DB_PASSWORD`) are hardcoded in the Docker Compose file. Based on context, these appear to be development or dummy passwords (`roma2024root`, `roma2024wp`), keeping the severity low. However, it's still a bad practice.
* **Recommendation**: Use a `.env` file for Docker Compose to inject these variables dynamically.

### 3. Review of Example Environment Files
* **File**: `.env.example`
* **Description**: The `.env.example` file contains placeholder values and does not expose any real keys. This is the correct practice.
