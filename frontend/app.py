from flask import Flask, render_template, request, redirect, url_for
from langchain.sql_database import SQLDatabase
from langchain.llms.openai import OpenAI
from langchain.agents import create_sql_agent
from langchain_community.agent_toolkits import SQLDatabaseToolkit
import os
import re
from sqlalchemy.exc import SQLAlchemyError

app = Flask(__name__)

# Initialize LLM with OpenAI API key
llm = OpenAI(openai_api_key=os.environ.get("OPENAI_API_KEY"))

# Define the SQLDatabaseToolkit connection
db = SQLDatabase.from_uri("sqlite:////ChatCVE/app_patrol.db")
toolkit = SQLDatabaseToolkit(db=db, llm=llm)

agent_executor = create_sql_agent(llm=llm, toolkit=toolkit, verbose=True)

# History of questions and answers
history = []

def execute_sql_query(query):
    try:
        # Assuming db.session.execute is the correct way to run queries with SQLDatabase
        result = db.session.execute(query)
        return [dict(row) for row in result.fetchall()]
    except SQLAlchemyError as e:
        return str(e)

@app.route('/', methods=['GET', 'POST'])
def home():
    if request.method == 'POST':
        user_input = request.form.get('question')
        if user_input:
            guardrails = "Do not use sql LIMIT in the results.  the tables in the database are nvd_findings and also app_patrol.  Output should only be the SL query result."
            safe_user_input = guardrails + user_input
            response = agent_executor.run(safe_user_input)

            # Check if the response is a SQL statement
            if re.match(r"\s*SELECT\s+", response, re.IGNORECASE):
                # Execute the SQL query and get the results
                results = execute_sql_query(response)
                # Format the results as a string or handle as needed
                formatted_results = ', '.join([str(row) for row in results])
                response = formatted_results

            # Insert the new entry at the beginning of the history list
            history.insert(0, (user_input, response))

    return render_template('index.html', history=history)

if __name__ == '__main__':
    app.run(debug=True)
