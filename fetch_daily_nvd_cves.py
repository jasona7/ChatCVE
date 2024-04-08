import urllib.request
import urllib.parse
import json
import sqlite3
from datetime import datetime, timedelta
import logging


# Set up logging
logging.basicConfig(
    filename='app.log', 
    filemode='a', 
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', 
    level=logging.INFO
)

# Start time
start_time = datetime.now()

# Get current UTC time and 24 hours earlier
now = datetime.utcnow()
one_day_ago = now - timedelta(days=1)

# Format the times as strings in the required format
now_str = now.strftime("%Y-%m-%dT%H:%M:%S") + '.999-05:00'
one_day_ago_str = one_day_ago.strftime("%Y-%m-%dT%H:%M:%S") + '.000-05:00'

# Construct the URL
base_url = "https://services.nvd.nist.gov/rest/json/cves/2.0"
query_params = {
    "pubStartDate": one_day_ago_str,
    "pubEndDate": now_str
}
url = base_url + "?" + urllib.parse.urlencode(query_params)

# Make the request and parse the response
response = urllib.request.urlopen(url)
data = json.loads(response.read().decode())

# Open a connection to the SQLite database and create a cursor object
conn = sqlite3.connect('../app_patrol.db')
cursor = conn.cursor()

count = 0
severity_count = {}

# For each CVE in the response, insert the data into the nvd_cves table
for vuln in data['vulnerabilities']:
    count += 1
    cve = vuln['cve']
    metric_v3 = cve['metrics']['cvssMetricV30'][0]['cvssData'] if cve['metrics'].get('cvssMetricV30') else {}
    metric_v2 = cve['metrics']['cvssMetricV2'][0]['cvssData'] if cve['metrics'].get('cvssMetricV2') else {}

    severity = metric_v3.get('baseSeverity', 'N/A')
    severity_count[severity] = severity_count.get(severity, 0) + 1

    cursor.execute("""
    INSERT OR REPLACE INTO nvd_cves
        (cve_id, source_id, published, last_modified, vuln_status, description,
        cvss_v30_vector_string, cvss_v30_base_score, cvss_v30_base_severity,
        cvss_v2_vector_string, cvss_v2_base_score, cvss_v2_base_severity,
        weakness, ref_info) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """,
                   (cve['id'],
                    cve['sourceIdentifier'],
                    cve['published'],
                    cve['lastModified'],
                    cve['vulnStatus'],
                    cve['descriptions'][0]['value'] if cve.get('descriptions') else None,
                    metric_v3.get('vectorString'),
                    metric_v3.get('baseScore'),
                    metric_v3.get('baseSeverity'),
                    metric_v2.get('vectorString'),
                    metric_v2.get('baseScore'),
                    metric_v2.get('baseSeverity'),
                    cve['weaknesses'][0]['description'][0]['value'] if cve.get('weaknesses') else None,
                    json.dumps(cve['references'])))

# Commit the changes and close the connection
conn.commit()
conn.close()

# End time
end_time = datetime.now()

# Calculate execution time
execution_time = end_time - start_time

# Write summary to log file
log_dir = '/home/jalloway/ChatCVE/logs/'
log_filename = now.strftime("%Y-%m-%d_%H_%M_%S_fetch_summary.log").replace(':', '_').replace('/', '_')
with open(log_dir + log_filename, 'w') as f:
    f.write(f"Script execution summary:\n")
    f.write(f"Records created or updated: {count}\n")
    f.write(f"Execution time: {execution_time}\n")
    f.write(f"Severity count:\n")
    for severity, count in severity_count.items():
        f.write(f"{severity}: {count}\n")
