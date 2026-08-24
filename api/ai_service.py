#!/usr/bin/env python3
"""
ChatCVE AI Service
==================

Provider-agnostic LLM layer for the ChatCVE security-analyst chat.

Supports multiple LLM providers selected via the AI_PROVIDER environment
variable:

    openai        (default) - OpenAI ChatGPT models
    azure-openai            - Azure OpenAI deployments
    anthropic               - Anthropic Claude models
    bedrock                 - AWS Bedrock (Claude / others)
    gemini                  - Google Gemini models
    ollama                  - Local models via Ollama (offline/private)

The SQL agent uses modern native tool-calling (instead of the legacy
ZERO_SHOT_REACT_DESCRIPTION agent) which is dramatically more reliable
with current models, and connects to SQLite in enforced read-only mode
so the agent can never modify scan data.
"""

import os
import logging
from typing import Tuple

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Provider configuration
# ---------------------------------------------------------------------------

DEFAULT_MODELS = {
    'openai': 'gpt-4o',
    'azure-openai': None,          # requires AZURE_OPENAI_DEPLOYMENT
    'anthropic': 'claude-sonnet-4-20250514',
    'bedrock': 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    'gemini': 'gemini-2.0-flash',
    'ollama': 'llama3.1',
}

PROVIDER_ENV_KEYS = {
    'openai': ['OPENAI_API_KEY'],
    'azure-openai': ['AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_DEPLOYMENT'],
    'anthropic': ['ANTHROPIC_API_KEY'],
    'bedrock': [],                  # uses standard AWS credential chain
    'gemini': ['GOOGLE_API_KEY'],
    'ollama': [],                   # no key required for local Ollama
}


class AIServiceError(Exception):
    """Raised when the AI service cannot be initialized."""


def get_provider_info() -> dict:
    """Return information about the configured AI provider (for /health)."""
    provider = os.getenv('AI_PROVIDER', 'openai').lower().strip()
    model = os.getenv('LLM_MODEL', '').strip() or DEFAULT_MODELS.get(provider)
    return {
        'provider': provider,
        'model': model or '(deployment-specific)',
        'configured': all(
            os.getenv(k) for k in PROVIDER_ENV_KEYS.get(provider, [])
        ),
    }


def create_chat_model():
    """
    Create a LangChain chat model instance for the configured provider.

    Environment variables:
        AI_PROVIDER              one of the keys in DEFAULT_MODELS
        LLM_MODEL                model name override
        OPENAI_BASE_URL          optional custom OpenAI-compatible endpoint
        AZURE_OPENAI_ENDPOINT    Azure endpoint URL
        AZURE_OPENAI_API_VERSION Azure API version (default 2024-06-01)
        OLLAMA_BASE_URL          Ollama server URL (default :11434)
        LLM_TEMPERATURE          sampling temperature (default 0)

    Raises AIServiceError if the provider is unknown or misconfigured.
    """
    info = get_provider_info()
    provider, model = info['provider'], info['model']
    temperature = float(os.getenv('LLM_TEMPERATURE', '0'))

    missing = [k for k in PROVIDER_ENV_KEYS.get(provider, []) if not os.getenv(k)]
    if missing:
        raise AIServiceError(
            f"AI provider '{provider}' is missing required environment "
            f"variables: {', '.join(missing)}"
        )

    try:
        if provider == 'openai':
            from langchain_openai import ChatOpenAI
            kwargs = {
                'model': model,
                'temperature': temperature,
                'api_key': os.getenv('OPENAI_API_KEY'),
            }
            base_url = os.getenv('OPENAI_BASE_URL')
            if base_url:
                kwargs['base_url'] = base_url
            return ChatOpenAI(**kwargs)

        elif provider == 'azure-openai':
            from langchain_openai import AzureChatOpenAI
            return AzureChatOpenAI(
                azure_endpoint=os.getenv('AZURE_OPENAI_ENDPOINT'),
                azure_deployment=os.getenv('AZURE_OPENAI_DEPLOYMENT'),
                api_version=os.getenv('AZURE_OPENAI_API_VERSION', '2024-06-01'),
                api_key=os.getenv('AZURE_OPENAI_API_KEY'),
                temperature=temperature,
            )

        elif provider == 'anthropic':
            from langchain_anthropic import ChatAnthropic
            return ChatAnthropic(
                model=model,
                temperature=temperature,
                anthropic_api_key=os.getenv('ANTHROPIC_API_KEY'),
                max_tokens=4096,
            )

        elif provider == 'bedrock':
            from langchain_aws import ChatBedrock
            return ChatBedrock(
                model_id=model,
                region_name=os.getenv('AWS_REGION', 'us-east-1'),
                model_kwargs={'temperature': temperature},
            )

        elif provider == 'gemini':
            from langchain_google_genai import ChatGoogleGenerativeAI
            return ChatGoogleGenerativeAI(
                model=model,
                temperature=temperature,
                google_api_key=os.getenv('GOOGLE_API_KEY'),
            )

        elif provider == 'ollama':
            from langchain_ollama import ChatOllama
            return ChatOllama(
                model=model,
                temperature=temperature,
                base_url=os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434'),
            )

        else:
            raise AIServiceError(
                f"Unknown AI_PROVIDER '{provider}'. Valid options: "
                f"{', '.join(DEFAULT_MODELS.keys())}"
            )

    except ImportError as e:
        raise AIServiceError(
            f"Provider '{provider}' requires an optional dependency that is "
            f"not installed ({e}). Install it or choose another provider."
        )


# ---------------------------------------------------------------------------
# Read-only database access
# ---------------------------------------------------------------------------

def create_readonly_database(db_path: str):
    """
    Create a LangChain SQLDatabase bound to an engine where every connection
    has SQLite's PRAGMA query_only enabled. Any INSERT/UPDATE/DELETE/DDL
    attempted by the agent fails at the database level, regardless of what
    the prompt says.

    Only the scan-data tables are exposed to the agent - auth/history tables
    are off limits.
    """
    from sqlalchemy import create_engine, event
    from langchain_community.utilities import SQLDatabase

    engine = create_engine(f"sqlite:///{db_path}")

    @event.listens_for(engine, 'connect')
    def _enforce_read_only(dbapi_conn, _record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA query_only = ON")
        cursor.close()

    return SQLDatabase(
        engine=engine,
        include_tables=['scan_metadata', 'app_patrol'],
    )

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are ChatCVE, an expert DevSecOps security analyst \
assistant. You answer questions about container image vulnerability scans \
by querying a SQLite database using the provided tools, then explain the \
results with actionable security insight.

## Database schema

TABLE scan_metadata (one row per scan - use for scan-level questions):
- id (INTEGER PK), scan_timestamp (TEXT "YYYY-MM-DD HH:MM:SS")
- user_scan_name (TEXT, human-friendly scan name)
- image_count (INTEGER), scan_duration (REAL seconds)
- total_packages_scanned (INTEGER), total_vulnerabilities_found (INTEGER)
- scan_status (SUCCESS/FAILED/PARTIAL), scan_type (FULL/INCREMENTAL/RESCAN)
- syft_version, grype_version, scan_engine, scan_source (TEXT)
- risk_score (REAL 0-100), critical_count, high_count, medium_count,
  low_count, exploitable_count (INTEGER)
- scan_initiator, project_name, environment
  (PRODUCTION/STAGING/DEVELOPMENT), compliance_policy, scan_tags (TEXT)

TABLE app_patrol (one row per vulnerability finding - use for detail):
- id (INTEGER PK), IMAGE_TAG (container image reference)
- NAME (package name), INSTALLED (installed version), FIXED_IN (fix version)
- TYPE (package type), VULNERABILITY (CVE/GHSA identifier)
- SEVERITY (CRITICAL/HIGH/MEDIUM/LOW), DESCRIPTION (TEXT)
- DATE_ADDED (TEXT, matches scan_timestamp of its scan), SCAN_NAME (TEXT)

## Rules

1. NEVER modify data. You have read-only access; SELECT queries only.
2. Use scan_metadata for questions about scans (counts, durations, names).
   Use app_patrol for questions about specific CVEs, packages or images.
   JOIN on substr(ap.DATE_ADDED,1,19) = substr(sm.scan_timestamp,1,19)
   only when both scan context AND vulnerability details are needed.
3. user_scan_name is the scan name. app_patrol.NAME is a PACKAGE name -
   never confuse them.
4. Always LIMIT result sets to at most 50 rows unless aggregating.
5. Inspect tables with sql_db_schema before querying unfamiliar columns.
6. Format responses in Markdown: lead with a direct answer, then a compact
   Markdown table when listing results, then 2-4 bullet points of security
   guidance (e.g., remediation priority, exposure risk, fix versions).
7. Wrap any SQL you mention in ```sql code fences.
8. Render CVE identifiers (e.g. CVE-2024-1234) as plain text tokens.
9. If asked about non-security topics, politely redirect to vulnerability
   management topics you can help with.
10. If the database has no relevant data, say so plainly instead of
    guessing numbers.
"""


# ---------------------------------------------------------------------------
# Agent construction & streaming
# ---------------------------------------------------------------------------

def build_agent_executor(db_path: str) -> Tuple[object, str]:
    """
    Build the tool-calling SQL agent executor.

    Returns (agent_executor, model_name).

    Raises AIServiceError if the LLM provider is misconfigured.
    """
    from langchain_community.agent_toolkits import SQLDatabaseToolkit
    from langchain_community.agent_toolkits.sql.base import create_sql_agent

    llm = create_chat_model()
    db = create_readonly_database(db_path)
    toolkit = SQLDatabaseToolkit(db=db, llm=llm)

    agent_executor = create_sql_agent(
        llm=llm,
        toolkit=toolkit,
        agent_type='tool-calling',
        prefix=SYSTEM_PROMPT,
        verbose=False,
        max_iterations=12,
        top_k=50,
    )
    model_name = (
        getattr(llm, 'model_name', None)
        or getattr(llm, 'model', None)
        or getattr(llm, 'model_id', None)
        or 'unknown'
    )
    return agent_executor, model_name


async def stream_agent_events(agent_executor, question: str):
    """
    Async generator yielding structured events while the agent works:
        {'type': 'step', 'tool': <tool_name>}     - agent invoked a tool
        {'type': 'token', 'content': <text>}      - streaming answer token
        {'type': 'done', 'response': <full_text>} - final complete answer

    Uses LangChain's astream_events v2 API.
    """
    final_state = None
    streamed = ''
    async for event in agent_executor.astream_events(
        {'input': question}, version='v2'
    ):
        kind = event['event']

        if kind == 'on_tool_start':
            yield {'type': 'step', 'tool': event.get('name', 'tool')}

        elif kind == 'on_chat_model_stream':
            chunk = event['data']['chunk']
            content = getattr(chunk, 'content', None)
            # Tool-calling models emit dict/list content for tool_use
            # blocks; only stream human-readable string content.
            if isinstance(content, str) and content:
                streamed += content
                yield {'type': 'token', 'content': content}

        elif kind == 'on_chain_end' and event.get('name') == 'AgentExecutor':
            final_state = event['data'].get('output')

    # Prefer the executor's final output; fall back to the accumulated
    # stream (some agent/tool-calling combinations emit an AgentExecutor
    # end event without a usable output payload).
    response_text = ''
    if isinstance(final_state, dict):
        output = final_state.get('output', '')
        response_text = output if isinstance(output, str) else str(output)
    elif isinstance(final_state, str):
        response_text = final_state
    if not response_text.strip():
        response_text = streamed
    yield {'type': 'done', 'response': response_text}

