from langchain.sql_database import SQLDatabase
from langchain.llms.openai import OpenAI
from langchain.agents import create_sql_agent, AgentExecutor
from langchain_community.agent_toolkits import SQLDatabaseToolkit
import os

# Initialize your LLM (Language Learning Model) with OpenAI api key environment variable named openai_api_key

llm = OpenAI(openai_api_key=os.environ.get("OPENAI_API_KEY"))

# Define the SQLDatabaseToolkit connection to the App_Patrol Database
db = SQLDatabase.from_uri("sqlite:////ChatCVE/app_patrol.db")
toolkit = SQLDatabaseToolkit(db=db, llm=llm)  # Now passing both db and llm to SQLDatabaseToolkit

agent_executor = create_sql_agent(
    llm=llm,
    toolkit=toolkit,
    verbose=True
)

#Take user input from the command line and run the agent on it
while True:
    guardrails = "Do not use sql LIMIT in the results. "
    user_input = input("Enter a question or type 'exit' to quit: ")
    if user_input.lower() == 'exit':
        break
    
    # Prepending guardrails to user_input before running
    safe_user_input = guardrails + user_input
    agent_executor.run(safe_user_input)
