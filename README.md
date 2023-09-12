# 🌐 ChatCVE Langchain App 

## 🎯 Description
The ChatCVE Lang Chain App is an AI-powered DevSecOps application 🔍, to help organizations triage and aggregate CVE (Common Vulnerabilities and Exposures) information. By leveraging state-of-the-art Natural Language Processing, ChatCVE makes detailed Software Bill of Materials (SBOM) data available to everyone, because Security is everyone's job.  From Security analysts to Audit and Compliance teams, ChatCVE allows a more intuitive and engaging way to extract key findings. 🤖💬

## 🚀 Features
- **🧠 Natural Language Queries**: Ask questions using plain English (or your preferred language)! No need to grapple with complex query languages. 
- **🔮 AI-Powered Analysis**: Our app is backed by Langchain's AI framework.  It can easily surface important vulnerability information using Human Language.  The requests are translated to SQL for querying specific artifact findings.
- **⏭️ Proactive Assistance**: Anyone can identify potential concerns proactively to improve the overall Cyber Security Posture.
- **🔁 Triage & Remediation**: Assist in Vulnerability remediation using the National Vulnerability Database (NVD).  Can be extended to triage using other CVE advisory databases.

## 📲 Installation

1. Clone this repository:
```bash
git clone https://github.com/chatCVE/lang-chain-app.git
```
2. Enter the project directory:
```bash
cd ChatCVE
```
3. Setup a Python environment:
```bash
python3 -m venv .env
source ./env/bin/activate
```
4. Install Grype and Syft
```bash
pip install syft
curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin
```
5. Install requirements
```bash
pip install -r requirements.txt
```
6. Create the app_patrol and nvd_cves databases
```bash
sqlite3> CREATE TABLE app_patrol (
    NAME TEXT,
    INSTALLED TEXT,
    FIXED_IN TEXT,
    TYPE TEXT,
    VULNERABILITY TEXT,
    SEVERITY TEXT,
    IMAGE_TAG TEXT,
     DATE_ADDED TEXT);

sqlite3> CREATE TABLE nvd_cves (
    cve_id TEXT PRIMARY KEY,
    source_id TEXT,
    published TEXT,
    last_modified TEXT,
    vuln_status TEXT,
    description TEXT,
    cvss_v30_vector_string TEXT,
    cvss_v30_base_score REAL,
    cvss_v30_base_severity TEXT,
    cvss_v2_vector_string TEXT,
    cvss_v2_base_score REAL,
    cvss_v2_base_severity TEXT,
    weakness TEXT,
    ref_info TEXT);

5. Create an images.txt file with your images to scan.  Include the registry, repo, and version tag:

public.ecr.aws/tanzu_observability_demo_app/to-demo/inventory:latest
public.ecr.aws/tanzu_observability_demo_app/to-demo/shopping:latest
public.ecr.aws/tanzu_observability_demo_app/to-demo/delivery:latest
public.ecr.aws/tanzu_observability_demo_app/to-demo/warehouse:latest
public.ecr.aws/tanzu_observability_demo_app/to-demo/notification:latest
public.ecr.aws/tanzu_observability_demo_app/to-demo/styling:latest
public.ecr.aws/tanzu_observability_demo_app/to-demo/packaging:latest
public.ecr.aws/tanzu_observability_demo_app/to-demo/printing:latest
public.ecr.aws/tanzu_observability_demo_app/to-demo/payments:latest
public.ecr.aws/tanzu_observability_demo_app/to-demo/loadgen:latest
public.ecr.aws/amazoncorretto/amazoncorretto:20-al2-jdk
public.ecr.aws/docker/library/tomcat:9.0.75-jdk8-corretto-al2
public.ecr.aws/bitnami/minio:2023.5.18
public.ecr.aws/p4c2e2q6/miniamplify-x86:latest
public.ecr.aws/xray/aws-xray-daemon:3.3.7
public.ecr.aws/datadog/agent:7.45.0-rc.5
public.ecr.aws/aws-ec2/aws-node-termination-handler:v1.19.0
public.ecr.aws/aws-gcr-solutions/data-transfer-hub-ecr:v1.0.4
public.ecr.aws/bitnami/jenkins:2.387.3
```



## 💻 Usage
1. Initiate a scan that will kick off the SBOM and CVE artifact creation:
``` bash
python scan.py
```

2. Initiate an App Patrol scan which will create SBOM records in the SQLite3 backend:
``` bash
python fetch_daily_nvd_cves.py
```

3. Check the SBOM records have been added:
``` bash
sqlite3 app_patrol.db
sqlite> SELECT * FROM app_patrol LIMIT 10;
tar|1.34+dfsg-1||deb|CVE-2005-2541|Negligible|public.ecr.aws/tanzu_observability_demo_app/to-demo/shopping:latest|2023-05-21 15:01:15
login|1:4.8.1-1||deb|CVE-2007-5686|Negligible|public.ecr.aws/tanzu_observability_demo_app/to-demo/shopping:latest|2023-05-21 15:01:15
passwd|1:4.8.1-1||deb|CVE-2007-5686|Negligible|public.ecr.aws/tanzu_observability_demo_app/to-demo/shopping:latest|2023-05-21 15:01:15
libssl1.1|1.1.1n-0+deb11u3||deb|CVE-2007-6755|Negligible|public.ecr.aws/tanzu_observability_demo_app/to-demo/shopping:latest|2023-05-21 15:01:15
openssl|1.1.1n-0+deb11u3||deb|CVE-2007-6755|Negligible|public.ecr.aws/tanzu_observability_demo_app/to-demo/shopping:latest|2023-05-21 15:01:15
jetty-setuid-java|1.0.4||java-archive|CVE-2009-5045|High|public.ecr.aws/tanzu_observability_demo_app/to-demo/shopping:latest|2023-05-21 15:01:15
jetty-setuid-java|1.0.4||java-archive|CVE-2009-5046|Medium|public.ecr.aws/tanzu_observability_demo_app/to-demo/shopping:latest|2023-05-21 15:01:15
libssl1.1|1.1.1n-0+deb11u3||deb|CVE-2010-0928|Negligible|public.ecr.aws/tanzu_observability_demo_app/to-demo/shopping:latest|2023-05-21 15:01:15
openssl|1.1.1n-0+deb11u3||deb|CVE-2010-0928|Negligible|public.ecr.aws/tanzu_observability_demo_app/to-demo/shopping:latest|2023-05-21 15:01:15
libc-bin|2.31-13+deb11u3||deb|CVE-2010-4756|Negligible|public.ecr.aws/tanzu_observability_demo_app/to-demo/shopping:latest|2023-05-21 15:01:15
```

4. Start the Chat-CVE session:
```bash
python chat_cve.py
```

5. Query at the prompt:
```bash
Enter a question or type 'exit' to quit: Which NAME in app_patrol table has the most CRITICAL Severity records?
```
    Expected Output:
```bash
** Thought: I should query the app_patrol table to get the name with the most Critical CVEs. **
Thought: I should execute the query to get the results.
Action: query_sql_db
Action Input: SELECT NAME, COUNT(*) AS Top FROM app_patrol WHERE SEVERITY = 'Critical' GROUP BY NAME ORDER BY Top DESC LIMIT 3
Observation: [('curl', 42), ('libcurl4', 42), ('libpcre2-8-0', 16)]
Thought: I now know the final answer.
Final Answer: The top 3 Names in the app_patrol table sorted by the top count of critical in the severity column are 'curl', 'libcurl4', and 'libpcre2-8-0'.
```


## 🌈 Software Supply Chain and Security Use Cases
- **Security Analysts**: Assist Triage & find detailed CVE information quickly without dealing with intricate databases.
- **Audit Teams**: Efficiently target auditing efforts and ensure compliance with security standards.
- **Compliance Teams**: Maintain documentation and track usage for attestation efforts, ensuring all known libraries are documented.  Non technical personnel can simply use human langauge.
- **Development Teams**: Efficiently target underlying libraries and get access to remediation suggestions.

## ⭐⭐ Example prompt queries and results
```bash
What percentage of records are for curl in the app_patrol table?

Thought: I should query the app_patrol table to get the percentage of records for curl.
Action: query_sql_db
Action Input: SELECT COUNT(*) * 100.0 / (SELECT COUNT(*) FROM app_patrol) FROM app_patrol WHERE NAME = 'curl'
Observation: [(6.006697362913353,)]
Thought: I now know the final answer.
Final Answer: 6.006697362913353% of records in the app_patrol table are for curl.

How many critical records are there in the app_patrol table?

Thought: I should query the app_patrol table for the number of critical records.
Action: query_sql_db
Action Input: SELECT COUNT(*) FROM app_patrol WHERE SEVERITY = 'Critical'
Observation: [(246,)]
Thought: I now know the final answer.
Final Answer: There are 246 critical records in the app_patrol table.

Which name in the app_patrol table has the most Critical Severity records?

Thought: I should query the app_patrol table to find the name with the most Critical Severity records.
Action: query_sql_db
Action Input: SELECT NAME, COUNT(*) AS count FROM app_patrol WHERE SEVERITY = 'Critical' GROUP BY NAME ORDER BY count DESC LIMIT 10;
Observation: [('curl', 42), ('libcurl4', 42), ('libpcre2-8-0', 16), ('libksba8', 15), ('jetty-setuid-java', 14), ('libdb5.3', 9), ('libtasn1-6', 9), ('zlib1g', 8), ('System.Drawing.Common', 7), ('libexpat1', 7)]
Thought: I now know the final answer.
Final Answer: The name with the most Critical Severity records is 'curl' with 42 records.
```


## 🤝 Contributing
We welcome your feedback! 🙌 
For all significant changes, please open an issue first to discuss what you'd like to improve.

## 📃 License
Our project is licensed under the [MIT License](https://choosealicense.com/licenses/mit/).
