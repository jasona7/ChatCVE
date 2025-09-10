import requests
import json
import sqlite3
from datetime import datetime, timedelta
import logging
import os
import jwt
import ssl
from pathlib import Path

# Ensure the log directory exists
log_directory = 'logs/github'
if not os.path.exists(log_directory):
    os.makedirs(log_directory)

# Set up logging
log_file_path = os.path.join(log_directory, 'github_advisories.log')
logging.basicConfig(filename=log_file_path, level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')

# Configuration for GitHub API
DATABASE_PATH = '../app_patrol.db'  # Adjust path as necessary
APP_ID = os.getenv('GITHUB_APP_ID')  # Load the GitHub App ID from environment variables
print("Using GitHub App ID:", APP_ID)

# Load the RSA key from a file at the root of the project
pem_file_path = Path('/home/jalloway/ChatCVE/security-advisory-access.2024-04-15.private-key.pem')  # Adjust path as necessary

def create_jwt():
    """
    Create a JWT for GitHub App authentication using the loaded GitHub App ID.
    """
    # Prepare JWT claims
    payload = {
        # Issued at time
        'iat': datetime.utcnow(),
        # JWT expiration time (10 minute maximum)
        'exp': datetime.utcnow() + timedelta(minutes=10),
        # GitHub App's identifier
        'iss': APP_ID
    }
    
    # Read the .pem file and extract the token
    with open(pem_file_path, 'r') as pem_file:
        pem_data = pem_file.read()
        token = pem_data.split('\n')[1].strip()

    # Encode the JWT using the RS256 algorithm
    jwt_token = jwt.encode(payload, token, algorithm='RS256')
    # Ensure the JWT is in string format, if necessary
    if isinstance(jwt_token, bytes):
        jwt_token = jwt_token.decode('utf-8')
    return jwt_token


def fetch_github_advisories():
    jwt_token = create_jwt()
    headers = {
        'Authorization': f'Bearer {jwt_token}',
        'Accept': 'application/vnd.github.v3+json'
    }
    query = """
    {
      securityVulnerabilities(first: 10, orderBy: {field: UPDATED_AT, direction: DESC}) {
        edges {
          node {
            advisory {
              ghsaId
              summary
              description
              severity
              publishedAt
              updatedAt
            }
            package {
              name
              ecosystem
            }
            vulnerableVersionRange
          }
        }
      }
    }
    """
    try:
        response = requests.post('https://api.github.com/graphql', json={'query': query}, headers=headers)
        print("Response Status:", response.status_code)  # Debug print
        print("Response Content:", response.content)  # Debug print
        response.raise_for_status()  # Raises HTTPError for bad responses
        return response.json()
    except requests.exceptions.HTTPError as e:
        logging.error(f"HTTP error occurred: {e}")
    except requests.exceptions.RequestException as e:
        logging.error(f"Request exception: {e}")
    except ValueError as e:
        logging.error(f"JSON decode error: {e}")

    return None

def save_advisories_to_db(advisories):
    if advisories is None:
        logging.error("No advisories to save because of previous errors.")
        return

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    try:
        for edge in advisories['data']['securityVulnerabilities']['edges']:
            node = edge['node']
            advisory = node['advisory']
            package = node['package']

            cursor.execute("""
            INSERT OR REPLACE INTO github_advisories
                (ghsa_id, package_name, ecosystem, summary, description, severity,
                published_at, updated_at, vulnerable_version_range) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                           (advisory['ghsaId'],
                            package['name'],
                            package['ecosystem'],
                            advisory['summary'],
                            advisory['description'],
                            advisory['severity'],
                            advisory['publishedAt'],
                            advisory['updatedAt'],
                            node['vulnerableVersionRange']))
        conn.commit()
    except sqlite3.Error as e:
        print("SQLite error:", e)  # Debug print
    finally:
        conn.close()

def main():
    start_time = datetime.now()
    advisories = fetch_github_advisories()
    save_advisories_to_db(advisories)
    end_time = datetime.now()
    logging.info(f"Finished fetching and saving GitHub advisories. Time taken: {end_time - start_time}")

if __name__ == '__main__':
    main()