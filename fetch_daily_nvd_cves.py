import urllib.request
import urllib.parse
import json
import sqlite3
from datetime import datetime, timedelta

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
#conn = sqlite3.connect('app_patrol.db')
conn = sqlite3.connect('/home/ec2-user/ChatCVE/app_patrol.db')

cursor = conn.cursor()

# For each CVE in the response, insert the data into the nvd_cves table
for vuln in data['vulnerabilities']:
    cve = vuln['cve']
    metric_v3 = cve['metrics']['cvssMetricV30'][0]['cvssData'] if cve['metrics'].get('cvssMetricV30') else {}
    metric_v2 = cve['metrics']['cvssMetricV2'][0]['cvssData'] if cve['metrics'].get('cvssMetricV2') else {}

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
